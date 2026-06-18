// Headless screenshot generator for the README/docs.
// Loads the built renderer in a hidden Electron window (fresh userData so it
// shows clean defaults), switches modes, and captures each one to docs/screenshots.
const { app, BrowserWindow, session } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "apc-shot-")));

const OUT = path.join(__dirname, "..", "docs", "screenshots");
fs.mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) =>
    cb(permission === "midi" || permission === "midiSysex"),
  );
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === "midi" || permission === "midiSysex");

  const win = new BrowserWindow({
    width: 1320,
    height: 880,
    show: false,
    backgroundColor: "#0a0c0f",
    webPreferences: {
      preload: path.join(__dirname, "..", "electron", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });
  win.webContents.setBackgroundThrottling(false);

  await win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  await wait(1600);

  const shots = [
    { name: "design", index: 0, settle: 700 },
    { name: "animation", index: 1, settle: 1600 },
    { name: "reactive", index: 2, settle: 800 },
  ];

  for (const shot of shots) {
    const clicked = await win.webContents.executeJavaScript(
      `(() => { const b = document.querySelectorAll('.topBar .segmented button'); if (b[${shot.index}]) { b[${shot.index}].click(); return true; } return false; })()`,
    );
    await wait(shot.settle);
    const image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, `${shot.name}.png`), image.toPNG());
    console.log(`saved ${shot.name}.png (mode click: ${clicked})`);
  }

  app.quit();
}

app.whenReady().then(run).catch((error) => {
  console.error(error);
  app.exit(1);
});
