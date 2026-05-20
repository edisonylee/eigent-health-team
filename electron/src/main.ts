// HealthOS desktop shell.
//
// Spawns the FastAPI backend as a child process and opens a BrowserWindow
// pointed at it. Backend is launched via `uv run uvicorn`; for v2 we
// assume `uv` is on PATH. PyInstaller bundling for end-user distribution
// is a v3 concern.

import { BrowserWindow, app, globalShortcut } from "electron";
import { ChildProcess, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import { setupTray } from "./tray";

const BACKEND_PORT = 8765;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const REPO_ROOT = path.resolve(__dirname, "..", "..");

let mainWindow: BrowserWindow | null = null;
let backend: ChildProcess | null = null;

function waitForBackend(url: string, timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      http
        .get(url + "/api/health", (res) => {
          if (res.statusCode === 200) return resolve();
          if (Date.now() - start > timeoutMs)
            return reject(new Error("Backend health timeout."));
          setTimeout(tick, 400);
        })
        .on("error", () => {
          if (Date.now() - start > timeoutMs)
            return reject(new Error("Backend never started."));
          setTimeout(tick, 400);
        });
    };
    tick();
  });
}

function findBundledBackend(): string | null {
  // Packaged: electron-builder copies extraResources to process.resourcesPath.
  // Dev with a local pyinstaller build: electron/dist/healthos-backend/.
  const candidates = [
    path.join(process.resourcesPath, "healthos-backend", "healthos-backend"),
    path.join(__dirname, "..", "dist", "healthos-backend", "healthos-backend"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function spawnBackend() {
  const bundled = findBundledBackend();
  const env = { ...process.env, HEALTHOS_PORT: String(BACKEND_PORT) };

  if (bundled) {
    backend = spawn(bundled, [], {
      cwd: path.dirname(bundled),
      stdio: ["ignore", "inherit", "inherit"],
      env,
    });
  } else {
    // Dev fallback — assume `uv` on PATH + repo on disk.
    backend = spawn(
      "uv",
      [
        "run",
        "uvicorn",
        "backend.server:app",
        "--port",
        String(BACKEND_PORT),
        "--log-level",
        "warning",
      ],
      {
        cwd: REPO_ROOT,
        stdio: ["ignore", "inherit", "inherit"],
        env,
      },
    );
  }
  backend.on("exit", (code) => {
    console.log(`[backend] exited with code ${code}`);
    if (mainWindow) app.quit();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 880,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#f5f5f4",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  try {
    await waitForBackend(BACKEND_URL);
  } catch (e) {
    console.error("[backend]", e);
  }
  await mainWindow.loadURL(BACKEND_URL);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  spawnBackend();
  await createWindow();
  setupTray(() => mainWindow);

  globalShortcut.register("CommandOrControl+Shift+H", () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) mainWindow.hide();
    else mainWindow.show();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  if (backend && !backend.killed) {
    backend.kill();
  }
});
