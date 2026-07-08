import { _electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRATCH = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = "/Users/jtakahashi0604/works/andraindrops/memomi";
const BUNDLE = path.join(SCRATCH, "capture-bundle");
const VIDEO_DIR = path.join(SCRATCH, "video");

// Fresh bundle WITHOUT the .seeded marker: first launch seeds the three
// example concepts from example-seed.ts.
fs.rmSync(BUNDLE, { recursive: true, force: true });
fs.rmSync(VIDEO_DIR, { recursive: true, force: true });
fs.mkdirSync(BUNDLE, { recursive: true });

const app = await _electron.launch({
  executablePath: path.join(
    PROJECT,
    "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
  ),
  args: [path.join(PROJECT, ".vite/build/main.js")],
  env: { ...process.env, MEMOMI_BUNDLE_ROOT: BUNDLE },
  recordVideo: { dir: VIDEO_DIR, size: { width: 1200, height: 800 } },
});

const win = await app.firstWindow();
await win.waitForSelector('button[title="New concept"]', { timeout: 20000 });

// Fake cursor overlay so the viewer can follow clicks and drags.
await win.evaluate(() => {
  const cursor = document.createElement("div");
  cursor.id = "fake-cursor";
  Object.assign(cursor.style, {
    position: "fixed",
    left: "0px",
    top: "0px",
    width: "18px",
    height: "18px",
    zIndex: "99999",
    pointerEvents: "none",
    transition: "transform 0.65s cubic-bezier(0.22, 1, 0.36, 1)",
    transform: "translate(600px, 500px)",
  });
  cursor.innerHTML =
    '<svg viewBox="0 0 24 24" width="18" height="18">' +
    '<path d="M5 3l14 8.5-6.5 1.5L10 20z" fill="black" stroke="white" stroke-width="1.5"/></svg>';
  document.body.appendChild(cursor);
  const style = document.createElement("style");
  style.textContent =
    "@keyframes fake-click { from { transform: scale(0.4); opacity: 1; } to { transform: scale(1.6); opacity: 0; } }";
  document.head.appendChild(style);
  window.__moveCursor = (x, y, ms) => {
    if (ms != null) cursor.style.transitionDuration = `${ms}ms`;
    cursor.style.transform = `translate(${x}px, ${y}px)`;
  };
  window.__clickPulse = (x, y) => {
    const pulse = document.createElement("div");
    Object.assign(pulse.style, {
      position: "fixed",
      left: `${x - 14}px`,
      top: `${y - 14}px`,
      width: "28px",
      height: "28px",
      borderRadius: "9999px",
      border: "2px solid rgba(0,0,0,0.45)",
      zIndex: "99998",
      pointerEvents: "none",
      animation: "fake-click 0.45s ease-out forwards",
    });
    document.body.appendChild(pulse);
    setTimeout(() => pulse.remove(), 500);
  };
  // A small chip that follows the cursor during drags, showing what is
  // being dragged.
  window.__showDragChip = (label, x, y) => {
    const chip = document.createElement("div");
    chip.id = "drag-chip";
    Object.assign(chip.style, {
      position: "fixed",
      left: "0px",
      top: "0px",
      zIndex: "99998",
      pointerEvents: "none",
      padding: "2px 8px",
      borderRadius: "6px",
      border: "1px solid rgba(0,0,0,0.2)",
      background: "rgba(255,255,255,0.95)",
      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      font: "11px -apple-system, sans-serif",
      color: "#333",
      transition: "transform 0.65s cubic-bezier(0.22, 1, 0.36, 1)",
      transform: `translate(${x + 14}px, ${y + 10}px)`,
    });
    chip.textContent = label;
    document.body.appendChild(chip);
  };
  window.__moveDragChip = (x, y, ms) => {
    const chip = document.getElementById("drag-chip");
    if (chip == null) return;
    if (ms != null) chip.style.transitionDuration = `${ms}ms`;
    chip.style.transform = `translate(${x + 14}px, ${y + 10}px)`;
  };
  window.__hideDragChip = () => {
    document.getElementById("drag-chip")?.remove();
  };
});

const markers = {};
const clock = () => Date.now();

const moveCursor = (x, y, ms) =>
  win.evaluate(
    ([px, py, pms]) => window.__moveCursor(px, py, pms),
    [x - 4, y - 3, ms ?? null],
  );
const clickPulse = (x, y) =>
  win.evaluate(([px, py]) => window.__clickPulse(px, py), [x, y]);

// Bottom-most rendered editor line, by geometry (monaco reorders DOM nodes).
const lastLineRect = () =>
  win.evaluate(() => {
    let best = null;
    for (const el of document.querySelectorAll(".monaco-editor .view-line")) {
      const r = el.getBoundingClientRect();
      if (best == null || r.top > best.top) best = r;
    }
    return best == null
      ? null
      : { x: best.left, y: best.top, width: best.width, height: best.height };
  });

// Synthetic HTML5 drag from a sidebar row into the editor at (x, y).
// Real DragEvents with a shared DataTransfer, so the app's React
// onDragStart and the editor's capture-phase drop listener both fire.
const dispatchDragStart = (label) =>
  win.evaluate((text) => {
    const rows = [...document.querySelectorAll("aside button")];
    const src = rows.find((b) => b.textContent.trim() === text);
    if (src == null) throw new Error(`sidebar row not found: ${text}`);
    window.__dt = new DataTransfer();
    src.dispatchEvent(
      new DragEvent("dragstart", {
        bubbles: true,
        cancelable: true,
        dataTransfer: window.__dt,
      }),
    );
    window.__dragSrc = src;
  }, label);

const dispatchDrop = (x, y) =>
  win.evaluate(
    ([px, py]) => {
      const target = document.elementFromPoint(px, py);
      const init = {
        bubbles: true,
        cancelable: true,
        clientX: px,
        clientY: py,
        dataTransfer: window.__dt,
      };
      target.dispatchEvent(new DragEvent("dragover", init));
      target.dispatchEvent(new DragEvent("drop", init));
      window.__dragSrc.dispatchEvent(
        new DragEvent("dragend", { bubbles: true, dataTransfer: window.__dt }),
      );
      window.__dt = null;
      window.__dragSrc = null;
    },
    [x, y],
  );

const sidebarRowCenter = (label) =>
  win.evaluate((text) => {
    const rows = [...document.querySelectorAll("aside button")];
    const src = rows.find((b) => b.textContent.trim() === text);
    const r = src.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, label);

async function dragConceptToEditor(label, dropX, dropY) {
  const from = await sidebarRowCenter(label);
  await moveCursor(from.x, from.y, 650);
  await win.waitForTimeout(800);
  await clickPulse(from.x, from.y);
  await dispatchDragStart(label);
  await win.evaluate(
    ([text, x, y]) => window.__showDragChip(text, x, y),
    [label, from.x, from.y],
  );
  await win.waitForTimeout(150);
  markers[`dragStart:${label}`] = clock();
  await moveCursor(dropX, dropY, 950);
  await win.evaluate(
    ([x, y]) => window.__moveDragChip(x, y, 950),
    [dropX, dropY],
  );
  await win.waitForTimeout(1050);
  await win.evaluate(() => window.__hideDragChip());
  await dispatchDrop(dropX, dropY);
  await clickPulse(dropX, dropY);
  markers[`drop:${label}`] = clock();
  await win.waitForTimeout(500);
  await win.keyboard.press("Meta+ArrowDown");
  await win.waitForTimeout(200);
  await win.keyboard.press("Enter");
  markers[`enter:${label}`] = clock();
}

// --- Choreography ---

// Hold the freshly seeded state (three example concepts in the sidebar).
await win.waitForTimeout(1600);

// Open "Example 1".
const ex1 = await sidebarRowCenter("Example 1");
await moveCursor(ex1.x, ex1.y, 650);
await win.waitForTimeout(800);
await clickPulse(ex1.x, ex1.y);
markers.openClick = clock();
await win.evaluate(() => {
  const rows = [...document.querySelectorAll("aside button")];
  rows.find((b) => b.textContent.trim() === "Example 1").click();
});
await win.waitForFunction(
  () => document.querySelectorAll(".monaco-editor .view-line").length >= 8,
  { timeout: 20000 },
);
await win.waitForTimeout(1200);

// Put the caret at the very end of the body and open a fresh empty line,
// so each dropped link lands on its own line.
let line = await lastLineRect();
const endX = line.x + line.width + 12;
const endY = line.y + line.height / 2;
await moveCursor(endX, endY, 650);
await win.waitForTimeout(750);
await clickPulse(endX, endY);
await win.mouse.click(endX, endY);
await win.waitForTimeout(350);
await win.keyboard.press("Meta+ArrowDown");
await win.keyboard.press("Enter");
markers.prepEnter = clock();
await win.waitForTimeout(500);

// Drag Example 2 onto the empty last line, then Example 3.
line = await lastLineRect();
markers.dropLine1 = line;
await dragConceptToEditor("Example 2", line.x + 8, line.y + line.height / 2);
await win.waitForTimeout(700);

line = await lastLineRect();
markers.dropLine2 = line;
await dragConceptToEditor("Example 3", line.x + 8, line.y + line.height / 2);

// Hold so the autosave lands and the result lingers.
await win.waitForTimeout(2400);
markers.close = clock();

const video = win.video();
await app.close();
markers.videoPath = await video.path();

// Verify the links actually landed in the file on disk.
const saved = fs.readFileSync(path.join(BUNDLE, "example-1.md"), "utf8");
markers.savedTail = saved.slice(-220);

fs.writeFileSync(
  path.join(SCRATCH, "markers.json"),
  JSON.stringify(markers, null, 2),
);
console.log(JSON.stringify(markers, null, 2));
