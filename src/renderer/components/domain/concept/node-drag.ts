export const NODE_DRAG_MIME = "application/x-okf-node";

export interface NodeDragPayload {
  path: string;
  name: string;
  title: string;
  parentPath: string;
}

let activeDrag: NodeDragPayload | null = null;

export function setActiveNodeDrag(payload: NodeDragPayload): void {
  activeDrag = payload;
}

export function getActiveNodeDrag(): NodeDragPayload | null {
  return activeDrag;
}

export function clearActiveNodeDrag(): void {
  activeDrag = null;
}
