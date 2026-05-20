// System tray with a tiny menu. Icon path resolves to the system default
// at runtime (a 16x16 black square) — branding assets are a v3 polish item.

import { BrowserWindow, Menu, Tray, app, nativeImage } from "electron";

export function setupTray(getWindow: () => BrowserWindow | null): Tray {
  // 1x1 transparent PNG as a no-icon stand-in. Replace with a real PNG/icns later.
  const empty = nativeImage.createFromBuffer(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  const tray = new Tray(empty);
  tray.setToolTip("HealthOS");

  const menu = Menu.buildFromTemplate([
    {
      label: "Show HealthOS",
      click: () => {
        const w = getWindow();
        if (w) {
          w.show();
          w.focus();
        }
      },
    },
    {
      label: "New check-in",
      click: () => {
        const w = getWindow();
        if (w) {
          w.show();
          w.webContents.loadURL("http://localhost:8765/check-in");
        }
      },
    },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  return tray;
}
