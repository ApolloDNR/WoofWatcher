import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Vercel SPA fallback does not capture API routes", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  const fallback = config.rewrites.find((rewrite) => rewrite.destination === "/index.html");

  assert.ok(fallback, "expected an index.html fallback rewrite");
  assert.match(fallback.source, /\(\?!api\//, "fallback rewrite should exclude /api routes");
});
