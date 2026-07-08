import { _electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRATCH = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = "/Users/jtakahashi0604/works/andraindrops/memomi";
const BUNDLE = path.join(SCRATCH, "capture-bundle");
const VIDEO_DIR = path.join(SCRATCH, "video");

// Fresh, genuinely empty bundle. The .seeded marker suppresses the
// first-launch example concepts, so the sidebar starts blank.
fs.rmSync(BUNDLE, { recursive: true, force: true });
fs.rmSync(VIDEO_DIR, { recursive: true, force: true });
fs.mkdirSync(BUNDLE, { recursive: true });
fs.writeFileSync(path.join(BUNDLE, ".seeded"), "");

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

// Fake cursor so the viewer can follow the click.
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
  window.__moveCursor = (x, y) => {
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
    const style = document.createElement("style");
    style.textContent =
      "@keyframes fake-click { from { transform: scale(0.4); opacity: 1; } to { transform: scale(1.6); opacity: 0; } }";
    document.head.appendChild(style);
    document.body.appendChild(pulse);
    setTimeout(() => pulse.remove(), 500);
  };
});

const markers = {};
const clock = () => Date.now();

// Hold the empty state for a moment.
await win.waitForTimeout(1600);

// Move the fake cursor onto the "New concept" button, then click it.
const newButton = win.locator('button[title="New concept"]');
const buttonBox = await newButton.boundingBox();
const clickX = buttonBox.x + buttonBox.width / 2;
const clickY = buttonBox.y + buttonBox.height / 2;
await win.evaluate(
  ([x, y]) => window.__moveCursor(x - 4, y - 3),
  [clickX, clickY],
);
await win.waitForTimeout(750);
await win.evaluate(([x, y]) => window.__clickPulse(x, y), [clickX, clickY]);
markers.createClick = clock();
await newButton.click();

// Wait for the editor and grab the geometry of the first text line.
await win.waitForSelector(".monaco-editor .view-line", { timeout: 20000 });
const editorBox = await win.locator(".monaco-editor").first().boundingBox();
const lineBox = await win
  .locator(".monaco-editor .view-line")
  .first()
  .boundingBox();
markers.editorBox = editorBox;
markers.lineBox = lineBox;

// Park the fake cursor on the first line and click into the editor.
const caretX = lineBox.x + 8;
const caretY = lineBox.y + lineBox.height / 2;
await win.evaluate(
  ([x, y]) => window.__moveCursor(x - 4, y - 3),
  [caretX, caretY],
);
await win.waitForTimeout(900);
await win.evaluate(([x, y]) => window.__clickPulse(x, y), [caretX, caretY]);
await win.mouse.click(caretX, caretY);
await win.waitForTimeout(400);
// Hide the fake cursor while typing so the caret takes over.
await win.evaluate(() => {
  document.getElementById("fake-cursor").style.opacity = "0";
});

// Replace the "Write content here." placeholder with the typed text.
await win.keyboard.press("Meta+a");
await win.waitForTimeout(350);
markers.typeStart = clock();
await win.keyboard.type("hello, world", { delay: 130 });
markers.typeEnd = clock();

// Hold so the autosave (500ms debounce) lands and the final frame lingers.
await win.waitForTimeout(2200);
markers.close = clock();

const video = win.video();
await app.close();
const videoPath = await video.path();

markers.videoPath = videoPath;
fs.writeFileSync(
  path.join(SCRATCH, "markers.json"),
  JSON.stringify(markers, null, 2),
);
console.log(JSON.stringify(markers, null, 2));
