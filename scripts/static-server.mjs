import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const OUT = new URL("../out/", import.meta.url).pathname;
const TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".txt": "text/plain",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
};

/** Serves `out/` the way a static host does: clean URLs, 404.html fallback. */
export async function startStaticServer() {
  const server = createServer(async (req, res) => {
    const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const candidates = url.endsWith("/")
      ? [join(url, "index.html"), url.replace(/\/$/, "") + ".html"]
      : [url, url + ".html", join(url, "index.html")];
    for (const candidate of candidates) {
      try {
        const body = await readFile(join(OUT, candidate));
        res.writeHead(200, {
          "content-type": TYPES[extname(candidate)] ?? "application/octet-stream",
        });
        return res.end(body);
      } catch {
        // try the next candidate
      }
    }
    res.writeHead(404, { "content-type": "text/html" });
    res.end(await readFile(join(OUT, "404.html")).catch(() => "not found"));
  });
  await new Promise((resolve) => server.listen(0, resolve));
  return { base: `http://localhost:${server.address().port}`, close: () => server.close() };
}
