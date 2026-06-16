import {
  ClerkLoaded,
  ClerkLoading,
  ClerkProvider,
  SignedIn,
  SignedOut,
} from "@clerk/clerk-react";
import { Router } from "wouter";
// eslint-disable-next-line import/no-unresolved
import { useHashLocation } from "wouter/use-hash-location";
import { BundlePage } from "@/renderer/pages/bundle";
import { Toaster } from "@/renderer/components/ui/sonner";
import { AuthLoading } from "@/renderer/components/domain/auth/auth-loading";
import { SignInDialog } from "@/renderer/components/domain/auth/sign";
import { SignOutMenuListener } from "@/renderer/components/domain/auth/sign-out-menu-listener";
import { clerk, clerkPublishableKey } from "@/renderer/lib/clerk";

export function App() {
  return (
    <ClerkProvider
      Clerk={clerk}
      publishableKey={clerkPublishableKey}
      standardBrowser={false}
      afterSignOutUrl="/"
    >
      <Router hook={useHashLocation}>
        <div className="h-screen font-mono">
          <ClerkLoading>
            <AuthLoading />
          </ClerkLoading>
          <ClerkLoaded>
            <SignedIn>
              <SignOutMenuListener />
              <BundlePage />
            </SignedIn>
            <SignedOut>
              <SignInDialog />
            </SignedOut>
          </ClerkLoaded>
        </div>
        <Toaster />
      </Router>
    </ClerkProvider>
  );
}

export default App;
