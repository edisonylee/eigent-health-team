# HealthOS desktop shell

Electron wrapper that spawns the FastAPI backend as a child process and
opens it in a BrowserWindow.

## Dev

From `electron/`:

```bash
npm install
npm start   # tsc + electron dist/main.js
```

The shell expects `uv` on `PATH`. It spawns `uv run uvicorn backend.server:app --port 8765`
against the repo root, waits for `/api/health` to respond, then loads
http://localhost:8765 in the window.

Global shortcut: `Cmd/Ctrl + Shift + H` toggles the window.

## Packaging (work-in-progress)

```bash
npm run dist
```

This produces a `.dmg` (macOS) or `.exe` (Windows) but the bundled
package still expects `uv` to be installed on the host. Full
self-contained packaging via PyInstaller + bundled Ollama is a v3 item.
