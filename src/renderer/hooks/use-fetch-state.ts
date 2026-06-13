import { useEffect, useState } from "react";

export type FetchState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; value: T };

export function useFetchState<T>({
  loader,
  errorMessage,
}: {
  loader: () => Promise<T>;
  errorMessage: string;
}): {
  state: FetchState<T>;
} {
  const [state, setState] = useState<FetchState<T>>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loader();
        if (!cancelled) setState({ status: "loaded", value: data });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : errorMessage,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loader, errorMessage]);

  return { state };
}
