# Development Plan

## Current Status

The first working web version is implemented. The app is a SvelteKit-based browser tool for uploading a reference image, drawing Bezier-like curves on a Paper.js canvas, calibrating a coordinate system, and exporting TikZ code.

The current implementation is intentionally compact: the MVP UI is concentrated in `src/routes/+page.svelte`, while reusable math and export logic lives in `src/lib/core`.

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
- [x] TikZ export implemented in `src/lib/core/exporter.ts`:
  - single curve export
  - multiple curve export
  - optional `tikzpicture` wrapper
  - decimal precision setting
  - cubic Bezier `.. controls .. and ..` output
  - basic stroke color and line width mapping
- [x] Tests added:
  - coordinate conversion tests
  - TikZ exporter tests
- [x] Single-page MVP UI implemented in `src/routes/+page.svelte`.
- [x] Paper.js canvas initialized in the browser.
- [x] Image upload implemented for local image files.
- [x] Reference image displayed on the canvas.
- [x] Reference image opacity control implemented.
- [x] Basic reference image lock/unlock UI added.
- [x] Canvas zoom implemented with mouse wheel.
- [x] Canvas pan mode implemented.
- [x] Freehand brush drawing implemented.
- [x] Drawn paths are simplified and smoothed through Paper.js.
- [x] Cubic Bezier segment data extracted from Paper.js paths.
- [x] Extracted curves stored as internal `CurvePath` objects.
- [x] Curve list implemented.
- [x] Curve selection implemented through the right-side curve list.
- [x] Removed the inactive canvas `select` tool from the toolbar.
- [x] Selected curve delete implemented.
- [x] Clear all curves implemented.
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
- [x] TikZ export panel implemented.
- [x] Copy TikZ to clipboard implemented.
- [x] Download `.tikz` implemented.
- [x] Export precision setting implemented.
- [x] Optional `tikzpicture` wrapper setting implemented.
- [x] `.gitignore` and `.prettierignore` updated for local store, generated files, logs, and build output.

## Verification Status

- [x] `pnpm install --store-dir .pnpm-store` works.
- [x] `pnpm check` passes.
- [x] `pnpm test` passes.
- [x] `pnpm build` passes.
- [x] `pnpm lint` passes.
- [x] Local dev server responds at `http://localhost:5173/`.

## Known MVP Limitations

- [ ] The UI is still concentrated in `src/routes/+page.svelte`; it should be split into components before the interface grows much more.
- [ ] Curve editing is limited to selection, deletion, and export.
- [ ] Canvas click-to-select is not implemented yet; use the curve list for selection.
- [ ] Anchor points and Bezier handles are not editable yet.
- [ ] The reference image lock/unlock control is present, but image transform editing is not yet fully implemented.
- [ ] There is no layer model yet.
- [ ] There is no project save/load format yet.
- [ ] i18n files are not wired into the UI yet.
- [ ] Manual LaTeX/TikZ compile verification still needs to be done with exported output.

## Next TodoList

### 1. Refactor MVP UI Into Components

- [ ] Add resizable left and right side panels before component extraction:
  - left panel default width: `280px`
  - right panel default width: `360px`
  - drag handles between left/canvas and canvas/right
  - clamp panel widths to usable min/max values
  - persist widths in `localStorage`
- [x] Add side panel collapse and expand buttons on the resize handles.
- [x] Persist collapsed side panel state in `localStorage`.
- [ ] Create `src/components/Toolbar.svelte`.
- [ ] Create `src/components/CanvasWorkspace.svelte`.
- [ ] Create `src/components/SettingsPanel.svelte`.
- [ ] Create `src/components/ExportPanel.svelte`.
- [ ] Create `src/components/CurveList.svelte`.
- [ ] Keep Paper.js canvas lifecycle inside `CanvasWorkspace.svelte`.
- [ ] Keep components focused on UI; move business logic into `src/lib/core` or stores.

### 2. Improve State Management

- [ ] Create `src/stores.ts`.
- [ ] Move shared app state out of `+page.svelte`:
  - active tool
  - curve list
  - selected curve
  - coordinate system
  - reference image settings
  - export settings
- [ ] Add local persistence for lightweight user preferences:
  - export precision
  - wrapper option
  - brush color
  - brush width

### 3. Improve Reference Image Handling

- [ ] Implement image drag/move when unlocked.
- [ ] Implement image scale controls.
- [ ] Implement image fit-to-canvas.
- [ ] Implement image reset transform.
- [ ] Add brightness and contrast controls if needed.

### 4. Improve Curve Interaction

- [ ] Implement manual Bezier pen tool.
- [ ] Add visible anchors for selected curve.
- [ ] Add visible control handles for selected curve.
- [ ] Let users drag anchors and control handles.
- [ ] Add curve rename.
- [ ] Add curve color and stroke width editing after creation.
- [ ] Add undo/redo for drawing and deletion.

### 5. Improve Coordinate Calibration

- [ ] Add explicit reset calibration button.
- [ ] Add visual x-axis marker and label.
- [ ] Support optional y-axis calibration point.
- [ ] Support non-horizontal image coordinate systems.
- [x] Add grid overlay based on calibrated coordinates.
- [ ] Add snapping to origin, axis, and grid.

### 6. Improve TikZ Export

- [ ] Allow exporting all curves or only the selected curve through an explicit toggle.
- [ ] Add TikZ style presets.
- [ ] Add color conversion options:
  - named colors
  - RGB definitions
  - raw hex comments
- [ ] Add optional comments with curve names.
- [ ] Add axis/grid export options.
- [ ] Test exported TikZ in a minimal LaTeX document.

### 7. Add i18n Foundation

- [ ] Create `src/lib/i18n/index.ts`.
- [ ] Create `src/lib/i18n/locales/zh.json`.
- [ ] Create `src/lib/i18n/locales/en.json`.
- [ ] Replace hard-coded UI text with translation keys.
- [ ] Default to Chinese UI.

### 8. Add More Tests

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
