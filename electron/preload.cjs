const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("apcDesktop", {
  quit: () => ipcRenderer.invoke("app:quit"),
  platform: process.platform,
});
