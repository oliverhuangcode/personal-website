import { existsSync, readFileSync } from "node:fs";

/**
 * Fills process.env from .env.local, then .env (both gitignored), without overriding
 * anything already set — so CI secrets win, and .env.local wins over .env.
 */
export function loadEnvLocal(paths = [".env.local", ".env"]) {
  for (const path of paths) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}
