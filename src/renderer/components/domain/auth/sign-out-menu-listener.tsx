import { useEffect } from "react";
import { useClerk } from "@clerk/clerk-react";
import { api } from "@/renderer/lib/api";
import { clearNativeClerkToken } from "@/renderer/lib/clerk-native-fetch";

export function SignOutMenuListener() {
  const { signOut } = useClerk();
  useEffect(
    () =>
      api.menu.onSignOut(() => {
        void signOut().then(() => clearNativeClerkToken());
      }),
    [signOut],
  );
  return null;
}
