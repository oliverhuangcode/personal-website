import { build } from "esbuild";

/** Bundles a pure TS module from src/ so scripts share the site's own code. */
export async function loadTs(entry) {
  const out = await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", write: false });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
}
