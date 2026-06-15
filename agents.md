# AGENTS.md

## Project Snapshot

- **Product**: Web-based curve digitization and TikZ export tool.
- **Current app state**: Early SvelteKit MVP with a single-page Paper.js canvas workflow.
- **Framework**: SvelteKit 2 with Svelte 5 runes enabled project-wide.
- **Language**: TypeScript.
- **Package manager**: pnpm.
- **Styling**: Tailwind CSS through `@tailwindcss/vite`.
- **Deployment adapter**: Currently `@sveltejs/adapter-vercel`; planned migration to `@sveltejs/adapter-static` for GitHub Pages.
- **Runtime dependencies**: `paper`, `@lucide/svelte`, `svelte-i18n`.
- **Test runner**: Vitest.

The immediate product direction is browser-first. Do not add Electron, Tauri, or other desktop packaging until the web workflow is proven and explicitly requested.

## Current Repository Structure

```text
src/
  components/
    BrushSettings.svelte        # Brush color, pt width, simplify, smoothing, and snap controls.
    CalibrationSettings.svelte  # Unit length input and grid display toggle.
    CanvasWorkspace.svelte      # Canvas element with status overlay and reset-view button.
    CurveListPanel.svelte       # Curve list with multi-selection, delete, and clear actions.
    ExportPanel.svelte          # Export format selector, precision, code output, and download.
    Header.svelte               # App title, language switcher, and image-upload dialog trigger.
    ImageUploadDialog.svelte    # Image selection, drag-and-drop, and clipboard-paste dialog.
    LanguageSwitcher.svelte     # Chinese/English locale switcher.
    ObjectPropertiesPanel.svelte # Shared object-properties UI for image and curve objects.
    Toolbar.svelte              # Move, brush, point, undo, and redo controls.
  routes/
    +layout.svelte       # Imports global CSS and favicon.
    +page.svelte         # Paper.js canvas lifecycle, state management, and component orchestration.
    layout.css           # Tailwind CSS import.

  lib/
    core/
      types.ts           # Explicit geometry, image, tool, and export types.
      coordinate.ts      # Coordinate calibration and canvas/math conversion.
      coordinate.test.ts # Vitest coverage for coordinate conversion.
      exporter.ts        # TikZ formatting and export logic.
      exporter.test.ts   # Vitest coverage for cubic Bezier TikZ export.
      image.ts           # Zoom-aware reference-image keyboard nudge calculations.
      image.test.ts      # Vitest coverage for image keyboard nudge deltas.
      image-import.ts    # Image-file validation and clipboard-file creation helpers.
      image-import.test.ts # Vitest coverage for image import helpers.
    i18n/
      locales/
        en.json          # English UI and status translations.
        zh.json          # Chinese UI and status translations.
    i18n.ts              # svelte-i18n initialization, persistence, and locale helpers.
    i18n.test.ts         # Locale normalization and translation-key consistency tests.
    assets/
      favicon.svg

static/
  robots.txt
```

Generated or environment-specific folders such as `.svelte-kit`, `.vercel`, `.pnpm-store`, and `node_modules` are dependency/build artifacts. Do not edit them manually.

## Current Implementation Notes

The main screen is orchestrated by `src/routes/+page.svelte`, which owns the Paper.js canvas lifecycle and all application state. The UI has been extracted into ten Svelte components under `src/components/`:

- `Header.svelte` — app title bar, language switcher, and image-upload dialog trigger.
- `ImageUploadDialog.svelte` — modal image import through file selection, drag-and-drop, or clipboard paste.
- `LanguageSwitcher.svelte` — Chinese/English locale switching with persisted user selection.
- `Toolbar.svelte` — move/brush/point tool switching and undo/redo buttons (pan label: "移动"; move is the default tool and appears first).
- `BrushSettings.svelte` — brush color, pt-based width, simplify tolerance, automatic smoothing, and snap controls (uses `$bindable` for two-way state binding).
- `CalibrationSettings.svelte` — real unit length input and grid display toggle.
- `CanvasWorkspace.svelte` — canvas element with status overlay and reset-view button (exposes `canvas` and `hostElement` refs via `$bindable`).
- `ObjectPropertiesPanel.svelte` — shared property editor for selected images and curves.
- `CurveListPanel.svelte` — curve list with multi-selection, delete, clear, and select-all actions.
- `ExportPanel.svelte` — export format selector, precision, code output textarea, copy and download buttons.

All components receive state via props and communicate back through callback props or `$bindable` two-way bindings. Business logic (coordinate conversion, export formatting) remains in `src/lib/core`.

## Current Goal Progress

The current implementation direction is to keep building a unified Paper.js object-interaction layer for reference images and curves.

Already implemented for that goal:

- Reference images are selectable objects with move, 8-handle resize, rotation, opacity, lock, fit, and reset-transform actions.
- The image-upload button opens a modal import surface supporting file selection, image drag-and-drop, and `Ctrl+V` clipboard-image paste.
- The UI and operation-status messages are internationalized in Chinese and English. Chinese is the default; an explicit user selection is persisted in `localStorage`.
- Selected unlocked reference images support arrow-key position nudging: 1 screen pixel normally and 10 screen pixels with `Shift`; continuous key repeats are grouped into one undo step.
- Dragging from the body of a locked reference image pans the canvas instead of moving the image. Locked images take hit-test priority over curves underneath for this gesture.
- Selected reference images can be deleted with `Delete` / `Backspace`, with undo/redo support.
- Curves are selectable objects on the canvas, not only in the right-side list.
- A single selected curve exposes editable anchors and Bezier control handles directly on canvas.
- Multiple selected curves support batch color and stroke-width editing.
- Undo/redo now covers object edits and calibration changes, not just brush-created curve insertion.
- UI has been extracted into ten components, including the image-upload dialog and language switcher.
- Grid-point snapping applies to both brush drawing and curve anchor/control-handle dragging, with the same green preview circle and status feedback.
- Closed-path snapping works during curve anchor dragging: dragging the first or last anchor of an open curve near the opposite endpoint snaps and auto-closes the curve, using the same snap radius and green preview circle.
- Image resize handles now include 4 corners and 4 edge midpoints, with hover resize cursors.
- Image rotation is available through a top drag handle above the selected image, with a custom curved-arrow rotate cursor.
- Holding `Shift` while resizing an image preserves the current aspect ratio, including for rotated images.
- A point-by-point tracing mode is available for constructing cubic Bezier paths by successive clicks.
- Point mode supports grid snapping and endpoint close snapping; snapping back to the first point auto-closes the path and exits to move mode.
- Point mode double-click completion uses a 200ms time window only; the finishing click does not add an extra anchor.
- Curve control-handle dragging supports optional vertical/horizontal snapping and adjacent-control-point collinearity snapping, with a shared configurable angle tolerance.
- Angle-based control-point snapping shows a light-green dashed guide line through the anchor, extended to the current viewport edges.
- Brush and curve stroke widths are pt-based. The default stroke width is `0.4pt`, and UI sliders currently cap at `3pt`.
- Distance-based snapping uses a pt-based threshold. The default automatic snap threshold is `15pt`.
- Angle-based snapping uses a separate automatic snap angle slider, defaulting to `10°` with a `5°` to `30°` range.
- Closed-path snapping is enabled by default.
- Side panel width/collapse state and right-panel section height are not persisted in localStorage; refreshes return to fixed defaults.
- The right-side curve list now scrolls vertically when the number of curves exceeds the panel height.

Still remaining for that goal:

- Add on-canvas lock toggle and opacity control rendered as Paper.js graphics at the image top-right corner.
- Richer multi-curve editing affordances beyond batch styling and single-curve handle editing.
- Project save/load for image, curves, and calibration state.
- A more deliberate responsive pass once the object model settles.
- Shared stores in `src/stores.ts` to further reduce `+page.svelte` responsibility.

## Product Requirement

Build a focused curve digitization tool, not a general design application. The target workflow is:

1. Upload a reference image.
2. Place the image on a browser canvas.
3. Draw or trace curves with a brush or path tool.
4. Convert freehand strokes into editable cubic Bezier segments.
5. Let the user set the coordinate origin.
6. Let the user set coordinate unit length by horizontally dragging the visible unit-vector point and assigning a real coordinate distance.
7. Convert canvas coordinates into calibrated mathematical coordinates.
8. Export selected curves as path code.

Keep the x-axis horizontal and the y-axis vertical for the first version.

## MVP Scope

Already present in some form:

- Browser image upload for common image formats through file selection, drag-and-drop, and clipboard paste.
- Canvas workspace with pan and zoom.
- Reference image display with opacity control and top-layer rendering for tracing and point picking.
- Freehand vector brush backed by Paper.js path data.
- Optional Paper.js smoothing and configurable simplification.
- Internal cubic Bezier segment data.
- Coordinate origin selection.
- Horizontal unit length calibration.
- TikZ export using `.. controls .. and ..`.
- TikZ export keeps `\draw[...]` and the start coordinate on the same line.
- LuaDraw export using `g:Dbezier(...)` for open paths.
- CeTZ export using `bezier(...)`.
- Export precision setting.
- Multi-selected-curve export behavior.
- Undo/redo for drawing, curve edits, image edits, and calibration updates.
- Closed-path snapping by endpoint proximity.
- Closed-path snap preview indicator while drawing.
- Grid-point snapping to calibrated integer coordinate intersections.
- Local persistence for brush post-processing and snap settings, excluding side-panel layout.
- Reference image object selection, movement, 8-handle resizing, rotation, opacity control, locking, fit-to-canvas, and reset-transform actions.
- Equal-aspect image resize with `Shift` modifier.
- Arrow-key position nudging for selected unlocked reference images, with `Shift` acceleration and undo grouping.
- Canvas panning from the body of a locked reference image.
- Keyboard deletion of the selected reference image.
- Canvas click selection for curve objects.
- Single-curve anchor and control-handle editing on canvas.
- Batch stroke-color and stroke-width editing for multiple selected curves.
- Point-by-point cubic path construction mode with double-click completion.
- Point mode closed-path snapping to the first point.
- Point mode double-click completion uses a 200ms time window and does not add the second click as an extra anchor.
- Pt-based stroke-width editing and export (`0.4pt` default, `3pt` UI slider maximum).
- Pt-based distance snap threshold (`15pt` default).
- Configurable angle snap tolerance (`10°` default, `5°` to `30°`).
- Optional vertical/horizontal control-point snapping with a light-green viewport-spanning dashed guide line.
- Optional adjacent-control-point collinearity snapping with the same light-green guide line.
- Right-side curve list vertical scrolling for large curve counts.

Still incomplete or not yet implemented:

- On-canvas image controls: lock toggle and opacity indicator as Paper.js graphics on the selection overlay.
- Shared stores in `src/stores.ts`.
- Web Worker processing under `src/lib/workers`.
- API routes under `src/routes/api`.
- LLM provider abstraction under `src/lib/llm`.
- Full project save/load.
- Dedicated responsive cleanup for very short viewport heights.
- Multi-curve canvas edit affordances beyond the current single-curve handle editor.

Defer until the core workflow is stable:

- Automatic curve extraction from uploaded images.
- Automatic coordinate axis detection.
- PDF import.
- Drag-and-drop layer sorting.
- AI-assisted image or curve interpretation.
- Desktop packaging.

## Architecture Rules

- Keep product-specific geometry and export behavior in `src/lib/core`.
- Keep Svelte components focused on UI composition and browser interaction.
- Do not make export formatting depend on Svelte component state or Paper.js object instances.
- Preserve the explicit internal data model in `src/lib/core/types.ts`.
- Treat Paper.js as the canvas/vector editing runtime, not as the only source of product state.
- Put expensive browser-side processing in Web Workers when it becomes heavy enough to affect UI responsiveness.
- Put protected API key usage and server-only integration code under SvelteKit API routes.
- Snap-preview overlays for in-progress drawing should stay transient in the Paper.js scene and must not mutate persisted curve data before commit.
- The snap-preview circle must use the same screen-pixel threshold mapped into project coordinates as the actual closed-path snapping logic.
- Grid-point snapping must use the same threshold radius and preview-circle style as closed-path snapping.
- If both grid snapping and closed-path snapping are eligible during brush drawing, grid-point snapping currently takes precedence for the live sampled point and preview.
- Distance-based snap threshold and angle-based snap tolerance are separate controls; do not reuse the distance threshold for control-point angle snapping.
- Control-point angle snap previews should remain transient Paper.js preview-layer graphics and must not mutate stored curve data beyond the committed dragged handle position.
- Reference images should remain on their own Paper.js layer and stay visually above curves and calibration graphics.
- Locked reference images must not move through pointer dragging or arrow-key nudging; dragging their body in move mode pans the canvas.
- Image import sources should normalize to a validated image `File` before calling the shared Paper.js image-loading path.

Core geometry types currently include:

```ts
type Point = {
	x: number;
	y: number;
};

type CubicBezierSegment = {
	start: Point;
	control1: Point;
	control2: Point;
	end: Point;
};

type CurvePath = {
	id: string;
	name: string;
	segments: CubicBezierSegment[];
	stroke: string;
	strokeWidth: number;
	closed: boolean;
};

type CoordinateSystem = {
	originCanvas: Point;
	xAxisPoint: Point;
	yAxisPoint?: Point;
	unitCanvasLength: number;
	unitRealLength: number;
};
```

`CanvasImage` currently has: `id, name, src, x, y, width, height, rotation, opacity, locked`.

## GitHub Pages Deployment Plan

The deployed product should remain a fully browser-side static application. The current feature set does not require SvelteKit API routes, server-side LLM calls, secret API keys, a database, or server-side user storage. Do not introduce a backend solely for deployment.

Target repository and site:

- GitHub repository: `Explorer-cc/bezier-digitization`.
- Deployment branch: `main`.
- Expected project-site URL: `https://explorer-cc.github.io/bezier-digitization/`.
- Build artifact directory: `build/`.
- GitHub Pages publishing source: GitHub Actions.

The following work is still required before the first deployment:

1. Replace the Vercel adapter with the static adapter:

   ```powershell
   pnpm remove @sveltejs/adapter-vercel --store-dir .pnpm-store
   pnpm add -D @sveltejs/adapter-static --store-dir .pnpm-store
   ```

2. Update `svelte.config.js`:

   - Import `@sveltejs/adapter-static` instead of `@sveltejs/adapter-vercel`.
   - Configure `pages: 'build'` and `assets: 'build'`.
   - Generate `404.html` as the fallback so future client-side routes can still load through GitHub Pages.
   - Configure `kit.paths.base` from `process.env.BASE_PATH`, defaulting to an empty string for local development.
   - Keep the existing project-wide Svelte 5 runes configuration.

   Intended configuration shape:

   ```js
   import adapter from '@sveltejs/adapter-static';

   /** @type {import('@sveltejs/kit').Config} */
   const config = {
     compilerOptions: {
       runes: ({ filename }) =>
         filename.split(/[/\\]/).includes('node_modules') ? undefined : true
     },
     kit: {
       adapter: adapter({
         pages: 'build',
         assets: 'build',
         fallback: '404.html'
       }),
       paths: {
         base: process.env.BASE_PATH ?? ''
       }
     }
   };

   export default config;
   ```

3. Add a `packageManager` field to `package.json` so CI uses the same pnpm major version as local development, currently `pnpm@11.4.0`.

4. Add `.github/workflows/deploy.yml` with these jobs and gates:

   - Trigger on pushes to `main` and manual `workflow_dispatch` runs.
   - Grant `contents: read`, `pages: write`, and `id-token: write` permissions.
   - Check out the repository.
   - Install pnpm and Node.js 22 with pnpm dependency caching.
   - Run `pnpm install --frozen-lockfile`.
   - Run `pnpm check` and `pnpm test` before deployment.
   - Build with `BASE_PATH=/${{ github.event.repository.name }}`.
   - Upload `build/` using `actions/upload-pages-artifact`.
   - Deploy the uploaded artifact using `actions/deploy-pages` in a separate `deploy` job.
   - Use a Pages concurrency group so a newer deployment supersedes an older in-progress deployment.

5. In the GitHub repository settings, open `Settings > Pages` and set the publishing source to `GitHub Actions`.

6. Replace the generated starter `README.md` with project-specific documentation before or alongside the first public deployment. Include the live Pages URL, local development commands, supported import methods, and export formats.

Local deployment verification must be completed before pushing the workflow:

```powershell
$env:BASE_PATH='/bezier-digitization'
pnpm check
pnpm test
pnpm build
pnpm preview
```

Verify all of the following:

- `build/index.html` exists.
- `build/404.html` exists.
- The application loads under `/bezier-digitization/`, not only at `/`.
- JavaScript, CSS, favicon, and other generated assets do not return 404 responses.
- Image file selection, drag-and-drop, and clipboard paste still work over HTTPS.
- Paper.js editing, localStorage settings, copy, and download behavior still work.
- A refresh at the deployed project URL loads the application successfully.
- No API route, server secret, database, or runtime server process is required.

After the workflow succeeds, the expected site URL is:

```text
https://explorer-cc.github.io/bezier-digitization/
```

GitHub Pages is a deliberate deployment constraint for the current product. If a future feature requires protected server execution or persistent cloud data, deploy that backend separately rather than embedding secrets or server assumptions into the static Pages build.

## Dependency Policy

Install project dependencies locally and keep them in `package.json`. `pnpm` itself may be global, but application libraries must not be installed globally.

Use the project-local pnpm store consistently:

```powershell
pnpm install --store-dir .pnpm-store
pnpm add <package> --store-dir .pnpm-store
pnpm remove <package> --store-dir .pnpm-store
```

Do not install `@types/paper`; `paper` provides its own type definitions.

Optional dependencies should be added only when the feature actually needs them:

- PDF processing: `pdf-lib`, `pdfjs-dist`.
- Drag-and-drop upload: `svelte-file-dropzone`.
- Drag-and-drop sorting: `svelte-dnd-action`.
- LLM JSON repair or normalization: `jsonrepair`.
- Object-based canvas editing: `fabric`.
- Bitmap tracing or automatic curve extraction: Potrace-compatible library or WASM tracing library.

## Development Commands

Use pnpm scripts from `package.json`:

```powershell
pnpm install --store-dir .pnpm-store
pnpm dev
pnpm check
pnpm lint
pnpm test
pnpm build
```

Preferred Codex dev-server command:

```powershell
pnpm dev --host 127.0.0.1 --port 5189 --strictPort
```

Do not insert a standalone `--` after `pnpm dev` in this repository. It is forwarded to Vite as an argument and can cause the requested host and port options to be ignored.

Before finishing non-trivial code changes, run the narrowest relevant command first, then broader checks when practical. For core geometry/export changes, run `pnpm test` at minimum.

## Coding Guidance

- Follow the existing TypeScript and Svelte style.
- Svelte 5 runes are enabled by `svelte.config.js`; new app code should be compatible with that mode.
- Use `@lucide/svelte` for UI icons instead of hand-written SVG icons when an icon exists.
- Keep Chinese and English translation catalogs synchronized when adding or changing user-visible text.
- Keep UI text concise and workflow-oriented.
- Avoid turning the tool into a generic editor; prioritize reference image, calibration, tracing, Bezier editing, and TikZ export.
- When changing coordinate conversion or exporter behavior, add or update Vitest tests in `src/lib/core`.
- When changing closed-path snapping, keep the behavior symmetric between canvas state and all export formats.
- If adding snap previews, prefer lightweight Paper.js overlay state instead of mutating stored curve data before commit.
- If adding the snap-preview circle, use the same threshold value that drives actual snapping so the preview remains trustworthy.
- Do not reintroduce side-panel layout persistence without an explicit request; the current behavior intentionally resets side panel layout on refresh.
- Keep generated files, dependency folders, and build outputs out of manual edits.
