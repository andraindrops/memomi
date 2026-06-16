import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export function AuthLoading() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
      <p>Checking your session…</p>
      {slow && (
        <p className="max-w-xs text-center text-sm">
          Still connecting. Check your network, and that this app&apos;s origin
          is allow-listed in your Clerk instance.
        </p>
      )}
    </div>
  );
}
