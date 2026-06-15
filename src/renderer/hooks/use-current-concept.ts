import { useLocation } from "wouter";

const CONCEPT_PREFIX = "/concept/";

export function conceptHref(path: string): string {
  return `${CONCEPT_PREFIX}${encodeURIComponent(path)}`;
}

export function parseCurrentConcept(location: string): string | null {
  if (!location.startsWith(CONCEPT_PREFIX)) return null;
  return decodeURIComponent(location.slice(CONCEPT_PREFIX.length));
}

export function useCurrentConcept(): string | null {
  const [location] = useLocation();
  return parseCurrentConcept(location);
}
