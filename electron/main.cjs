const { app, BrowserWindow, ipcMain, session } = require("electron");
const path = require("node:path");

const isDevServer = Boolean(process.env.ELECTRON_RENDERER_URL);

function configureMidiPermissions() {
  const defaultSession = session.defaultSession;

  defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === "midi" || permission === "midiSysex");
  });

  defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return permission === "midi" || permission === "midiSysex";
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 720,
    title: "APC Color Controller",
    backgroundColor: "#15171b",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDevServer) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  configureMidiPermissions();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

ipcMain.handle("app:quit", () => {
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
