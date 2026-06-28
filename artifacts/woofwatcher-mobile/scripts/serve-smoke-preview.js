const fs = require("fs");
const http = require("http");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const root = path.resolve(projectRoot, ".expo-smoke");
const port = Number(process.env.PORT || process.argv[2] || 4194);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

if (!fs.existsSync(path.join(root, "index.html"))) {
  console.error(
    "Missing .expo-smoke/index.html. Run the Expo web smoke export before previewing.",
  );
  process.exit(1);
}

function resolveFile(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0] || "/");
  const requestedPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const normalized = path.normalize(requestedPath).replace(/^([/\\])+/, "");
  const file = path.resolve(root, normalized);
  const relative = path.relative(root, file);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return { forbidden: true, file: null };
  }

  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    return { forbidden: false, file };
  }

  return { forbidden: false, file: path.join(root, "index.html") };
}

const server = http.createServer((req, res) => {
  const { file, forbidden } = resolveFile(req.url || "/");

  if (forbidden || !file) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, {
    "cache-control": "no-store",
    "content-type": types[ext] || "application/octet-stream",
  });
  fs.createReadStream(file).pipe(res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`WoofWatcher preview: http://127.0.0.1:${port}`);
  console.log("Keep this terminal open while Apollo, Fable, Replit, or device QA reviews the exported beta.");
});
