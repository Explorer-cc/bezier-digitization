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
  routes/
    +layout.svelte       # Imports global CSS and favicon.
    +page.svelte         # Current main application UI and Paper.js canvas workflow.
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

The main screen is currently implemented in `src/routes/+page.svelte`. It includes:

- Image upload through a hidden file input and Paper.js `Raster`.
- A Paper.js canvas with zoom via mouse wheel and pan mode.
- Freehand brush drawing converted into simplified and smoothed Paper.js paths.
- Conversion of drawn paths into internal cubic Bezier segment data.
- Curve list, selected-curve highlighting, delete, and clear actions.
- Coordinate origin handle and horizontally constrained unit-length handle.
- Fixed horizontal x-axis and vertical y-axis calibration behavior.
- Grid rendering based on calibrated unit length.
- TikZ export preview, copy, and download.
- Export precision and optional `tikzpicture` wrapper.
- Resizable and collapsible left/right panels persisted in `localStorage`.

The current UI is functional but still monolithic. When adding substantial features, prefer extracting UI-only pieces into `src/components` and keeping business logic in `src/lib/core`.

## Product Requirement

Build a focused curve digitization tool, not a general design application. The target workflow is:

1. Upload a reference image.
2. Place the image on a browser canvas.
3. Draw or trace curves with a brush or path tool.
4. Convert freehand strokes into editable cubic Bezier segments.
5. Let the user set the coordinate origin.
6. Let the user set coordinate unit length by horizontally dragging the visible unit-vector point and assigning a real coordinate distance.
7. Convert canvas coordinates into calibrated mathematical coordinates.
8. Export selected or all curves using TikZ path syntax.

Keep the x-axis horizontal and the y-axis vertical for the first version.

## MVP Scope

Already present in some form:

- Browser image upload for common image formats.
- Canvas workspace with pan and zoom.
- Reference image display with opacity control.
- Freehand vector brush backed by Paper.js path data.
- Paper.js smoothing and simplification.
- Internal cubic Bezier segment data.
- Coordinate origin selection.
- Horizontal unit length calibration.
- TikZ export using `.. controls .. and ..`.
- Export precision setting.
- Basic selected-curve export behavior.

Still incomplete or not yet implemented:

- Dedicated component structure under `src/components`.
- Shared stores in `src/stores.ts`.
- Web Worker processing under `src/lib/workers`.
- API routes under `src/routes/api`.
- LLM provider abstraction under `src/lib/llm`.
- Editable Bezier handles after stroke creation.
- Reference image move/scale controls. The `locked` state exists in UI data but does not yet drive image interaction.
- Internationalized locale files despite `svelte-i18n` being installed.

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
- Do not make TikZ formatting depend on Svelte component state or Paper.js object instances.
- Preserve the explicit internal data model in `src/lib/core/types.ts`.
- Treat Paper.js as the canvas/vector editing runtime, not as the only source of product state.
- Put expensive browser-side processing in Web Workers when it becomes heavy enough to affect UI responsiveness.
- Put protected API key usage and server-only integration code under SvelteKit API routes.

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
- Keep generated files, dependency folders, and build outputs out of manual edits.
