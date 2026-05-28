# Development Plan

## Current Status

The first working web version is implemented. The app is a SvelteKit-based browser tool for uploading a reference image, drawing Bezier-like curves on a Paper.js canvas, calibrating a coordinate system, and exporting path code.

The current implementation is intentionally compact: the MVP UI has been extracted into eight Svelte components under `src/components/`, while reusable math and export logic lives in `src/lib/core`. `+page.svelte` owns the Paper.js canvas lifecycle and orchestrates the components.

## Current Goal Status

The current active goal is to keep extending the Paper.js-based object interaction framework instead of replacing the canvas runtime.

Already implemented toward that goal:

- [x] Reference images behave as canvas objects:
  - selection in pan mode
  - movement
  - corner-handle resizing
  - opacity editing
  - lock/unlock
  - fit-to-canvas and reset-transform actions
- [x] Curves behave as selectable canvas objects:
  - direct canvas hit-testing
  - additive multi-selection
  - right-list and canvas selection stay in sync
- [x] Single selected curves support direct anchor and Bezier-handle editing on canvas.
- [x] Multiple selected curves support batch stroke color and width editing.
- [x] Undo/redo now spans curve creation, curve editing, image editing, and calibration changes.
- [x] Component extraction completed with eight UI components under `src/components/`:
  - Header, Toolbar, BrushSettings, CalibrationSettings, CanvasWorkspace, ObjectPropertiesPanel, CurveListPanel, ExportPanel.

Still remaining for this goal:

- [ ] Improve multi-curve edit affordances beyond basic multi-select and batch styling.
- [ ] Decide whether curves and images need a shared higher-level object store instead of local page state only.
- [ ] Add project save/load so image state, curve data, and calibration can round-trip together.
- [ ] Finish a dedicated responsive pass for short viewports after the object UI stabilizes.

## Implemented MVP

- [x] SvelteKit 2 + Svelte 5 + TypeScript project initialized.
- [x] Tailwind CSS configured through `@tailwindcss/vite`.
- [x] Vercel adapter installed through `@sveltejs/adapter-vercel`.
- [x] Project-local dependency workflow established with `.pnpm-store`.
- [x] Core runtime dependencies installed:
  - `paper`
  - `@lucide/svelte`
  - `svelte-i18n`
- [x] Core geometry types defined in `src/lib/core/types.ts`:
  - `Point`
  - `CubicBezierSegment`
  - `CurvePath`
  - `CoordinateSystem`
  - `CanvasImage`
  - `ToolMode`
  - `ExportOptions`
- [x] Coordinate conversion implemented in `src/lib/core/coordinate.ts`:
  - canvas coordinates to calibrated coordinates
  - calibrated coordinates to canvas coordinates
  - distance calculation
  - unit length calibration helper
  - optional y-axis inversion
- [x] Export logic implemented in `src/lib/core/exporter.ts`:
  - TikZ path export
  - LuaDraw `g:Dbezier(...)` export
  - CeTZ `bezier(...)` export
  - decimal precision setting
  - cubic Bezier control-point formatting
  - basic stroke color and line width mapping
  - closed-path export handling
- [x] Tests added:
  - coordinate conversion tests
  - TikZ exporter tests
- [x] Single-page MVP UI implemented in `src/routes/+page.svelte`.
- [x] Paper.js canvas initialized in the browser.
- [x] Image upload implemented for local image files.
- [x] Reference image displayed on the canvas.
- [x] Reference image moved to a dedicated top layer so it stays visible for tracing and point picking.
- [x] Reference image opacity control implemented.
- [x] Reference image object interactions implemented:
  - object selection in pan mode
  - movement
  - corner-handle resizing
  - opacity control
  - lock/unlock
  - fit-to-canvas and reset-transform actions
- [x] Canvas zoom implemented with mouse wheel.
- [x] Canvas pan mode implemented.
- [x] Freehand brush drawing implemented.
- [x] Drawn paths can be simplified and smoothed through explicit brush settings.
- [x] Cubic Bezier segment data extracted from Paper.js paths.
- [x] Extracted curves stored as internal `CurvePath` objects.
- [x] Curve list implemented.
- [x] Multi-selection implemented through the right-side curve list.
- [x] Select-all and clear-selection actions implemented.
- [x] Removed the inactive canvas `select` tool from the toolbar.
- [x] Selected curve delete implemented.
- [x] Clear all curves implemented.
- [x] Undo last drawn curve implemented.
- [x] Redo / restore last undone curve implemented.
- [x] Undo/redo broadened to cover:
  - curve deletion and clear
  - curve anchor/control-handle edits
  - image movement, resizing, opacity, locking, fit, and reset actions
  - coordinate calibration drags and settings changes
- [x] Keyboard shortcuts added:
  - `Ctrl+Z` / `Cmd+Z`
  - `Ctrl+Y` / `Cmd+Y`
  - `Ctrl+Shift+Z` / `Cmd+Shift+Z`
  - `Escape` to clear object selection
  - `Delete` / `Backspace` to remove selected curves
- [x] Origin setting mode implemented.
- [x] Unit length calibration mode implemented.
- [x] Unit length can be adjusted by dragging the visible coordinate-axis unit point.
- [x] Unit handle dragging only changes scale; x/y axis directions remain horizontal and vertical.
- [x] Replace separate origin/unit toolbar modes with direct manipulation:
  - origin point can be clicked, selected, and dragged directly on the canvas
  - unit-vector point can be clicked, selected, and dragged directly on the canvas
  - moving origin moves the unit point by the same delta
  - moving unit point only changes horizontal unit length, not axis direction
  - origin and unit buttons removed from the toolbar
- [x] Origin and unit handles are selectable/draggable only in pan mode.
- [x] Canvas cursor changes by tool mode: crosshair for brush, hand/grabbing for pan.
- [x] Real unit length input implemented.
- [x] Current calibration status displayed.
- [x] Calibrated coordinate grid implemented.
- [x] Coordinate grid display toggle implemented.
- [x] Removed user-facing y-axis inversion option; TikZ export uses y-axis-up coordinates by default.
- [x] Code export panel implemented.
- [x] Copy export code to clipboard implemented.
- [x] Download export code implemented with format-specific filename.
- [x] Export precision setting implemented.
- [x] Export format selection implemented:
  - TikZ
  - LuaDraw
  - CeTZ
- [x] Export output title unified as `代码输出`.
- [x] Removed wrapper generation for `tikzpicture` and `#cetz.canvas(...)`.
- [x] TikZ output formatting refined:
  - `\draw[...]` on its own line
  - start point on its own line
  - each `.. controls ..` segment on its own line
- [x] Negative-zero formatting fixed for rounded export numbers.
- [x] Closed-path snapping toggle added for brush drawing.
- [x] Closed-path snapping threshold slider added in the left panel.
- [x] Closed-path snapping now closes by endpoint snap only and does not resmooth the whole path.
- [x] Closed-path snap preview circle implemented on the live brush endpoint.
- [x] Grid-point snapping implemented for brush drawing.
- [x] Grid-point snapping shares the same pixel-threshold-derived project-space radius as closed-path snapping.
- [x] Grid snap hit coordinates shown temporarily in the canvas status bar.
- [x] Closed curves are exported distinctly in all formats.
- [x] Brush post-processing controls added:
  - simplify tolerance slider
  - smoothing toggle
- [x] Brush post-processing settings persisted in `localStorage`.
- [x] Snap settings persisted in `localStorage`:
  - grid snapping toggle
  - snap threshold
- [x] Right-side vertical layout improved:
  - top and bottom drag handles move the fixed-height export-settings block
  - export-settings block height adapts to smaller viewport heights
  - code-output block fills remaining space
- [x] Left panel default width reduced.
- [x] Brush width slider narrowed to `1px` to `8px`.
- [x] Reset view now centers the calibrated origin in the viewport.
- [x] Reset-view button moved away from the bottom edge to reduce small-window clipping risk.
- [x] Small-viewport constraints tightened:
  - left panel `min-h-0`
  - canvas section `min-h-0` and `overflow-hidden`
  - right panel heights clamped against available height
- [x] Lightweight Paper.js object-selection layer added for images and curves.
- [x] Curve paths can be selected directly on the canvas in pan mode.
- [x] Single selected curves expose editable anchors and Bezier control handles in pan mode.
- [x] Multiple selected curves support batch color and stroke-width editing from the object-properties panel.
- [x] Pan-mode hit-testing order clarified so selected-image transforms do not block ordinary curve selection.
- [x] First UI extraction completed with `src/components/ObjectPropertiesPanel.svelte`.
- [x] Full UI component extraction completed: Header, Toolbar, BrushSettings, CalibrationSettings, CanvasWorkspace, CurveListPanel, ExportPanel.
- [x] `.gitignore` and `.prettierignore` updated for local store, generated files, logs, and build output.

## Verification Status

- [x] `pnpm install --store-dir .pnpm-store` works.
- [x] `pnpm check` passes.
- [ ] `pnpm test` is currently blocked in the sandbox because Vite/Vitest cannot write `node_modules/.vite-temp`.
- [ ] `pnpm build` is currently blocked in the sandbox for the same `.vite-temp` permission reason.
- [ ] `pnpm lint` has not been rerun after the latest UI/export changes.
- [x] Local dev server has responded successfully when run outside the sandbox restriction.

## Known MVP Limitations

- [ ] All application state and Paper.js canvas logic still lives in `src/routes/+page.svelte`; it should be moved into shared stores (`src/stores.ts`) for better separation of concerns.
- [ ] Curve click-to-select, additive canvas selection, and basic batch style editing are implemented, but richer multi-select edit affordances still need work.
- [ ] There is no layer model yet.
- [ ] There is no project save/load format yet.
- [ ] i18n files are not wired into the UI yet.
- [ ] Manual LaTeX/TikZ compile verification still needs to be done with exported output.
- [ ] Closed-path snapping uses a simple endpoint-distance heuristic only.
- [ ] Grid snapping currently targets integer coordinate intersections only; there is no separate mode for axis-only or major-grid-only snapping.
- [ ] Very small viewport layouts still need a dedicated responsive pass.

## Next TodoList

### 1. Refactor MVP UI Into Components

- [x] Add resizable left and right side panels before component extraction:
  - left panel default width: `280px`
  - right panel default width: `360px`
  - drag handles between left/canvas and canvas/right
  - clamp panel widths to usable min/max values
  - persist widths in `localStorage`
- [x] Add side panel collapse and expand buttons on the resize handles.
- [x] Persist collapsed side panel state in `localStorage`.
- [x] Create `src/components/Header.svelte`.
- [x] Create `src/components/Toolbar.svelte`.
- [x] Create `src/components/BrushSettings.svelte`.
- [x] Create `src/components/CalibrationSettings.svelte`.
- [x] Create `src/components/CanvasWorkspace.svelte`.
- [x] Create `src/components/CurveListPanel.svelte`.
- [x] Create `src/components/ExportPanel.svelte`.
- [x] Keep components focused on UI; business logic stays in `+page.svelte` and `src/lib/core`.
- [ ] Move Paper.js canvas lifecycle inside `CanvasWorkspace.svelte` (deferred; currently `+page.svelte` still owns the canvas setup and tool events).
- [ ] Create `src/stores.ts` and move shared state out of `+page.svelte`.

### 2. Improve State Management

- [ ] Create `src/stores.ts`.
- [ ] Move shared app state out of `+page.svelte`:
  - active tool
  - curve list
  - selected curve
  - coordinate system
  - reference image settings
  - export settings
- [x] Add local persistence for lightweight user preferences:
  - brush color
  - brush width
  - simplify tolerance
  - smoothing toggle
  - snap settings

### 3. Improve Reference Image Handling

- [x] Implement image drag/move when unlocked.
- [x] Implement image scale controls.
- [x] Implement image fit-to-canvas.
- [x] Implement image reset transform.
- [ ] Add brightness and contrast controls if needed.

### 4. Improve Curve Interaction

- [ ] Implement manual Bezier pen tool.
- [x] Add visible anchors for selected curve.
- [x] Add visible control handles for selected curve.
- [x] Let users drag anchors and control handles.
- [x] Add curve rename.
- [x] Add curve color and stroke width editing after creation.
- [x] Add undo/redo for drawing.
- [x] Broaden undo/redo to cover deletion, clear, calibration, and image changes.
- [x] Add closed-path snap preview when the brush endpoint is within the configured snap threshold.
- [ ] Consider splitting snap settings into a dedicated section once brush options grow further.
- [ ] Decide whether grid snapping should support only integer intersections or configurable step sizes.

### 5. Improve Coordinate Calibration

- [ ] Add explicit reset calibration button.
- [ ] Add visual x-axis marker and label.
- [ ] Support optional y-axis calibration point.
- [ ] Support non-horizontal image coordinate systems.
- [x] Add grid overlay based on calibrated coordinates.
- [ ] Add snapping to origin, axis, and grid.

### 6. Improve Responsive Layout

- [ ] Do a dedicated small-viewport pass for header and side panels.
- [ ] Compress fixed control heights where possible in short windows.
- [ ] Remove remaining assumptions that important actions can live on the bottom edge.
- [ ] Replace piecemeal height clamps with a clearer responsive strategy for the right panel.

### 7. Improve Snapping

- [ ] Add visual priority rules or UI hints when grid snapping and closed-path snapping compete.
- [ ] Consider optional snapping to axis lines without requiring full grid-point snapping.
- [ ] Consider optional snapping to major grid intervals rather than only integer coordinates.
- [ ] Add tests for snap-radius consistency across zoom levels.

### 8. Improve Export

- [x] Allow exporting selected curves only; when nothing is selected, output is empty.
- [ ] Add explicit export-mode toggle for selected/all if needed.
- [ ] Add TikZ style presets.
- [ ] Add LuaDraw option presets.
- [ ] Add CeTZ style presets.
- [ ] Add color conversion options:
  - named colors
  - RGB definitions
  - raw hex comments
- [ ] Add optional comments with curve names.
- [ ] Add axis/grid export options.
- [ ] Test exported TikZ in a minimal LaTeX document.
- [ ] Test exported LuaDraw in a minimal LuaLaTeX document.
- [ ] Test exported CeTZ in a minimal Typst document.

### 9. Add i18n Foundation

- [ ] Create `src/lib/i18n/index.ts`.
- [ ] Create `src/lib/i18n/locales/zh.json`.
- [ ] Create `src/lib/i18n/locales/en.json`.
- [ ] Replace hard-coded UI text with translation keys.
- [ ] Default to Chinese UI.

### 10. Add More Tests

- [ ] Add tests for unit calibration edge cases.
- [ ] Add tests for rotated coordinate basis.
- [ ] Add tests for multiple-curve TikZ export.
- [ ] Add tests for precision formatting.
- [ ] Add tests for empty export output.

## Deferred Work

- [ ] Multiple layers.
- [ ] PDF import.
- [ ] Automatic curve extraction from images.
- [ ] Automatic coordinate axis detection.
- [ ] AI-assisted curve or axis interpretation.
- [ ] Web Worker for heavy image processing.
- [ ] Server-side API routes for protected AI calls.
- [ ] Desktop packaging with Electron or Tauri.

## Dependency Rules

Use project-local dependencies only. Do not install app libraries globally.

Use the project-local pnpm store:

```powershell
pnpm install --store-dir .pnpm-store
pnpm add <package> --store-dir .pnpm-store
pnpm remove <package> --store-dir .pnpm-store
```

Current core runtime dependencies:

- `paper`
- `@lucide/svelte`
- `svelte-i18n`

Current test dependency:

- `vitest`

Do not install `@types/paper`; `paper` provides its own type definitions.
