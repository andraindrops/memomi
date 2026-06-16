// A single drag payload shared by every sidebar tree node. Both drop targets
// read the same MIME: the markdown editor inserts a link from it, while the
// sidebar uses it to reorder siblings.
export const NODE_DRAG_MIME = "application/x-okf-node";

export interface NodeDragPayload {
  path: string;
  name: string;
  parentPath: string;
}

// The drag's payload is also kept in a module-level ref because the HTML drag
// API only exposes `dataTransfer` contents on drop, not during `dragover` —
// the sidebar needs the parent path mid-drag to decide whether to accept.
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
