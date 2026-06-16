import { Clerk } from "@clerk/clerk-js/no-rhc";
import { installNativeClerkFetch } from "@/renderer/lib/clerk-native-fetch";
import { frontendApiOrigin } from "@/shared/clerk-config";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (publishableKey == null) {
  throw new Error("VITE_CLERK_PUBLISHABLE_KEY is not set.");
}

installNativeClerkFetch({
  frontendApiOrigin: frontendApiOrigin({ publishableKey }),
});

export const clerkPublishableKey = publishableKey;

export const clerk = new Clerk(publishableKey);
