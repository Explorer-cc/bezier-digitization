# AGENTS.md

## Project Snapshot

- **Product**: Web-based curve digitization and TikZ export tool.
- **Current app state**: Early SvelteKit MVP with a single-page Paper.js canvas workflow.
- **Framework**: SvelteKit 2 with Svelte 5 runes enabled project-wide.
- **Language**: TypeScript.
- **Package manager**: pnpm.
- **Styling**: Tailwind CSS through `@tailwindcss/vite`.
- **Deployment adapter**: `@sveltejs/adapter-vercel`.
- **Runtime dependencies**: `paper`, `@lucide/svelte`, `svelte-i18n`.
- **Test runner**: Vitest.

The immediate product direction is browser-first. Do not add Electron, Tauri, or other desktop packaging until the web workflow is proven and explicitly requested.

## Current Repository Structure

```text
src/
  components/
    BrushSettings.svelte        # Brush color, width, simplify, smoothing, and snap controls.
    CalibrationSettings.svelte  # Unit length input and grid display toggle.
    CanvasWorkspace.svelte      # Canvas element with status overlay and reset-view button.
    CurveListPanel.svelte       # Curve list with multi-selection, delete, and clear actions.
    ExportPanel.svelte          # Export format selector, precision, code output, and download.
    Header.svelte               # App title, image upload button, and copy-export button.
    ObjectPropertiesPanel.svelte # Shared object-properties UI for image and curve objects.
    Toolbar.svelte              # Tool mode buttons and undo/redo controls.
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
    assets/
      favicon.svg

static/
  robots.txt
```

Generated or environment-specific folders such as `.svelte-kit`, `.vercel`, `.pnpm-store`, and `node_modules` are dependency/build artifacts. Do not edit them manually.

## Current Implementation Notes

The main screen is orchestrated by `src/routes/+page.svelte`, which owns the Paper.js canvas lifecycle and all application state. The UI has been extracted into eight Svelte components under `src/components/`:

- `Header.svelte` — app title bar, image upload, and copy-export button.
- `Toolbar.svelte` — brush/pan tool switching and undo/redo buttons.
- `BrushSettings.svelte` — brush color, width, simplify tolerance, smoothing, and all snap controls (uses `$bindable` for two-way state binding).
- `CalibrationSettings.svelte` — real unit length input and grid display toggle.
- `CanvasWorkspace.svelte` — canvas element with status overlay and reset-view button (exposes `canvas` and `hostElement` refs via `$bindable`).
- `ObjectPropertiesPanel.svelte` — shared property editor for selected images and curves.
- `CurveListPanel.svelte` — curve list with multi-selection, delete, clear, and select-all actions.
- `ExportPanel.svelte` — export format selector, precision, code output textarea, and download button.

All components receive state via props and communicate back through callback props or `$bindable` two-way bindings. Business logic (coordinate conversion, export formatting) remains in `src/lib/core`.

## Current Goal Progress

The current implementation direction is to keep building a unified Paper.js object-interaction layer for reference images and curves.

Already implemented for that goal:

- Reference images are selectable objects with move, resize, opacity, lock, fit, and reset-transform actions.
- Curves are selectable objects on the canvas, not only in the right-side list.
- A single selected curve exposes editable anchors and Bezier control handles directly on canvas.
- Multiple selected curves support batch color and stroke-width editing.
- Undo/redo now covers object edits and calibration changes, not just brush-created curve insertion.
- UI has been extracted into eight components: Header, Toolbar, BrushSettings, CalibrationSettings, CanvasWorkspace, ObjectPropertiesPanel, CurveListPanel, ExportPanel.

Still remaining for that goal:

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

- Browser image upload for common image formats.
- Canvas workspace with pan and zoom.
- Reference image display with opacity control and top-layer rendering for tracing and point picking.
- Freehand vector brush backed by Paper.js path data.
- Optional Paper.js smoothing and configurable simplification.
- Internal cubic Bezier segment data.
- Coordinate origin selection.
- Horizontal unit length calibration.
- TikZ export using `.. controls .. and ..`.
- LuaDraw export using `g:Dbezier(...)` for open paths.
- CeTZ export using `bezier(...)`.
- Export precision setting.
- Multi-selected-curve export behavior.
- Undo/redo for drawing, curve edits, image edits, and calibration updates.
- Closed-path snapping by endpoint proximity.
- Closed-path snap preview indicator while drawing.
- Grid-point snapping to calibrated integer coordinate intersections.
- Local persistence for brush post-processing and snap settings.
- Reference image object selection, movement, corner-handle resizing, opacity control, locking, fit-to-canvas, and reset-transform actions.
- Canvas click selection for curve objects.
- Single-curve anchor and control-handle editing on canvas.
- Batch stroke-color and stroke-width editing for multiple selected curves.

Still incomplete or not yet implemented:

- Shared stores in `src/stores.ts`.
- Web Worker processing under `src/lib/workers`.
- API routes under `src/routes/api`.
- LLM provider abstraction under `src/lib/llm`.
- Internationalized locale files despite `svelte-i18n` being installed.
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
- Reference images should remain on their own Paper.js layer and stay visually above curves and calibration graphics.

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

Before finishing non-trivial code changes, run the narrowest relevant command first, then broader checks when practical. For core geometry/export changes, run `pnpm test` at minimum.

## Coding Guidance

- Follow the existing TypeScript and Svelte style.
- Svelte 5 runes are enabled by `svelte.config.js`; new app code should be compatible with that mode.
- Use `@lucide/svelte` for UI icons instead of hand-written SVG icons when an icon exists.
- Keep UI text concise and workflow-oriented.
- Avoid turning the tool into a generic editor; prioritize reference image, calibration, tracing, Bezier editing, and TikZ export.
- When changing coordinate conversion or exporter behavior, add or update Vitest tests in `src/lib/core`.
- When changing closed-path snapping, keep the behavior symmetric between canvas state and all export formats.
- If adding snap previews, prefer lightweight Paper.js overlay state instead of mutating stored curve data before commit.
- If adding the snap-preview circle, use the same threshold value that drives actual snapping so the preview remains trustworthy.
- Keep generated files, dependency folders, and build outputs out of manual edits.
