import { net, protocol } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function registerImageScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "app",
      privileges: { standard: true, secure: true, supportFetchAPI: true },
    },
  ]);
}

export function registerImageProtocol(uploadsDir: string): void {
  protocol.handle("app", (request) => {
    const { pathname } = new URL(request.url);
    const fileName = path.basename(decodeURIComponent(pathname));
    const filePath = path.join(uploadsDir, fileName);
    return net.fetch(pathToFileURL(filePath).toString());
  });
}
