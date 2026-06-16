// prettier-ignore
export const CLERK_TOKEN_KEY    = "memomi:clerk-client-jwt";
// prettier-ignore
export const RENDERER_PORT      = 5173;
// prettier-ignore
export const RENDERER_ORIGIN    = `http://localhost:${RENDERER_PORT}`;
// prettier-ignore
export const RENDERER_INDEX_URL = `${RENDERER_ORIGIN}/`;

export function frontendApiOrigin({
  publishableKey,
}: {
  publishableKey: string;
}): string {
  const base64 = publishableKey.split("_").slice(2).join("_");
  let host = "";
  try {
    host = atob(base64).replace(/\$+$/, "");
  } catch {}
  if (host === "") {
    throw new Error(`Invalid Clerk publishable key: "${publishableKey}".`);
  }
  return `https://${host}`;
}
