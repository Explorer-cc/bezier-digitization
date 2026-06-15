# Bezier Digitization

[中文说明](README.zh-CN.md)

Browser-based curve digitization and export tool for tracing reference images into editable cubic Bezier paths.

## Features

- Upload a reference image from file selection, drag-and-drop, or clipboard paste.
- Pan and zoom the canvas while tracing.
- Move, resize, rotate, lock, and adjust opacity for reference images.
- Draw freehand strokes and simplify them into editable cubic Bezier curves.
- Trace point-by-point cubic Bezier paths.
- Edit curve anchors and control handles directly on the canvas.
- Snap to calibrated grid points and nearby path endpoints.
- Set a coordinate origin and horizontal unit length calibration.
- Export selected curves as TikZ, LuaDraw, or CeTZ code.

## Development

Install dependencies with the project-local pnpm store:

```powershell
pnpm install --store-dir .pnpm-store
```

Start the development server:

```powershell
pnpm dev --host 127.0.0.1 --port 5189 --strictPort
```

Run checks and tests:

```powershell
pnpm check
pnpm test
```

Build for production:

```powershell
pnpm build
```

## GitHub Pages Build

This app is deployed as a static SvelteKit site. For a GitHub Pages project path, build with the repository base path:

```powershell
$env:BASE_PATH='/bezier-digitization'
pnpm check
pnpm test
pnpm build
pnpm preview
```

The static build output is written to `build/`. A successful Pages build should include:

- `build/index.html`
- `build/404.html`
- generated assets under `build/_app/`

Deployment is handled by `.github/workflows/deploy.yml` on pushes to `main` and manual workflow runs. In the GitHub repository settings, set `Settings > Pages > Source` to `GitHub Actions`.

## Import Methods

Supported reference-image import methods:

- file picker
- image drag-and-drop
- clipboard paste

Supported image formats depend on browser support for common web image types.

## Export Formats

The export panel currently supports:

- TikZ paths using `.. controls .. and ..`
- LuaDraw `g:Dbezier(...)` output for open paths
- CeTZ `bezier(...)` output

Export precision is configurable in the UI.

## Tech Stack

- SvelteKit 2
- Svelte 5 runes
- TypeScript
- Paper.js
- Tailwind CSS through `@tailwindcss/vite`
- Vitest
- pnpm
