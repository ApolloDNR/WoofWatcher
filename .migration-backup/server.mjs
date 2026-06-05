import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createOpenAICareAnswer, getOpenAIStatus } from "./src/openai-care-helper.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const portArg = process.argv.find((argument) => argument.startsWith("--port="));
const port = Number(portArg?.split("=")[1] || process.env.PORT || 4178);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png"
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
  const requestPath = decodeURIComponent(url.pathname);

  if (requestPath === "/api/care-helper") {
    await handleCareHelper(request, response);
    return;
  }

  const relativePath = requestPath === "/" ? "index.html" : requestPath.slice(1);
  const normalized = normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(root, normalized);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(root, "index.html");
  }

  const type = mimeTypes[extname(filePath)] || "application/octet-stream";
  response.writeHead(200, {
    "Content-Type": type,
    "Cache-Control": type.includes("html") ? "no-store" : "public, max-age=3600"
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`WoofWatcher running at http://127.0.0.1:${port}`);
});

async function handleCareHelper(request, response) {
  if (request.method === "GET") {
    sendJson(response, 200, {
      ...getOpenAIStatus(process.env),
      mode: getOpenAIStatus(process.env).configured ? "openai" : "local"
    });
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const status = getOpenAIStatus(process.env);
  if (!status.configured) {
    sendJson(response, 501, {
      error: "OPENAI_API_KEY is not configured.",
      mode: "local",
      boundary: status.boundary
    });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const answer = await createOpenAICareAnswer({
      question: body.question,
      context: body.context,
      env: process.env
    });
    sendJson(response, 200, answer);
  } catch (error) {
    sendJson(response, error.code === "payload_too_large" ? 413 : 502, {
      error: error.message,
      mode: "local",
      boundary: status.boundary
    });
  }
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 64_000) {
        const error = new Error("Request body is too large.");
        error.code = "payload_too_large";
        reject(error);
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}
