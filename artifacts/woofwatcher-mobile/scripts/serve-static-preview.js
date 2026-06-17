const fs = require("fs");
const http = require("http");
const path = require("path");

const root = path.resolve(process.cwd(), process.argv[3] || ".expo-smoke");
const port = Number(process.argv[2] || process.env.PORT || 4194);

const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

if (!fs.existsSync(root)) {
  console.error(`Static preview root does not exist: ${root}`);
  process.exit(1);
}

function safeFile(urlPath) {
  let decoded = "/";
  try {
    decoded = decodeURIComponent(urlPath.split("?")[0] || "/");
  } catch {
    return null;
  }

  const clean = path
    .normalize(decoded)
    .replace(/^([/\\])+/, "")
    .replace(/^(\.\.(\/|\\|$))+/, "");
  const candidate = path.resolve(root, clean);
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  return path.join(root, "index.html");
}

http
  .createServer((req, res) => {
    const file = safeFile(req.url || "/");
    if (!file || !fs.existsSync(file)) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      "cache-control": "no-store",
      "content-type": mime[ext] || "application/octet-stream",
    });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`WoofWatcher static preview: http://127.0.0.1:${port}`);
  });
