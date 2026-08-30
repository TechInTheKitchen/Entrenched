"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const root = __dirname;
const host = "127.0.0.1";
const firstPort = 8765;
const lastPort = 8775;
const noOpen = process.argv.includes("--no-open");

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".cjs": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf"
};

function safePath(urlValue) {
  const raw = decodeURIComponent((urlValue || "/").split("?")[0]);
  const relative = raw === "/" ? "index.html" : raw.replace(/^\/+/, "");
  const full = path.resolve(root, relative);
  return full === root || full.startsWith(root + path.sep) ? full : null;
}

function serve(request, response) {
  let file;
  try { file = safePath(request.url); }
  catch { response.writeHead(400); response.end("Bad request"); return; }
  if (!file) { response.writeHead(403); response.end("Forbidden"); return; }
  fs.stat(file, (statError, stat) => {
    if (statError || !stat.isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    fs.createReadStream(file).pipe(response);
  });
}

function start(port) {
  const server = http.createServer(serve);
  server.once("error", error => {
    if (error.code === "EADDRINUSE" && port < lastPort) return start(port + 1);
    console.error(`Could not start the Entrenched reader: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, host, () => {
    const url = `http://${host}:${port}/`;
    console.log("");
    console.log(`Entrenched is open at ${url}`);
    console.log("Keep this window open while reading. Close it to stop the local site.");
    console.log("");
    if (!noOpen) execFile("cmd.exe", ["/c", "start", "", url], { windowsHide: true });
  });
}

start(firstPort);
