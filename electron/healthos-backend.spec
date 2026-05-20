# -*- mode: python ; coding: utf-8 -*-
#
# PyInstaller spec for the HealthOS backend. Bundles uvicorn + the FastAPI
# app + every Python module the runner reaches into, so Electron can ship
# without requiring `uv` on the host.
#
# Build:  cd electron && uv run pyinstaller healthos-backend.spec --clean
# Output: electron/dist/healthos-backend/  (one-folder bundle)

from PyInstaller.utils.hooks import (
    collect_data_files,
    collect_dynamic_libs,
    collect_submodules,
)
import os

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(SPEC), ".."))

# Modules whose dynamic imports PyInstaller can't see by scanning bytecode.
hiddenimports = []
for pkg in (
    "camel",
    "chromadb",
    "sentence_transformers",
    "mcp",
    "mcp_servers",
    "fastapi",
    "starlette",
    "uvicorn",
    "pypdf",
    "sse_starlette",
):
    hiddenimports += collect_submodules(pkg)

# Bundle pure-Python source for our own packages (so `python -m mcp_servers.health_kb_server`
# style invocations the manager spawns can find them) and the curated KB files.
# Also bundle the built React frontend so backend/server.py's StaticFiles
# mount finds it at `<bundle>/frontend/dist`.
datas = []
datas += [
    (os.path.join(REPO_ROOT, "src"), "src"),
    (os.path.join(REPO_ROOT, "backend"), "backend"),
    (os.path.join(REPO_ROOT, "mcp_servers"), "mcp_servers"),
    (os.path.join(REPO_ROOT, "data"), "data"),
    (os.path.join(REPO_ROOT, "frontend", "dist"), os.path.join("frontend", "dist")),
]
datas += collect_data_files("chromadb")
datas += collect_data_files("sentence_transformers")
datas += collect_data_files("camel")
datas += collect_data_files("mcp")

# Native libs (chromadb / onnxruntime ship .so/.dylib that aren't picked up by default).
binaries = []
binaries += collect_dynamic_libs("chromadb")
binaries += collect_dynamic_libs("onnxruntime")

a = Analysis(
    [os.path.join(REPO_ROOT, "electron", "backend_entry.py")],
    pathex=[REPO_ROOT],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=["tkinter"],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="healthos-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="healthos-backend",
)
