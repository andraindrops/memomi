import { CLERK_TOKEN_KEY } from "@/shared/clerk-config";

function readToken(): string {
  try {
    return localStorage.getItem(CLERK_TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeToken(token: string): void {
  try {
    localStorage.setItem(CLERK_TOKEN_KEY, token);
  } catch {}
}

let clientJwt = readToken();
let installed = false;

export function installNativeClerkFetch({
  frontendApiOrigin,
}: {
  frontendApiOrigin: string;
}): void {
  if (installed) return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    if (!rawUrl.startsWith(frontendApiOrigin)) {
      return originalFetch(input, init);
    }

    const request = new Request(input as RequestInfo, init);
    const url = new URL(request.url);
    url.searchParams.set("_is_native", "1");

    const headers = new Headers(request.headers);
    headers.set("Authorization", clientJwt);

    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    const body = hasBody ? await request.clone().arrayBuffer() : undefined;

    const response = await originalFetch(url.href, {
      method: request.method,
      headers,
      body,
      credentials: "omit",
    });

    const rotated = response.headers.get("Authorization");
    if (rotated != null) {
      clientJwt = rotated;
      writeToken(rotated);
    }
    return response;
  };
}

export function clearNativeClerkToken(): void {
  clientJwt = "";
  try {
    localStorage.removeItem(CLERK_TOKEN_KEY);
  } catch {}
}
