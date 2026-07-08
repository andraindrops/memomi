import { randomUUID } from "node:crypto";
// Playwright is not a project dependency; point PLAYWRIGHT_DIR at a
// node_modules that has playwright 1.61.x installed.
const PLAYWRIGHT_DIR =
  process.env.PLAYWRIGHT_DIR ??
  "/private/tmp/claude-501/-Users-jtakahashi0604-works-andraindrops-memomi/eb8c1eaa-f6a4-4768-9a3c-2377d9d1d157/scratchpad/node_modules";
const { _electron } = await import(`${PLAYWRIGHT_DIR}/playwright/index.mjs`);
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRATCH = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = "/Users/jtakahashi0604/works/andraindrops/memomi";
const BUNDLE = path.join(SCRATCH, "capture-bundle");
const VIDEO_DIR = path.join(SCRATCH, "video");

// Dedicated demo bundle: a few realistic memos plus the .seeded marker so the
// first-launch examples never appear. Concepts are [uuid].md with the display
// title in frontmatter.
fs.rmSync(BUNDLE, { recursive: true, force: true });
fs.rmSync(VIDEO_DIR, { recursive: true, force: true });
fs.mkdirSync(BUNDLE, { recursive: true });
fs.writeFileSync(path.join(BUNDLE, ".seeded"), "");

const demoConcept = ({ title, description, body }) => `---
type: Concept
title: ${title}
description: "${description}"
resource: ""
tags: []
---

${body}
`;

for (const memo of [
  {
    title: "Reading list",
    description: "Books and articles to get to.",
    body: "# Reading list\n\n* The Mythical Man-Month\n* Thinking in Systems\n* How to Take Smart Notes",
  },
  {
    title: "Meeting notes",
    description: "Running notes from weekly syncs.",
    body: "# Meeting notes\n\n## 2026-07-06\n\n* Shipped the new capture pipeline\n* Next: polish the landing page",
  },
  {
    title: "Ideas",
    description: "Loose ideas worth revisiting.",
    body: "# Ideas\n\n* Quick-capture from the menu bar\n* Publish a bundle as a static site",
  },
]) {
  fs.writeFileSync(path.join(BUNDLE, `${randomUUID()}.md`), demoConcept(memo));
}

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

// Fake cursor overlay so the viewer can follow clicks.
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
  // Full-screen black flash used as a wallclock→video-time sync marker; the
  // final cut is trimmed to start right after it.
  window.__flash = () => {
    const flash = document.createElement("div");
    Object.assign(flash.style, {
      position: "fixed",
      inset: "0",
      background: "black",
      zIndex: "100000",
    });
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 200);
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

// --- Choreography ---

// Sync flash, then hold the opening full view.
await win.waitForTimeout(600);
markers.flash = clock();
await win.evaluate(() => window.__flash());
await win.waitForTimeout(1600);

// | camera | zoom into the menu (sidebar header with the New concept button).
markers.zoomMenu = clock();
await win.waitForTimeout(1000);

// Create a new concept from the menu.
const newButton = win.locator('button[title="New concept"]');
const newButtonBox = await newButton.boundingBox();
markers.newButtonBox = newButtonBox;
const newX = newButtonBox.x + newButtonBox.width / 2;
const newY = newButtonBox.y + newButtonBox.height / 2;
await moveCursor(newX, newY, 650);
await win.waitForTimeout(800);
await clickPulse(newX, newY);
markers.createClick = clock();
await newButton.click();

// Wait for the editor and grab the first-line geometry.
await win.waitForSelector(".monaco-editor .view-line", { timeout: 20000 });
const lineBox = await win
  .locator(".monaco-editor .view-line")
  .first()
  .boundingBox();
markers.lineBox = lineBox;
await win.waitForTimeout(900);

// | camera | pan focus over to the text area.
markers.zoomText = clock();
await win.waitForTimeout(1100);

// Click into the editor and replace the placeholder with the demo sentence.
const caretX = lineBox.x + 8;
const caretY = lineBox.y + lineBox.height / 2;
await moveCursor(caretX, caretY, 650);
await win.waitForTimeout(800);
await clickPulse(caretX, caretY);
await win.mouse.click(caretX, caretY);
await win.waitForTimeout(400);
await win.evaluate(() => {
  document.getElementById("fake-cursor").style.opacity = "0";
});
await win.keyboard.press("Meta+a");
await win.waitForTimeout(350);
markers.typeStart = clock();
await win.keyboard.type(
  "memomi is an open-source memo app built on the Open Knowledge Format.",
  { delay: 60 },
);
markers.typeEnd = clock();

// Wait 3 seconds (autosave lands, sentence lingers).
await win.waitForTimeout(3000);

// | camera | zoom back out for the metadata panel.
markers.zoomOut = clock();
await win.waitForTimeout(1000);

// Open the metadata inspector.
await win.evaluate(() => {
  document.getElementById("fake-cursor").style.opacity = "1";
});
const settingsButton = win.locator(
  'button[aria-label="Toggle metadata inspector"]',
);
const settingsBox = await settingsButton.boundingBox();
markers.settingsBox = settingsBox;
const setX = settingsBox.x + settingsBox.width / 2;
const setY = settingsBox.y + settingsBox.height / 2;
await moveCursor(setX, setY, 650);
await win.waitForTimeout(800);
await clickPulse(setX, setY);
markers.inspectorClick = clock();
await settingsButton.click();
await win.waitForSelector('button[aria-label="Close inspector"]', {
  timeout: 10000,
});

// Hold on the metadata panel.
await win.waitForTimeout(2800);
markers.close = clock();

const video = win.video();
await app.close();
markers.videoPath = await video.path();

// Verify the typed sentence actually landed on disk.
const savedFiles = fs
  .readdirSync(BUNDLE)
  .filter((name) => name.endsWith(".md"));
markers.savedMatch = savedFiles.some((name) =>
  fs
    .readFileSync(path.join(BUNDLE, name), "utf8")
    .includes("memomi is an open-source memo app"),
);

fs.writeFileSync(
  path.join(SCRATCH, "markers.json"),
  JSON.stringify(markers, null, 2),
);
console.log(JSON.stringify(markers, null, 2));
