import { Router } from "wouter";
// eslint-disable-next-line import/no-unresolved
import { useHashLocation } from "wouter/use-hash-location";
import { BundlePage } from "@/renderer/pages/bundle";
import { Toaster } from "@/renderer/components/ui/sonner";

export function App() {
  return (
    <Router hook={useHashLocation}>
      <div className="h-screen font-mono">
        <BundlePage />
      </div>
      <Toaster />
    </Router>
  );
}

export default App;
