/**
 * Converts photos dropped in .photo-inbox/ to WebP and uploads them to Cloudflare R2.
 *
 *   npm run photos                # process the inbox, upload, update the manifest
 *   npm run photos -- --dry-run   # convert only, into .photo-inbox/preview/ (no upload)
 *   npm run photos -- --check     # confirm the R2 credentials and bucket work
 *
 * Inbox layout (names are slugified, so case and spaces don't matter):
 *   .photo-inbox/food/<restaurant>/<dish name>.heic   -> key food/<restaurant>/<dish>
 *   .photo-inbox/travel/<trip>/<n>.jpg                -> key travel/<trip>/<n>
 *   .photo-inbox/projects/<project>/cover.png         -> key projects/<project>/cover
 *
 * Each photo is rotated upright, stripped of all metadata (including GPS), saved as a
 * 1600px and a 640px WebP named by content hash, and uploaded with an immutable cache
 * header. src/content/media.generated.json records it; the original moves to
 * .photo-inbox/done/. Credentials come from .env.local or .env (see docs/food.md).
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join } from "node:path";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

import { loadEnvLocal } from "./lib/env.mjs";
import { loadTs } from "./lib/load-ts.mjs";

const INBOX = ".photo-inbox";
const KINDS = ["food", "travel", "projects"];
const MANIFEST = "src/content/media.generated.json";
const FOOD = "src/content/food.generated.json";
const EXTENSIONS = new Set([".heic", ".heif", ".jpg", ".jpeg", ".png", ".webp", ".avif", ".tif", ".tiff"]);
const SIZES = { full: { px: 1600, quality: 80 }, thumb: { px: 640, quality: 75 } };
const CACHE = "public, max-age=31536000, immutable";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

const { slugify } = await loadTs("src/lib/food-sheet.ts");

function r2() {
  loadEnvLocal();
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  const missing = Object.entries({ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    console.error(`Missing ${missing.join(", ")} in .env.local or .env (see docs/food.md).`);
    process.exit(1);
  }
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
  return { client, bucket: R2_BUCKET };
}

/**
 * Runs each step on its own so a failure names what was refused. HeadBucket
 * alone failing usually means an object-only token, which uploads don't need.
 */
async function check() {
  const { client, bucket } = r2();
  const Key = "_check/ping.txt";
  const steps = [
    ["see the bucket", () => client.send(new HeadBucketCommand({ Bucket: bucket }))],
    ["write an object", () => client.send(new PutObjectCommand({ Bucket: bucket, Key, Body: "ok", ContentType: "text/plain" }))],
    ["read it back", async () => {
      const got = await client.send(new GetObjectCommand({ Bucket: bucket, Key }));
      if ((await got.Body.transformToString()) !== "ok") throw new Error("read back the wrong content");
    }],
    ["delete it", () => client.send(new DeleteObjectCommand({ Bucket: bucket, Key }))],
  ];
  let failed = 0;
  let badSecret = false;
  for (const [label, run] of steps) {
    try {
      await run();
      console.log(`ok    ${label}`);
    } catch (err) {
      failed++;
      badSecret ||= err.Code === "SignatureDoesNotMatch" || err.name === "SignatureDoesNotMatch";
      const status = err.$metadata?.httpStatusCode;
      console.log(`FAIL  ${label}: ${status ? `HTTP ${status}` : ""} ${err.Code ?? err.name ?? ""} ${err.message ?? ""}`.trim());
    }
  }
  if (!failed) return console.log(`\nR2 OK: bucket "${bucket}" is reachable, writable and readable.`);
  if (badSecret) {
    console.log(
      `\nSignatureDoesNotMatch: R2 knows the access key ID but not this secret. R2_SECRET_ACCESS_KEY should be` +
        ` 64 hex characters; the one loaded is ${process.env.R2_SECRET_ACCESS_KEY.length}. A value already set in` +
        ` your shell wins over .env, so check \`echo \${#R2_SECRET_ACCESS_KEY}\` too.`,
    );
    process.exit(1);
  }
  console.log(
    `\n403 on every step: the token can't reach bucket "${bucket}". Check R2_ACCOUNT_ID is the account that owns it,` +
      ` the token covers that exact bucket name, and the bucket isn't in an EU jurisdiction (different endpoint).` +
      `\n403 on "see the bucket" only: the token is object-only, which is enough; uploads will work.`,
  );
  process.exit(1);
}

/**
 * sharp's prebuilt libheif reads HEIC headers but can't decode iPhone HEIC (HEVC),
 * so those go through macOS `sips` first, at maximum JPEG quality.
 */
function decode(file) {
  if (!/\.hei[cf]$/i.test(file)) return { input: file, cleanup: () => {} };
  if (process.platform !== "darwin") {
    throw new Error(`${file}: HEIC needs macOS (sips). Export it as JPEG instead.`);
  }
  const tmp = join(tmpdir(), `photos-${process.pid}-${basename(file)}.jpg`);
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "100", file, "--out", tmp], { stdio: "ignore" });
  return { input: tmp, cleanup: () => rmSync(tmp, { force: true }) };
}

/** Upright, metadata-free WebP. sharp drops EXIF/GPS unless asked to keep it. */
async function encode(input, { px, quality }) {
  return sharp(input)
    .rotate()
    .resize({ width: px, height: px, fit: "inside", withoutEnlargement: true })
    .webp({ quality })
    .toBuffer({ resolveWithObject: true });
}

async function dominantColor(input) {
  const { dominant } = await sharp(input).rotate().stats();
  return `#${[dominant.r, dominant.g, dominant.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function inboxFiles() {
  const files = [];
  for (const kind of KINDS) {
    const root = join(INBOX, kind);
    if (!existsSync(root)) continue;
    for (const folder of readdirSync(root, { withFileTypes: true })) {
      if (!folder.isDirectory()) continue;
      for (const file of readdirSync(join(root, folder.name), { withFileTypes: true })) {
        if (!file.isFile() || !EXTENSIONS.has(extname(file.name).toLowerCase())) continue;
        const key = `${kind}/${slugify(folder.name)}/${slugify(basename(file.name, extname(file.name)))}`;
        files.push({ path: join(root, folder.name, file.name), key, kind, folder: folder.name, name: file.name });
      }
    }
  }
  return files;
}

/** Photos for dishes the sheet doesn't list still upload, but are flagged. */
function foodWarnings(files) {
  if (!existsSync(FOOD)) return [];
  const known = new Set(
    JSON.parse(readFileSync(FOOD, "utf8")).flatMap((r) => r.dishes.map((d) => `food/${r.slug}/${slugify(d.name)}`)),
  );
  return files.filter((f) => f.kind === "food" && !known.has(f.key)).map((f) => f.key);
}

async function run() {
  const files = inboxFiles();
  if (!files.length) {
    console.log(`Nothing in ${KINDS.map((k) => `${INBOX}/${k}`).join(", ")}.`);
    return;
  }

  const seen = new Map();
  for (const f of files) {
    if (seen.has(f.key)) {
      console.error(`Two files map to ${f.key}: ${seen.get(f.key)} and ${f.path}. Rename one.`);
      process.exit(1);
    }
    seen.set(f.key, f.path);
  }

  const storage = dryRun ? null : r2();
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));

  for (const f of files) {
    const { input, cleanup } = decode(f.path);
    try {
      const full = await encode(input, SIZES.full);
      const thumb = await encode(input, SIZES.thumb);
      const hash = createHash("sha256").update(full.data).digest("hex").slice(0, 8);
      const out = {
        full: `${f.key}-${hash}-${SIZES.full.px}.webp`,
        thumb: `${f.key}-${hash}-${SIZES.thumb.px}.webp`,
      };
      const entry = {
        full: out.full,
        thumb: out.thumb,
        width: full.info.width,
        height: full.info.height,
        color: await dominantColor(input),
      };

      if (dryRun) {
        for (const [size, buf] of [["full", full.data], ["thumb", thumb.data]]) {
          const dest = join(INBOX, "preview", out[size]);
          mkdirSync(dirname(dest), { recursive: true });
          writeFileSync(dest, buf);
        }
        console.log(`preview  ${f.key}  ${entry.width}×${entry.height}  ${kb(full.data)} / ${kb(thumb.data)}`);
        continue;
      }

      for (const [size, buf] of [["full", full.data], ["thumb", thumb.data]]) {
        await putOnce(storage, out[size], buf);
      }
      manifest[f.key] = entry;
      writeManifest(manifest);

      const done = join(INBOX, "done", f.kind, f.folder, f.name);
      mkdirSync(dirname(done), { recursive: true });
      renameSync(f.path, done);
      console.log(`uploaded ${f.key}  ${entry.width}×${entry.height}  ${kb(full.data)} / ${kb(thumb.data)}`);
    } finally {
      cleanup();
    }
  }

  for (const key of foodWarnings(files)) {
    console.warn(`warning: ${key} doesn't match any dish in the sheet yet — check the folder and file names.`);
  }
  if (!dryRun) console.log(`\nCommit ${MANIFEST} to publish.`);
}

async function putOnce({ client, bucket }, Key, Body) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key }));
    return; // Same hash, same bytes: already there.
  } catch (e) {
    if (e.$metadata?.httpStatusCode !== 404) throw e;
  }
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key, Body, ContentType: "image/webp", CacheControl: CACHE }),
  );
}

function writeManifest(manifest) {
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(MANIFEST, `${JSON.stringify(sorted, null, 2)}\n`);
}

const kb = (buf) => `${Math.round(buf.length / 1024)} KB`;

if (args.has("--check")) await check();
else await run();
