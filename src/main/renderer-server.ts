import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { RENDERER_ORIGIN, RENDERER_PORT } from "@/shared/clerk-config";

export { RENDERER_INDEX_URL, RENDERER_ORIGIN } from "@/shared/clerk-config";

const HOST = "127.0.0.1";

function buildContentSecurityPolicy({
  frontendApiOrigin,
}: {
  frontendApiOrigin: string;
}): string {
  return [
    `default-src 'self'`,
    `script-src  'self'`,
    `style-src   'self' 'unsafe-inline'`,
    `img-src     'self' data: blob: https://img.clerk.com ${frontendApiOrigin}`,
    `font-src    'self' data:`,
    `connect-src 'self' ${frontendApiOrigin}`,
    `worker-src  'self' blob:`,
  ].join("; ");
}

// prettier-ignore
const MIME_TYPES: Record<string, string> = {
  ".html":  "text/html; charset=utf-8",
  ".js":    "text/javascript; charset=utf-8",
  ".mjs":   "text/javascript; charset=utf-8",
  ".css":   "text/css; charset=utf-8",
  ".json":  "application/json; charset=utf-8",
  ".map":   "application/json; charset=utf-8",
  ".svg":   "image/svg+xml",
  ".png":   "image/png",
  ".jpg":   "image/jpeg",
  ".jpeg":  "image/jpeg",
  ".gif":   "image/gif",
  ".webp":  "image/webp",
  ".ico":   "image/x-icon",
  ".woff":  "font/woff",
  ".woff2": "font/woff2",
  ".ttf":   "font/ttf",
  ".wasm":  "application/wasm",
};

export function startRendererServer({
  rendererDir,
  frontendApiOrigin,
}: {
  rendererDir: string;
  frontendApiOrigin: string;
}): Promise<void> {
  const csp = buildContentSecurityPolicy({ frontendApiOrigin });
  const server = http.createServer((req, res) => {
    void serveFile({ rendererDir, requestUrl: req.url ?? "/", csp, res });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(RENDERER_PORT, HOST, () => resolve());
  });
}

async function serveFile({
  rendererDir,
  requestUrl,
  csp,
  res,
}: {
  rendererDir: string;
  requestUrl: string;
  csp: string;
  res: http.ServerResponse;
}): Promise<void> {
  const { pathname } = new URL(requestUrl, RENDERER_ORIGIN);
  const relativePath =
    pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));

  const resolved = path.join(rendererDir, relativePath);
  const relativeToRoot = path.relative(rendererDir, resolved);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    res.writeHead(404).end("Not found");
    return;
  }

  try {
    const data = await fs.readFile(resolved);
    const headers: Record<string, string> = {
      "Content-Type":
        MIME_TYPES[path.extname(resolved)] ?? "application/octet-stream",
    };
    if (relativePath === "index.html") {
      headers["Content-Security-Policy"] = csp;
    }
    res.writeHead(200, headers).end(data);
  } catch {
    res.writeHead(404).end("Not found");
  }
}
