// Minimal IPC bridge. Keep this surface tight — Electron security best
// practice is to expose only the operations the renderer truly needs.

import { contextBridge, ipcRenderer, shell } from "electron";
import * as os from "node:os";
import * as path from "node:path";

contextBridge.exposeInMainWorld("healthos", {
  version: process.versions.electron,
  platform: process.platform,
  dataDir: path.join(os.homedir(), ".healthos"),
  openExternal: (url: string) => shell.openExternal(url),
  openDataDir: () => shell.openPath(path.join(os.homedir(), ".healthos")),
  quit: () => ipcRenderer.send("healthos:quit"),
});
