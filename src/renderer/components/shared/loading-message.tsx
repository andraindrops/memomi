interface LoadingMessageProps {
  label?: string;
}

export function LoadingMessage({ label = "Loading…" }: LoadingMessageProps) {
  return <p className="text-muted-foreground">{label}</p>;
}
