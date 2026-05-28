<script lang="ts">
	import { browser } from '$app/environment';
	import {
		canvasToCoordinate,
		coordinateToCanvas,
		defaultCoordinateSystem,
		getBasis
	} from '$lib/core/coordinate';
	import { exportCurves } from '$lib/core/exporter';
	import type {
		CanvasObjectType,
		CanvasImage,
		CoordinateSystem,
		CubicBezierSegment,
		CurvePath,
		ExportFormat,
		Point,
		ToolMode
	} from '$lib/core/types';
	import {
		PanelLeftClose,
		PanelLeftOpen,
		PanelRightClose,
		PanelRightOpen
	} from '@lucide/svelte';
	import BrushSettings from '../components/BrushSettings.svelte';
	import CalibrationSettings from '../components/CalibrationSettings.svelte';
	import CanvasWorkspace from '../components/CanvasWorkspace.svelte';
	import CurveListPanel from '../components/CurveListPanel.svelte';
	import ExportPanel from '../components/ExportPanel.svelte';
	import Header from '../components/Header.svelte';
	import ObjectPropertiesPanel from '../components/ObjectPropertiesPanel.svelte';
	import Toolbar from '../components/Toolbar.svelte';
	import { onDestroy, onMount } from 'svelte';

	type PaperScope = paper.PaperScope;
	type PaperPath = paper.Path;
	type PaperRaster = paper.Raster;
	type PaperTool = paper.Tool;
	type PaperProject = paper.Project;
	type PaperPoint = paper.Point;
	type PaperLayer = paper.Layer;
	type PaperMouseEvent = paper.ToolEvent;
	type PaperSize = paper.Size;
	type PaperRectangle = paper.Rectangle;

	let paper: PaperScope | null = null;
	let canvas: HTMLCanvasElement;
	let canvasHost: HTMLElement;
	let rightPanelHost: HTMLElement;
	let tool: PaperTool | null = null;
	let project: PaperProject | null = null;
	let activePath: PaperPath | null = null;
	let referenceRaster: PaperRaster | null = null;
	let snapPreviewCircle: PaperPath | null = null;
	let canvasResizeObserver: ResizeObserver | null = null;
	let canvasResizeFrame = 0;
	let pointerStart: Point | null = null;
	let activeHandle: 'origin' | 'unit' | null = null;
	let activeImageHandle: 'move' | 'nw' | 'ne' | 'sw' | 'se' | null = null;
	let activeCurveHandle:
		| {
				curveId: string;
				kind: 'anchor' | 'control1' | 'control2';
				index: number;
		  }
		| null = null;
	let imageDragStartPoint: Point | null = null;
	let imageStartBounds: { x: number; y: number; width: number; height: number } | null = null;
	let imageNaturalSize: { width: number; height: number } | null = null;
	let hasInitializedCoordinateSystem = false;

	type EditorSnapshot = {
		curves: CurvePath[];
		image: CanvasImage | null;
		imageNaturalSize: { width: number; height: number } | null;
		coordinateSystem: CoordinateSystem;
		unitRealLength: number;
		showGrid: boolean;
		selectedCurveIds: string[];
		selectedObject: { type: CanvasObjectType; id: string } | null;
	};

	let pendingEditSnapshot: EditorSnapshot | null = null;

	let activeTool = $state<ToolMode>('brush');
	let image = $state<CanvasImage | null>(null);
	let selectedObject = $state<{ type: CanvasObjectType; id: string } | null>(null);
	let curves = $state<CurvePath[]>([]);
	let selectedCurveIds = $state<string[]>([]);
	let undoHistory = $state<EditorSnapshot[]>([]);
	let redoHistory = $state<EditorSnapshot[]>([]);
	let coordinateSystem = $state<CoordinateSystem>({
		...defaultCoordinateSystem,
		originCanvas: { x: 360, y: 300 },
		xAxisPoint: { x: 460, y: 300 }
	});
	let unitRealLength = $state(1);
	let precision = $state(3);
	let exportFormat = $state<ExportFormat>('tikz');
	let stroke = $state('#111827');
	let strokeWidth = $state(2);
	let simplifyTolerance = $state(2);
	let smoothDrawnPath = $state(true);
	let snapToGridPoints = $state(false);
	let snapClosedPaths = $state(false);
	let closedPathSnapDistance = $state(18);
	let showGrid = $state(true);
	let leftPanelWidth = $state(240);
	let rightPanelWidth = $state(360);
	let leftPanelCollapsed = $state(false);
	let rightPanelCollapsed = $state(false);
	let rightCurvesPanelHeight = $state(220);
	let resizingPanel = $state<'left' | 'right' | null>(null);
	let resizingRightSection = $state(false);
	let rightSectionResizeStartY = 0;
	let rightSectionStartHeight = 0;
	let canvasReady = $state(false);
	let status = $state('选择图片或直接用画笔描曲线');
	let snapPreviewStatus = $state('');

	let rightSettingsPanelHeight = $state(210);

	let selectedCurveIdSet = $derived(new Set(selectedCurveIds));
	let selectedCurves = $derived(curves.filter((curve) => selectedCurveIdSet.has(curve.id)));
	let selectedImage = $derived(
		selectedObject?.type === 'image' && image?.id === selectedObject.id ? image : null
	);
	let selectedCurveObject = $derived(
		selectedObject?.type === 'curve'
			? curves.find((curve) => curve.id === selectedObject?.id) ?? null
			: null
	);
	let exportCode = $derived(
		exportCurves(selectedCurves, coordinateSystem, {
			precision,
			format: exportFormat
		})
	);
	let exportTitle = $derived.by(() => {
		if (exportFormat === 'luadraw') return 'LuaDraw 输出';
		if (exportFormat === 'cetz') return 'CeTZ 输出';
		return 'TikZ 输出';
	});
	let exportFileName = $derived.by(() => {
		if (exportFormat === 'luadraw') return 'curves.lua';
		if (exportFormat === 'cetz') return 'curves.typ';
		return 'curves.tikz';
	});
	let originCoord = $derived(canvasToCoordinate(coordinateSystem.originCanvas, coordinateSystem));
	let workspaceGridColumns = $derived(
		`${leftPanelCollapsed ? 0 : leftPanelWidth}px 28px 6px minmax(0, 1fr) 6px 28px ${rightPanelCollapsed ? 0 : rightPanelWidth}px`
	);
	let canvasCursorClass = $derived(activeTool === 'pan' ? 'cursor-pan-tool' : 'cursor-crosshair');
	let overlayStatus = $derived(snapPreviewStatus ? `${status} | ${snapPreviewStatus}` : status);

	const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

	function persistPanelLayout() {
		if (!browser) return;
		localStorage.setItem(
			'tikz-curve-digitizer:panel-layout',
			JSON.stringify({
				left: leftPanelWidth,
				right: rightPanelWidth,
				leftCollapsed: leftPanelCollapsed,
				rightCollapsed: rightPanelCollapsed
			})
		);
	}

	function loadPanelLayout() {
		if (!browser) return;
		const raw =
			localStorage.getItem('tikz-curve-digitizer:panel-layout') ??
			localStorage.getItem('tikz-curve-digitizer:panel-widths');
		if (!raw) return;

		try {
			const parsed = JSON.parse(raw) as {
				left?: number;
				right?: number;
				leftCollapsed?: boolean;
				rightCollapsed?: boolean;
			};
			leftPanelWidth = clamp(parsed.left ?? leftPanelWidth, 220, 460);
			rightPanelWidth = clamp(parsed.right ?? rightPanelWidth, 300, 620);
			leftPanelCollapsed = parsed.leftCollapsed ?? leftPanelCollapsed;
			rightPanelCollapsed = parsed.rightCollapsed ?? rightPanelCollapsed;
		} catch {
			localStorage.removeItem('tikz-curve-digitizer:panel-layout');
		}
	}

	function persistRightPanelLayout() {
		if (!browser) return;
		localStorage.setItem(
			'tikz-curve-digitizer:right-panel-layout',
			JSON.stringify({
				curvesHeight: rightCurvesPanelHeight
			})
		);
	}

	function loadRightPanelLayout() {
		if (!browser) return;
		const raw = localStorage.getItem('tikz-curve-digitizer:right-panel-layout');
		if (!raw) return;

		try {
			const parsed = JSON.parse(raw) as {
				curvesHeight?: number;
			};
			rightCurvesPanelHeight = clamp(parsed.curvesHeight ?? rightCurvesPanelHeight, 120, 520);
		} catch {
			localStorage.removeItem('tikz-curve-digitizer:right-panel-layout');
		}
	}

	function persistBrushSettings() {
		if (!browser) return;
		localStorage.setItem(
			'tikz-curve-digitizer:brush-settings',
			JSON.stringify({
				simplifyTolerance,
				smoothDrawnPath,
				snapToGridPoints,
				closedPathSnapDistance
			})
		);
	}

	function loadBrushSettings() {
		if (!browser) return;
		const raw = localStorage.getItem('tikz-curve-digitizer:brush-settings');
		if (!raw) return;

		try {
			const parsed = JSON.parse(raw) as {
				simplifyTolerance?: number;
				smoothDrawnPath?: boolean;
				snapToGridPoints?: boolean;
				closedPathSnapDistance?: number;
			};
			simplifyTolerance = clamp(parsed.simplifyTolerance ?? simplifyTolerance, 0, 5);
			smoothDrawnPath = parsed.smoothDrawnPath ?? smoothDrawnPath;
			snapToGridPoints = parsed.snapToGridPoints ?? snapToGridPoints;
			closedPathSnapDistance = clamp(
				parsed.closedPathSnapDistance ?? closedPathSnapDistance,
				5,
				50
			);
		} catch {
			localStorage.removeItem('tikz-curve-digitizer:brush-settings');
		}
	}

	function measureCanvasHost() {
		if (!canvasHost) return null;
		const rect = canvasHost.getBoundingClientRect();
		const width = Math.max(1, Math.floor(rect.width));
		const height = Math.max(1, Math.floor(rect.height));
		return { width, height };
	}

	function initializeCoordinateSystemFromCanvas(size: { width: number; height: number }) {
		if (hasInitializedCoordinateSystem) return;
		const centerX = size.width / 2;
		const centerY = size.height / 2;
		const unitCanvasLength = defaultCoordinateSystem.unitCanvasLength;

		coordinateSystem = {
			...coordinateSystem,
			originCanvas: { x: centerX, y: centerY },
			xAxisPoint: { x: centerX + unitCanvasLength, y: centerY },
			unitCanvasLength
		};
		hasInitializedCoordinateSystem = true;
	}

	function syncCanvasSize() {
		if (!canvas) return;
		const size = measureCanvasHost();
		if (!size) return;
		initializeCoordinateSystemFromCanvas(size);

		const previousCenter = paper?.view.center;
		const changed = canvas.width !== size.width || canvas.height !== size.height;
		if (!changed) return;

		canvas.width = size.width;
		canvas.height = size.height;

		if (paper) {
			paper.view.viewSize = new paper.Size(size.width, size.height) as PaperSize;
			if (previousCenter) {
				paper.view.center = previousCenter;
			}
			paper.view.update();
			fitRightPanelLayoutToAvailableHeight();
			drawCalibration();
		}
	}

	function fitRightPanelLayoutToAvailableHeight() {
		if (!rightPanelHost) return;
		const availableHeight = rightPanelHost.getBoundingClientRect().height;
		const minCurvesHeight = 80;
		const minSettingsHeight = 120;
		const minOutputHeight = 120;
		const separatorHeight = 16;
		const preferredSettingsHeight = 210;
		const maxSettingsHeight = Math.max(
			minSettingsHeight,
			availableHeight - minCurvesHeight - minOutputHeight - separatorHeight
		);
		rightSettingsPanelHeight = clamp(preferredSettingsHeight, minSettingsHeight, maxSettingsHeight);
		const maxCurvesHeight = Math.max(
			minCurvesHeight,
			availableHeight - rightSettingsPanelHeight - minOutputHeight - separatorHeight
		);
		rightCurvesPanelHeight = clamp(rightCurvesPanelHeight, minCurvesHeight, maxCurvesHeight);
	}

	function scheduleCanvasResize() {
		if (!browser) return;
		cancelAnimationFrame(canvasResizeFrame);
		canvasResizeFrame = requestAnimationFrame(syncCanvasSize);
	}

	$effect(() => {
		persistBrushSettings();
	});

	function toPlainPoint(point: PaperPoint): Point {
		return { x: point.x, y: point.y };
	}

	function updateStatusForTool() {
		if (activeTool === 'brush') status = '按住拖动画出曲线';
		else if (activeTool === 'pan') status = '拖动画布空白区域平移；也可拖动原点或单位点';
	}

	function setTool(mode: ToolMode) {
		activeTool = mode;
		activeHandle = null;
		clearClosedPathSnapPreview();
		document.body.classList.remove('cursor-pan-tool');
		updateStatusForTool();
	}

	function hitCalibrationHandle(point: Point) {
		const threshold = 12 / (paper?.view.zoom ?? 1);
		if (distanceBetween(point, coordinateSystem.originCanvas) <= threshold) return 'origin';
		if (distanceBetween(point, coordinateSystem.xAxisPoint) <= threshold) return 'unit';
		return null;
	}

	function distanceBetween(a: Point, b: Point) {
		return Math.hypot(a.x - b.x, a.y - b.y);
	}

	function getSnapRadius() {
		return closedPathSnapDistance / (paper?.view.zoom ?? 1);
	}

	function getOrCreateLayer(name: string) {
		if (!paper || !project) return null;
		const existing = project.layers.find((item: PaperLayer) => item.name === name);
		if (existing) return existing;
		const layer = new paper.Layer();
		layer.name = name;
		return layer;
	}

	function getSelectedImageBounds() {
		if (!image || !paper) return null;
		return new paper.Rectangle(image.x, image.y, image.width, image.height);
	}

	function setSelectedImage() {
		if (!image) return;
		selectedObject = { type: 'image', id: image.id };
		selectedCurveIds = [];
		drawObjectSelectionOverlay();
	}

	function setSelectedCurves(ids: string[]) {
		selectedCurveIds = ids;
		selectedObject = ids[0] ? { type: 'curve', id: ids[0] } : null;
		redrawCurves();
	}

	function updateCurveSelectionFromCanvas(id: string, additive: boolean) {
		if (!additive) {
			setSelectedCurves([id]);
			return;
		}

		const nextSelectedCurveIds = selectedCurveIdSet.has(id)
			? selectedCurveIds.filter((selectedId) => selectedId !== id)
			: [...selectedCurveIds, id];
		selectedCurveIds = nextSelectedCurveIds;
		selectedObject = nextSelectedCurveIds[0]
			? { type: 'curve', id: nextSelectedCurveIds[0] }
			: null;
		redrawCurves();
	}

	function updateCurveSelectionStatus() {
		if (!selectedCurveIds.length) {
			status = '已取消选择曲线';
			return;
		}
		status =
			selectedCurveIds.length === 1 ? '已选中曲线' : `已选择 ${selectedCurveIds.length} 条曲线`;
	}

	function clearObjectSelection() {
		selectedObject = null;
		selectedCurveIds = [];
		activeCurveHandle = null;
		drawObjectSelectionOverlay();
		redrawCurves();
	}

	function cloneCurvesState(source: CurvePath[]) {
		return source.map((curve) => ({
			...curve,
			segments: curve.segments.map((segment) => ({
				start: { ...segment.start },
				control1: { ...segment.control1 },
				control2: { ...segment.control2 },
				end: { ...segment.end }
			}))
		}));
	}

	function cloneImageState(source: CanvasImage | null) {
		return source ? { ...source } : null;
	}

	function cloneSelectedObjectState(source: { type: CanvasObjectType; id: string } | null) {
		return source ? { ...source } : null;
	}

	function createEditorSnapshot(): EditorSnapshot {
		return {
			curves: cloneCurvesState(curves),
			image: cloneImageState(image),
			imageNaturalSize: imageNaturalSize ? { ...imageNaturalSize } : null,
			coordinateSystem: {
				...coordinateSystem,
				originCanvas: { ...coordinateSystem.originCanvas },
				xAxisPoint: { ...coordinateSystem.xAxisPoint },
				yAxisPoint: coordinateSystem.yAxisPoint ? { ...coordinateSystem.yAxisPoint } : undefined
			},
			unitRealLength,
			showGrid,
			selectedCurveIds: [...selectedCurveIds],
			selectedObject: cloneSelectedObjectState(selectedObject)
		};
	}

	function syncReferenceRasterToImageState() {
		if (!paper) return;
		const referenceLayer = getOrCreateLayer('reference');
		if (!referenceLayer) return;

		if (!image) {
			referenceRaster?.remove();
			referenceRaster = null;
			imageNaturalSize = null;
			drawObjectSelectionOverlay();
			return;
		}

		if (!referenceRaster || referenceRaster.source !== image.src) {
			referenceRaster?.remove();
			referenceRaster = new paper.Raster({
				source: image.src,
				parent: referenceLayer
			});
			referenceRaster.onLoad = () => {
				if (!referenceRaster || !image) return;
				imageNaturalSize ??= {
					width: referenceRaster.width,
					height: referenceRaster.height
				};
				applyImageBounds({
					x: image.x,
					y: image.y,
					width: image.width,
					height: image.height
				});
				referenceRaster.opacity = image.opacity;
				drawObjectSelectionOverlay();
			};
			return;
		}

		applyImageBounds({
			x: image.x,
			y: image.y,
			width: image.width,
			height: image.height
		});
		referenceRaster.opacity = image.opacity;
		drawObjectSelectionOverlay();
	}

	function applyEditorSnapshot(snapshot: EditorSnapshot) {
		curves = cloneCurvesState(snapshot.curves);
		image = cloneImageState(snapshot.image);
		imageNaturalSize = snapshot.imageNaturalSize ? { ...snapshot.imageNaturalSize } : null;
		coordinateSystem = {
			...snapshot.coordinateSystem,
			originCanvas: { ...snapshot.coordinateSystem.originCanvas },
			xAxisPoint: { ...snapshot.coordinateSystem.xAxisPoint },
			yAxisPoint: snapshot.coordinateSystem.yAxisPoint
				? { ...snapshot.coordinateSystem.yAxisPoint }
				: undefined
		};
		unitRealLength = snapshot.unitRealLength;
		showGrid = snapshot.showGrid;
		selectedCurveIds = [...snapshot.selectedCurveIds];
		selectedObject = cloneSelectedObjectState(snapshot.selectedObject);
		activeCurveHandle = null;
		activeImageHandle = null;
		imageDragStartPoint = null;
		imageStartBounds = null;
		syncReferenceRasterToImageState();
		redrawCurves();
		drawObjectSelectionOverlay();
	}

	function snapshotsEqual(left: EditorSnapshot, right: EditorSnapshot) {
		return JSON.stringify(left) === JSON.stringify(right);
	}

	function commitEditorMutation(
		mutate: () => void,
		statusMessage?: string,
		options?: { suppressRender?: boolean }
	) {
		const before = createEditorSnapshot();
		mutate();
		const after = createEditorSnapshot();
		if (snapshotsEqual(before, after)) return false;
		undoHistory = [...undoHistory, before];
		redoHistory = [];
		if (!options?.suppressRender) {
			syncReferenceRasterToImageState();
			redrawCurves();
			drawObjectSelectionOverlay();
		}
		if (statusMessage) {
			status = statusMessage;
		}
		return true;
	}

	function beginPendingEditHistory() {
		pendingEditSnapshot = createEditorSnapshot();
	}

	function finalizePendingEditHistory(statusMessage?: string) {
		if (!pendingEditSnapshot) return false;
		const before = pendingEditSnapshot;
		pendingEditSnapshot = null;
		const after = createEditorSnapshot();
		if (snapshotsEqual(before, after)) return false;
		undoHistory = [...undoHistory, before];
		redoHistory = [];
		if (statusMessage) {
			status = statusMessage;
		}
		return true;
	}

	function syncLayerOrder() {
		const curvesLayer = getOrCreateLayer('curves');
		const calibrationLayer = getOrCreateLayer('calibration');
		const referenceLayer = getOrCreateLayer('reference');
		const previewLayer = getOrCreateLayer('preview');
		const selectionLayer = getOrCreateLayer('selection');
		if (!curvesLayer || !calibrationLayer || !referenceLayer || !previewLayer || !selectionLayer) {
			return;
		}

		curvesLayer.sendToBack();
		calibrationLayer.insertAbove(curvesLayer);
		referenceLayer.insertAbove(calibrationLayer);
		previewLayer.bringToFront();
		selectionLayer.bringToFront();
	}

	function getImageHandleCenters(bounds: PaperRectangle) {
		return {
			nw: bounds.topLeft,
			ne: bounds.topRight,
			sw: bounds.bottomLeft,
			se: bounds.bottomRight
		};
	}

	function drawObjectSelectionOverlay() {
		if (!paper || !project) return;
		const scope = paper;
		const layer = getOrCreateLayer('selection');
		if (!layer) return;
		layer.removeChildren();

		if (selectedImage) {
			const bounds = getSelectedImageBounds();
			if (bounds) {
				new scope.Path.Rectangle({
					rectangle: bounds,
					strokeColor: '#16a34a',
					strokeWidth: 2 / scope.view.zoom,
					dashArray: [8 / scope.view.zoom, 5 / scope.view.zoom],
					parent: layer
				});
				const handles = getImageHandleCenters(bounds);
				for (const center of Object.values(handles)) {
					new scope.Path.Circle({
						center,
						radius: 6 / scope.view.zoom,
						fillColor: '#16a34a',
						strokeColor: '#ffffff',
						strokeWidth: 2 / scope.view.zoom,
						parent: layer
					});
				}
			}
		}

		if (selectedCurveObject && selectedCurveIds.length === 1) {
			const anchorRadius = 5 / scope.view.zoom;
			const handleRadius = 4 / scope.view.zoom;
			const drawAnchor = (center: Point, index: number) => {
				new scope.Path.Circle({
					center: new scope.Point(center.x, center.y),
					radius: anchorRadius,
					fillColor: '#2563eb',
					strokeColor: '#ffffff',
					strokeWidth: 2 / scope.view.zoom,
					parent: layer,
					data: {
						objectType: 'curve',
						handleKind: 'anchor',
						handleIndex: index,
						curveId: selectedCurveObject.id
					}
				});
			};

			selectedCurveObject.segments.forEach((segment, index) => {
				const start = new scope.Point(segment.start.x, segment.start.y);
				const control1 = new scope.Point(segment.control1.x, segment.control1.y);
				const control2 = new scope.Point(segment.control2.x, segment.control2.y);
				const end = new scope.Point(segment.end.x, segment.end.y);

				new scope.Path.Line({
					from: start,
					to: control1,
					strokeColor: '#60a5fa',
					strokeWidth: 1.5 / scope.view.zoom,
					parent: layer
				});
				new scope.Path.Line({
					from: end,
					to: control2,
					strokeColor: '#60a5fa',
					strokeWidth: 1.5 / scope.view.zoom,
					parent: layer
				});
				new scope.Path.Circle({
					center: control1,
					radius: handleRadius,
					fillColor: '#dbeafe',
					strokeColor: '#2563eb',
					strokeWidth: 1.5 / scope.view.zoom,
					parent: layer,
					data: {
						objectType: 'curve',
						handleKind: 'control1',
						handleIndex: index,
						curveId: selectedCurveObject.id
					}
				});
				new scope.Path.Circle({
					center: control2,
					radius: handleRadius,
					fillColor: '#dbeafe',
					strokeColor: '#2563eb',
					strokeWidth: 1.5 / scope.view.zoom,
					parent: layer,
					data: {
						objectType: 'curve',
						handleKind: 'control2',
						handleIndex: index,
						curveId: selectedCurveObject.id
					}
				});

				drawAnchor(segment.start, index);
				if (
					index === selectedCurveObject.segments.length - 1 &&
					!selectedCurveObject.closed
				) {
					drawAnchor(segment.end, index + 1);
				}
			});
		}

		syncLayerOrder();
	}

	function hitImageHandle(point: Point) {
		if (!selectedImage || !paper) return null;
		const bounds = getSelectedImageBounds();
		if (!bounds) return null;
		const threshold = 10 / paper.view.zoom;
		const handles = getImageHandleCenters(bounds);
		for (const [name, center] of Object.entries(handles)) {
			if (center.getDistance(new paper.Point(point.x, point.y)) <= threshold) {
				return name as 'nw' | 'ne' | 'sw' | 'se';
			}
		}
		return null;
	}

	function hitImageBody(point: Point) {
		if (!image || !referenceRaster || !paper) return false;
		return referenceRaster.bounds.contains(new paper.Point(point.x, point.y));
	}

	function hitCurve(point: Point) {
		if (!paper) return null;
		const curvesLayer = getOrCreateLayer('curves');
		if (!curvesLayer) return null;
		const hit = curvesLayer.hitTest(new paper.Point(point.x, point.y), {
			stroke: true,
			curves: true,
			tolerance: 8 / paper.view.zoom,
			match: (result: paper.HitResult) => !!result.item.data.curveId
		});
		const curveId = hit?.item?.data?.curveId;
		return typeof curveId === 'string' ? curveId : null;
	}

	function hitCurveHandle(point: Point) {
		if (!paper) return null;
		const selectionLayer = getOrCreateLayer('selection');
		if (!selectionLayer) return null;
		const hit = selectionLayer.hitTest(new paper.Point(point.x, point.y), {
			fill: true,
			stroke: true,
			segments: false,
			tolerance: 10 / paper.view.zoom,
			match: (result: paper.HitResult) => !!result.item.data.handleKind
		});
		const data = hit?.item?.data;
		if (!data?.curveId || !data?.handleKind || typeof data.handleIndex !== 'number') {
			return null;
		}
		return {
			curveId: data.curveId as string,
			kind: data.handleKind as 'anchor' | 'control1' | 'control2',
			index: data.handleIndex as number
		};
	}

	function resolvePanPointerTarget(point: Point) {
		const curveHandle = hitCurveHandle(point);
		if (curveHandle) {
			return { kind: 'curve-handle' as const, curveHandle };
		}

		const imageHandle = selectedImage && !selectedImage.locked ? hitImageHandle(point) : null;
		if (imageHandle) {
			return { kind: 'image-handle' as const, imageHandle };
		}

		const curveId = hitCurve(point);
		const imageBodyHit = hitImageBody(point);

		if (selectedImage && !selectedImage.locked && imageBodyHit) {
			return { kind: 'image-body' as const };
		}

		if (curveId) {
			return { kind: 'curve' as const, curveId };
		}

		if (imageBodyHit) {
			return { kind: 'image-body' as const };
		}

		return null;
	}

	function getClosedPathSnapState(path: PaperPath) {
		if (!snapClosedPaths || path.segments.length < 3) {
			return { eligible: false, withinSnapRange: false, snapRadius: 0, start: null, end: null };
		}
		const first = path.firstSegment;
		const last = path.lastSegment;
		if (!first || !last) {
			return { eligible: false, withinSnapRange: false, snapRadius: 0, start: null, end: null };
		}

		const snapRadius = getSnapRadius();
		const withinSnapRange = first.point.getDistance(last.point) <= snapRadius;
		return {
			eligible: true,
			withinSnapRange,
			snapRadius,
			start: first.point,
			end: last.point
		};
	}

	function getGridPointSnapState(point: Point) {
		if (!snapToGridPoints) {
			return {
				eligible: false,
				withinSnapRange: false,
				snapRadius: 0,
				targetPoint: null,
				gridCoordinate: null
			};
		}

		const gridCoordinate = canvasToCoordinate(point, coordinateSystem);
		const roundedCoordinate = {
			x: Math.round(gridCoordinate.x),
			y: Math.round(gridCoordinate.y)
		};
		const targetPoint = coordinateToCanvas(roundedCoordinate, coordinateSystem);
		const snapRadius = getSnapRadius();
		const withinSnapRange = distanceBetween(point, targetPoint) <= snapRadius;
		return {
			eligible: true,
			withinSnapRange,
			snapRadius,
			targetPoint,
			gridCoordinate: roundedCoordinate
		};
	}

	function getSnappedBrushPoint(point: Point) {
		const gridSnap = getGridPointSnapState(point);
		if (gridSnap.eligible && gridSnap.withinSnapRange && gridSnap.targetPoint) {
			return gridSnap.targetPoint;
		}
		return point;
	}

	function clearClosedPathSnapPreview() {
		snapPreviewCircle?.remove();
		snapPreviewCircle = null;
		snapPreviewStatus = '';
	}

	function updateSnapPreviewCircle(center: PaperPoint | Point, radius: number) {
		if (!paper) return;
		const previewLayer = getOrCreateLayer('preview');
		if (!previewLayer) return;
		clearClosedPathSnapPreview();
		const previewCenter = center instanceof paper.Point ? center : new paper.Point(center.x, center.y);
		snapPreviewCircle = new paper.Path.Circle({
			center: previewCenter,
			radius,
			parent: previewLayer,
			strokeColor: new paper.Color(0.52, 0.82, 0.58, 0.95),
			fillColor: new paper.Color(0.74, 0.94, 0.78, 0.18),
			strokeWidth: 2 / paper.view.zoom
		});
		snapPreviewCircle.locked = true;
		syncLayerOrder();
	}

	function updateClosedPathSnapPreview(path: PaperPath, rawPoint: Point) {
		const gridSnap = getGridPointSnapState(rawPoint);
		if (
			gridSnap.eligible &&
			gridSnap.withinSnapRange &&
			gridSnap.targetPoint &&
			gridSnap.gridCoordinate
		) {
			snapPreviewStatus = `格点吸附 (${gridSnap.gridCoordinate.x}, ${gridSnap.gridCoordinate.y})`;
			updateSnapPreviewCircle(gridSnap.targetPoint, gridSnap.snapRadius);
			return;
		}

		const closedSnap = getClosedPathSnapState(path);
		if (!closedSnap.eligible || !closedSnap.withinSnapRange || !closedSnap.end) {
			clearClosedPathSnapPreview();
			return;
		}

		snapPreviewStatus = '';
		updateSnapPreviewCircle(closedSnap.end, closedSnap.snapRadius);
	}

	function closePathIfSnapped(path: PaperPath) {
		const state = getClosedPathSnapState(path);
		if (!state.eligible || !state.withinSnapRange || !state.start || !state.end) return false;

		path.lastSegment.point = state.start.clone();
		path.closed = true;
		return true;
	}

	function updateOriginHandle(point: Point) {
		const delta = {
			x: point.x - coordinateSystem.originCanvas.x,
			y: point.y - coordinateSystem.originCanvas.y
		};
		coordinateSystem = {
			...coordinateSystem,
			originCanvas: point,
			xAxisPoint: {
				x: coordinateSystem.xAxisPoint.x + delta.x,
				y: point.y
			}
		};
		drawCalibration();
		status = `原点已更新：${Math.round(point.x)}, ${Math.round(point.y)}`;
	}

	function updateUnitHandle(point: Point) {
		const direction = point.x >= coordinateSystem.originCanvas.x ? 1 : -1;
		const length = Math.max(Math.abs(point.x - coordinateSystem.originCanvas.x), 8);
		const axisPoint = {
			x: coordinateSystem.originCanvas.x + direction * length,
			y: coordinateSystem.originCanvas.y
		};
		coordinateSystem = {
			...coordinateSystem,
			xAxisPoint: axisPoint,
			unitCanvasLength: length,
			unitRealLength: unitRealLength || 1
		};
		drawCalibration();
		status = `单位长度已更新：${length.toFixed(1)} px = ${unitRealLength || 1}，坐标轴保持水平/垂直`;
	}

	function updateUnitRealLength(value: number) {
		if (!Number.isFinite(value) || value <= 0) return;
		commitEditorMutation(() => {
			unitRealLength = value;
			coordinateSystem = {
				...coordinateSystem,
				unitRealLength: value
			};
		}, '已更新真实单位长度');
	}

	function updateShowGrid(value: boolean) {
		commitEditorMutation(() => {
			showGrid = value;
		}, value ? '已显示坐标网格' : '已隐藏坐标网格');
	}

	function startPanelResize(panel: 'left' | 'right', event: PointerEvent) {
		if ((panel === 'left' && leftPanelCollapsed) || (panel === 'right' && rightPanelCollapsed)) {
			return;
		}
		resizingPanel = panel;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
		window.addEventListener('pointermove', handlePanelResize);
		window.addEventListener('pointerup', stopPanelResize);
		window.addEventListener('pointercancel', stopPanelResize);
	}

	function handlePanelResize(event: PointerEvent) {
		if (!resizingPanel) return;
		if (resizingPanel === 'left') {
			leftPanelWidth = clamp(event.clientX, 220, 460);
		} else {
			rightPanelWidth = clamp(window.innerWidth - event.clientX, 300, 620);
		}
		scheduleCanvasResize();
	}

	function stopPanelResize() {
		if (!resizingPanel) return;
		resizingPanel = null;
		document.body.style.cursor = '';
		document.body.style.userSelect = '';
		window.removeEventListener('pointermove', handlePanelResize);
		window.removeEventListener('pointerup', stopPanelResize);
		window.removeEventListener('pointercancel', stopPanelResize);
		scheduleCanvasResize();
		persistPanelLayout();
	}

	function startRightSectionResize(event: PointerEvent) {
		if (rightPanelCollapsed) return;
		resizingRightSection = true;
		rightSectionResizeStartY = event.clientY;
		rightSectionStartHeight = rightCurvesPanelHeight;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		document.body.style.cursor = 'row-resize';
		document.body.style.userSelect = 'none';
		window.addEventListener('pointermove', handleRightSectionResize);
		window.addEventListener('pointerup', stopRightSectionResize);
		window.addEventListener('pointercancel', stopRightSectionResize);
	}

	function handleRightSectionResize(event: PointerEvent) {
		if (!resizingRightSection || !rightPanelHost) return;
		const availableHeight = rightPanelHost.getBoundingClientRect().height;
		const minCurvesHeight = 80;
		const minOutputHeight = 120;
		const separatorHeight = 16;
		const maxCurvesHeight = Math.max(
			minCurvesHeight,
			availableHeight - rightSettingsPanelHeight - minOutputHeight - separatorHeight
		);

		rightCurvesPanelHeight = clamp(
			rightSectionStartHeight + event.clientY - rightSectionResizeStartY,
			minCurvesHeight,
			maxCurvesHeight
		);
	}

	function stopRightSectionResize() {
		if (!resizingRightSection) return;
		resizingRightSection = false;
		document.body.style.cursor = '';
		document.body.style.userSelect = '';
		window.removeEventListener('pointermove', handleRightSectionResize);
		window.removeEventListener('pointerup', stopRightSectionResize);
		window.removeEventListener('pointercancel', stopRightSectionResize);
		persistRightPanelLayout();
	}

	function togglePanel(panel: 'left' | 'right', event: MouseEvent) {
		event.stopPropagation();
		if (panel === 'left') {
			leftPanelCollapsed = !leftPanelCollapsed;
		} else {
			rightPanelCollapsed = !rightPanelCollapsed;
		}
		scheduleCanvasResize();
		persistPanelLayout();
	}

	function segmentsFromPath(path: PaperPath): CubicBezierSegment[] {
		const segments: CubicBezierSegment[] = [];

		const segmentCount = path.closed ? path.segments.length : path.segments.length - 1;
		for (let index = 0; index < segmentCount; index += 1) {
			const current = path.segments[index];
			const next = path.segments[(index + 1) % path.segments.length];
			const start = current.point;
			const end = next.point;
			segments.push({
				start: toPlainPoint(start),
				control1: toPlainPoint(start.add(current.handleOut)),
				control2: toPlainPoint(end.add(next.handleIn)),
				end: toPlainPoint(end)
			});
		}

		return segments;
	}

	function addCurveFromPath(path: PaperPath) {
		if (simplifyTolerance > 0) {
			path.simplify(simplifyTolerance);
		}
		if (smoothDrawnPath) {
			path.smooth({ type: 'continuous' });
		}
		const closed = closePathIfSnapped(path);
		const segments = segmentsFromPath(path);
		if (segments.length === 0) {
			path.remove();
			return;
		}

		const curve: CurvePath = {
			id: crypto.randomUUID(),
			name: `Curve ${curves.length + 1}`,
			segments,
			stroke,
			strokeWidth,
			closed
		};
		const nextStatus = closed
			? `已生成闭合 Bezier 曲线：${segments.length} 段`
			: `已生成 ${segments.length} 段 Bezier 曲线`;
		commitEditorMutation(
			() => {
				curves = [...curves, curve];
				selectedCurveIds = [curve.id];
				selectedObject = { type: 'curve', id: curve.id };
			},
			nextStatus
		);
		path.remove();
	}

	function updateCurveById(curveId: string, updater: (curve: CurvePath) => CurvePath) {
		curves = curves.map((curve) => (curve.id === curveId ? updater(curve) : curve));
		redrawCurves();
	}

	function moveCurveAnchor(curveId: string, anchorIndex: number, point: Point) {
		updateCurveById(curveId, (curve) => {
			const segments = curve.segments.map((segment) => ({ ...segment }));
			if (!segments.length) return curve;

			if (curve.closed) {
				const segmentIndex = anchorIndex % segments.length;
				const currentPoint = segments[segmentIndex].start;
				const delta = {
					x: point.x - currentPoint.x,
					y: point.y - currentPoint.y
				};
				const previousIndex = (segmentIndex - 1 + segments.length) % segments.length;
				segments[segmentIndex] = {
					...segments[segmentIndex],
					start: point,
					control1: {
						x: segments[segmentIndex].control1.x + delta.x,
						y: segments[segmentIndex].control1.y + delta.y
					}
				};
				segments[previousIndex] = {
					...segments[previousIndex],
					end: point,
					control2: {
						x: segments[previousIndex].control2.x + delta.x,
						y: segments[previousIndex].control2.y + delta.y
					}
				};
			} else if (anchorIndex === 0) {
				const delta = {
					x: point.x - segments[0].start.x,
					y: point.y - segments[0].start.y
				};
				segments[0] = {
					...segments[0],
					start: point,
					control1: {
						x: segments[0].control1.x + delta.x,
						y: segments[0].control1.y + delta.y
					}
				};
			} else if (anchorIndex === segments.length) {
				const lastIndex = segments.length - 1;
				const delta = {
					x: point.x - segments[lastIndex].end.x,
					y: point.y - segments[lastIndex].end.y
				};
				segments[lastIndex] = {
					...segments[lastIndex],
					end: point,
					control2: {
						x: segments[lastIndex].control2.x + delta.x,
						y: segments[lastIndex].control2.y + delta.y
					}
				};
			} else {
				const currentPoint = segments[anchorIndex].start;
				const delta = {
					x: point.x - currentPoint.x,
					y: point.y - currentPoint.y
				};
				segments[anchorIndex] = {
					...segments[anchorIndex],
					start: point,
					control1: {
						x: segments[anchorIndex].control1.x + delta.x,
						y: segments[anchorIndex].control1.y + delta.y
					}
				};
				segments[anchorIndex - 1] = {
					...segments[anchorIndex - 1],
					end: point,
					control2: {
						x: segments[anchorIndex - 1].control2.x + delta.x,
						y: segments[anchorIndex - 1].control2.y + delta.y
					}
				};
			}

			return { ...curve, segments };
		});
		status = '已更新路径锚点';
	}

	function moveCurveControlHandle(
		curveId: string,
		kind: 'control1' | 'control2',
		index: number,
		point: Point
	) {
		updateCurveById(curveId, (curve) => {
			const segments = curve.segments.map((segment) => ({ ...segment }));
			segments[index] = {
				...segments[index],
				[kind]: point
			};
			return { ...curve, segments };
		});
		status = kind === 'control1' ? '已更新出控制柄' : '已更新入控制柄';
	}

	function updateSelectedCurveStyle(
		changes: Partial<Pick<CurvePath, 'stroke' | 'strokeWidth'>>,
		statusMessage: string
	) {
		if (!selectedCurveIds.length) return;
		commitEditorMutation(() => {
			curves = curves.map((curve) =>
				selectedCurveIdSet.has(curve.id) ? { ...curve, ...changes } : curve
			);
		}, statusMessage);
	}

	function renameSelectedCurve(name: string) {
		if (!selectedCurveObject) return;
		const nextName = name.trim();
		if (!nextName || nextName === selectedCurveObject.name) return;
		commitEditorMutation(() => {
			curves = curves.map((curve) =>
				curve.id === selectedCurveObject.id ? { ...curve, name: nextName } : curve
			);
		}, '已更新路径名称');
	}

	function removeSelectedCurve() {
		if (!selectedCurveIds.length) return;
		const idsToRemove = new Set(selectedCurveIds);
		commitEditorMutation(() => {
			curves = curves.filter((curve) => !idsToRemove.has(curve.id));
			const nextSelectedCurveIds = curves.at(-1)?.id ? [curves.at(-1)!.id] : [];
			selectedCurveIds = nextSelectedCurveIds;
			selectedObject = nextSelectedCurveIds[0]
				? { type: 'curve', id: nextSelectedCurveIds[0] }
				: null;
		}, `已删除 ${idsToRemove.size} 条曲线`);
	}

	function clearCurves() {
		commitEditorMutation(() => {
			curves = [];
			selectedCurveIds = [];
			if (selectedObject?.type === 'curve') {
				selectedObject = null;
			}
		}, '已清空曲线');
	}

	function undoLastCurve() {
		const previous = undoHistory.at(-1);
		if (!previous) return;
		undoHistory = undoHistory.slice(0, -1);
		redoHistory = [...redoHistory, createEditorSnapshot()];
		applyEditorSnapshot(previous);
		status = '已撤销上一步操作';
	}

	function redoLastCurve() {
		const next = redoHistory.at(-1);
		if (!next) return;
		redoHistory = redoHistory.slice(0, -1);
		undoHistory = [...undoHistory, createEditorSnapshot()];
		applyEditorSnapshot(next);
		status = '已恢复上一步操作';
	}

	function handleShortcutKeydown(event: KeyboardEvent) {
		const target = event.target;
		if (
			target instanceof HTMLInputElement ||
			target instanceof HTMLTextAreaElement ||
			target instanceof HTMLSelectElement ||
			(target instanceof HTMLElement && target.isContentEditable)
		) {
			return;
		}

		const key = event.key.toLowerCase();
		if (key === 'escape') {
			if (selectedObject || selectedCurveIds.length) {
				event.preventDefault();
				clearObjectSelection();
				status = '已取消对象选择';
			}
			return;
		}

		if (key === 'delete' || key === 'backspace') {
			if (selectedCurveIds.length) {
				event.preventDefault();
				removeSelectedCurve();
			}
			return;
		}

		if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
		if (key === 'z' && !event.shiftKey) {
			event.preventDefault();
			undoLastCurve();
			return;
		}
		if (key === 'z' && event.shiftKey) {
			event.preventDefault();
			redoLastCurve();
			return;
		}
		if (key === 'y') {
			event.preventDefault();
			redoLastCurve();
		}
	}

	function drawCalibration() {
		if (!paper || !project) return;
		const layer = getOrCreateLayer('calibration');
		if (!layer) return;
		layer.removeChildren();
		const origin = new paper.Point(
			coordinateSystem.originCanvas.x,
			coordinateSystem.originCanvas.y
		);
		const xPoint = new paper.Point(coordinateSystem.xAxisPoint.x, coordinateSystem.xAxisPoint.y);
		const { xAxis, yAxis } = getBasis(coordinateSystem);
		const xDirection = new paper.Point(xAxis.x, xAxis.y);
		const yDirection = new paper.Point(-yAxis.x, -yAxis.y);
		const rawStep =
			coordinateSystem.unitCanvasLength /
			Math.max(Math.abs(coordinateSystem.unitRealLength), 0.0001);
		const gridInterval = Math.max(1, Math.ceil(32 / rawStep));
		const gridStep = rawStep * gridInterval;
		const bounds = paper.view.bounds.expand(gridStep * 2);
		const diagonal = Math.hypot(bounds.width, bounds.height) + gridStep * 4;
		const centerDelta = paper.view.center.subtract(origin);

		if (showGrid && Number.isFinite(gridStep) && gridStep > 0) {
			const xStart = Math.floor(centerDelta.dot(xDirection) / gridStep - diagonal / gridStep / 2);
			const xEnd = Math.ceil(centerDelta.dot(xDirection) / gridStep + diagonal / gridStep / 2);
			const yStart = Math.floor(centerDelta.dot(yDirection) / gridStep - diagonal / gridStep / 2);
			const yEnd = Math.ceil(centerDelta.dot(yDirection) / gridStep + diagonal / gridStep / 2);

			for (let index = xStart; index <= xEnd; index += 1) {
				if (index === 0) continue;
				const base = origin.add(xDirection.multiply(index * gridStep));
				new paper.Path.Line({
					from: base.subtract(yDirection.multiply(diagonal)),
					to: base.add(yDirection.multiply(diagonal)),
					strokeColor: '#e4e4e7',
					strokeWidth: 1 / paper.view.zoom,
					parent: layer
				});
			}

			for (let index = yStart; index <= yEnd; index += 1) {
				if (index === 0) continue;
				const base = origin.add(yDirection.multiply(index * gridStep));
				new paper.Path.Line({
					from: base.subtract(xDirection.multiply(diagonal)),
					to: base.add(xDirection.multiply(diagonal)),
					strokeColor: '#e4e4e7',
					strokeWidth: 1 / paper.view.zoom,
					parent: layer
				});
			}
		}

		new paper.Path.Line({
			from: origin.subtract(xDirection.multiply(diagonal)),
			to: origin.add(xDirection.multiply(diagonal)),
			strokeColor: '#111827',
			strokeWidth: 2 / paper.view.zoom,
			parent: layer
		});
		new paper.Path.Line({
			from: origin.subtract(yDirection.multiply(diagonal)),
			to: origin.add(yDirection.multiply(diagonal)),
			strokeColor: '#111827',
			strokeWidth: 2 / paper.view.zoom,
			parent: layer
		});
		new paper.Path.Circle({
			center: origin,
			radius: (activeHandle === 'origin' ? 8 : 5) / paper.view.zoom,
			fillColor: '#111827',
			strokeColor: '#ffffff',
			strokeWidth: 2 / paper.view.zoom,
			parent: layer
		});
		new paper.Path.Line({
			from: origin,
			to: xPoint,
			strokeColor: '#16a34a',
			strokeWidth: 3 / paper.view.zoom,
			dashArray: [8 / paper.view.zoom, 5 / paper.view.zoom],
			parent: layer
		});
		new paper.Path.Circle({
			center: xPoint,
			radius: (activeHandle === 'unit' ? 8 : 6) / paper.view.zoom,
			fillColor: '#2563eb',
			strokeColor: '#ffffff',
			strokeWidth: 2 / paper.view.zoom,
			parent: layer
		});
		new paper.PointText({
			point: origin.add([8 / paper.view.zoom, -8 / paper.view.zoom]),
			content: '(0,0)',
			fillColor: '#111827',
			fontSize: 12 / paper.view.zoom,
			parent: layer
		});
		new paper.PointText({
			point: xPoint.add([8 / paper.view.zoom, -8 / paper.view.zoom]),
			content: `x = ${coordinateSystem.unitRealLength}`,
			fillColor: '#2563eb',
			fontSize: 12 / paper.view.zoom,
			parent: layer
		});
		drawObjectSelectionOverlay();
		syncLayerOrder();
	}

	function redrawCurves() {
		if (!paper || !project) return;
		const layer = getOrCreateLayer('curves');
		if (!layer) return;
		layer.removeChildren();

		for (const curve of curves) {
			const selected = selectedCurveIdSet.has(curve.id);
			const path = new paper.Path({
				strokeColor: selected ? '#2563eb' : curve.stroke,
				strokeWidth: selected ? curve.strokeWidth + 1 : curve.strokeWidth,
				parent: layer,
				data: {
					curveId: curve.id,
					objectType: 'curve'
				}
			});

			for (const [index, segment] of curve.segments.entries()) {
				if (index === 0) path.moveTo(new paper.Point(segment.start.x, segment.start.y));
				path.cubicCurveTo(
					new paper.Point(segment.control1.x, segment.control1.y),
					new paper.Point(segment.control2.x, segment.control2.y),
					new paper.Point(segment.end.x, segment.end.y)
				);
			}

			path.closed = curve.closed;
		}

		syncLayerOrder();
		drawObjectSelectionOverlay();
		drawCalibration();
	}

	async function loadImage(file: File) {
		if (!paper || !project) return;
		if (image?.src) {
			URL.revokeObjectURL(image.src);
		}
		const src = URL.createObjectURL(file);
		image = {
			id: crypto.randomUUID(),
			name: file.name,
			src,
			x: 0,
			y: 0,
			width: 0,
			height: 0,
			opacity: 0.65,
			locked: true
		};

		const referenceLayer = getOrCreateLayer('reference');
		if (!referenceLayer) return;
		referenceLayer.removeChildren();
		referenceRaster?.remove();
		referenceRaster = new paper.Raster({
			source: src,
			parent: referenceLayer
		});
		referenceRaster.onLoad = () => {
			if (!referenceRaster) return;
			imageNaturalSize = {
				width: referenceRaster.width,
				height: referenceRaster.height
			};
			referenceRaster.position = paper!.view.center;
			referenceRaster.opacity = image?.opacity ?? 0.65;
			image = {
				...image!,
				x: referenceRaster.bounds.x,
				y: referenceRaster.bounds.y,
				width: referenceRaster.bounds.width,
				height: referenceRaster.bounds.height
			};
			setSelectedImage();
			fitImageToCanvas();
			syncLayerOrder();
			redrawCurves();
			status = `已载入参考图：${file.name}`;
		};
	}

	function updateImageOpacity() {
		if (!referenceRaster || !image) return;
		referenceRaster.opacity = image.opacity;
	}

	function beginSelectedImageOpacityEdit() {
		beginPendingEditHistory();
	}

	function updateSelectedImageOpacity(value: number) {
		if (!image) return;
		image = {
			...image,
			opacity: value
		};
		updateImageOpacity();
	}

	function commitSelectedImageOpacityEdit() {
		finalizePendingEditHistory('已更新参考图透明度');
	}

	function toggleSelectedImageLock() {
		if (!selectedImage) return;
		const nextLocked = !selectedImage.locked;
		commitEditorMutation(() => {
			image = {
				...selectedImage,
				locked: nextLocked
			};
		}, nextLocked ? '已锁定参考图' : '已解锁参考图');
	}

	function syncImageStateFromRaster() {
		if (!referenceRaster || !image) return;
		image = {
			...image,
			x: referenceRaster.bounds.x,
			y: referenceRaster.bounds.y,
			width: referenceRaster.bounds.width,
			height: referenceRaster.bounds.height
		};
		drawObjectSelectionOverlay();
	}

	function applyImageBounds(bounds: { x: number; y: number; width: number; height: number }) {
		if (!referenceRaster || !image || !paper) return;
		const safeWidth = Math.max(bounds.width, 24 / paper.view.zoom);
		const safeHeight = Math.max(bounds.height, 24 / paper.view.zoom);
		const rectangle = new paper.Rectangle(bounds.x, bounds.y, safeWidth, safeHeight);
		referenceRaster.fitBounds(rectangle, true);
		syncImageStateFromRaster();
	}

	function moveImageBy(delta: Point) {
		if (!referenceRaster || !image || !paper) return;
		referenceRaster.position = referenceRaster.position.add(new paper.Point(delta.x, delta.y));
		syncImageStateFromRaster();
	}

	function resizeImageFromHandle(handle: 'nw' | 'ne' | 'sw' | 'se', point: Point) {
		if (!image || !paper || !imageStartBounds) return;
		const startRect = new paper.Rectangle(
			imageStartBounds.x,
			imageStartBounds.y,
			imageStartBounds.width,
			imageStartBounds.height
		);
		const pointer = new paper.Point(point.x, point.y);
		const anchorMap = {
			nw: startRect.bottomRight,
			ne: startRect.bottomLeft,
			sw: startRect.topRight,
			se: startRect.topLeft
		};
		const anchor = anchorMap[handle];
		const dx = Math.abs(pointer.x - anchor.x);
		const dy = Math.abs(pointer.y - anchor.y);
		const scale = Math.max(dx / startRect.width, dy / startRect.height, 0.05);
		const width = startRect.width * scale;
		const height = startRect.height * scale;
		const nextBounds = {
			x: handle === 'nw' || handle === 'sw' ? anchor.x - width : anchor.x,
			y: handle === 'nw' || handle === 'ne' ? anchor.y - height : anchor.y,
			width,
			height
		};
		applyImageBounds(nextBounds);
	}

	function fitImageToCanvas() {
		if (!image || !referenceRaster || !paper || !imageNaturalSize) return;
		const padding = 32;
		const viewBounds = paper.view.bounds;
		const availableWidth = Math.max(viewBounds.width - padding * 2, 64);
		const availableHeight = Math.max(viewBounds.height - padding * 2, 64);
		const scale = Math.min(
			availableWidth / imageNaturalSize.width,
			availableHeight / imageNaturalSize.height,
			1
		);
		const width = imageNaturalSize.width * scale;
		const height = imageNaturalSize.height * scale;
		applyImageBounds({
			x: paper.view.center.x - width / 2,
			y: paper.view.center.y - height / 2,
			width,
			height
		});
	}

	function resetImageTransform() {
		if (!image || !paper || !imageNaturalSize) return;
		const width = imageNaturalSize.width;
		const height = imageNaturalSize.height;
		applyImageBounds({
			x: paper.view.center.x - width / 2,
			y: paper.view.center.y - height / 2,
			width,
			height
		});
	}

	function fitSelectedImageToCanvas() {
		if (!selectedImage) return;
		commitEditorMutation(() => {
			fitImageToCanvas();
		}, '已适配参考图到画布', { suppressRender: true });
	}

	function resetSelectedImageTransform() {
		if (!selectedImage) return;
		commitEditorMutation(() => {
			resetImageTransform();
		}, '已重置参考图变换', { suppressRender: true });
	}

	function resetView() {
		if (!paper) return;
		syncCanvasSize();
		paper.view.zoom = 1;
		paper.view.center = new paper.Point(
			coordinateSystem.originCanvas.x,
			coordinateSystem.originCanvas.y
		);
		drawCalibration();
	}

	function handleFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file) void loadImage(file);
	}

	function handleWheel(event: WheelEvent) {
		if (!paper) return;
		event.preventDefault();
		const oldZoom = paper.view.zoom;
		const factor = event.deltaY < 0 ? 1.1 : 0.9;
		const newZoom = Math.min(8, Math.max(0.2, oldZoom * factor));
		const mouse = new paper.Point(event.offsetX, event.offsetY);
		const viewPosition = paper.view.viewToProject(mouse);
		paper.view.zoom = newZoom;
		const newViewPosition = paper.view.viewToProject(mouse);
		paper.view.center = paper.view.center.add(viewPosition.subtract(newViewPosition));
		drawCalibration();
	}

	function toggleCurveSelection(id: string) {
		const nextSelectedCurveIds = selectedCurveIdSet.has(id)
			? selectedCurveIds.filter((selectedId) => selectedId !== id)
			: [...selectedCurveIds, id];
		selectedCurveIds = nextSelectedCurveIds;
		selectedObject = nextSelectedCurveIds[0]
			? { type: 'curve', id: nextSelectedCurveIds[0] }
			: null;
		redrawCurves();
		updateCurveSelectionStatus();
	}

	function selectAllCurves() {
		const nextSelectedCurveIds = curves.map((curve) => curve.id);
		selectedCurveIds = nextSelectedCurveIds;
		selectedObject = nextSelectedCurveIds[0]
			? { type: 'curve', id: nextSelectedCurveIds[0] }
			: null;
		redrawCurves();
		updateCurveSelectionStatus();
	}

	function clearCurveSelection() {
		selectedCurveIds = [];
		if (selectedObject?.type === 'curve') {
			selectedObject = null;
		}
		redrawCurves();
		updateCurveSelectionStatus();
	}

	async function copyExport() {
		if (!browser || !exportCode) return;
		await navigator.clipboard.writeText(exportCode);
		status = `${exportTitle}代码已复制`;
	}

	function downloadExport() {
		if (!browser || !exportCode) return;
		const blob = new Blob([exportCode], { type: 'text/plain;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = exportFileName;
		anchor.click();
		URL.revokeObjectURL(url);
	}

	onMount(async () => {
		loadPanelLayout();
		loadRightPanelLayout();
		loadBrushSettings();
		syncCanvasSize();
		window.addEventListener('keydown', handleShortcutKeydown);
		const paperModule = (await import('paper')).default;
		paper = paperModule;
		paperModule.setup(canvas);
		syncCanvasSize();
		project = paperModule.project;
		tool = new paperModule.Tool();
		canvasResizeObserver = new ResizeObserver(scheduleCanvasResize);
		canvasResizeObserver.observe(canvasHost);
		canvasResizeObserver.observe(rightPanelHost);

		tool.onMouseDown = (event: PaperMouseEvent) => {
			if (!paper) return;
			const point = toPlainPoint(event.point);
			const handle = activeTool === 'pan' ? hitCalibrationHandle(point) : null;

			if (handle) {
				beginPendingEditHistory();
				activeHandle = handle;
				document.body.classList.add('cursor-pan-tool');
				if (handle === 'origin') updateOriginHandle(point);
				else updateUnitHandle(point);
				return;
			}

			if (activeTool === 'pan') {
				const additiveSelection =
					!!event.modifiers.shift || !!event.modifiers.control || !!event.modifiers.command;
				const target = resolvePanPointerTarget(point);
				if (target?.kind === 'curve-handle') {
					beginPendingEditHistory();
					activeCurveHandle = target.curveHandle;
					setSelectedCurves([target.curveHandle.curveId]);
					updateCurveSelectionStatus();
					return;
				}

				if (target?.kind === 'image-handle') {
					beginPendingEditHistory();
					activeImageHandle = target.imageHandle;
					imageStartBounds = image
						? { x: image.x, y: image.y, width: image.width, height: image.height }
						: null;
					imageDragStartPoint = point;
					return;
				}

				if (target?.kind === 'image-body') {
					setSelectedImage();
					status = '已选中参考图';
					if (!image?.locked) {
						beginPendingEditHistory();
						activeImageHandle = 'move';
						imageDragStartPoint = point;
					}
					return;
				}

				if (target?.kind === 'curve') {
					updateCurveSelectionFromCanvas(target.curveId, additiveSelection);
					updateCurveSelectionStatus();
					return;
				}

				if (selectedObject && !additiveSelection) {
					clearObjectSelection();
				}
			}

			if (activeTool === 'brush') {
				clearClosedPathSnapPreview();
				activePath = new paper.Path({
					strokeColor: stroke,
					strokeWidth,
					strokeCap: 'round',
					strokeJoin: 'round',
					parent: getOrCreateLayer('curves') ?? undefined
				});
				const snappedPoint = getSnappedBrushPoint(point);
				activePath.add(new paper.Point(snappedPoint.x, snappedPoint.y));
				updateClosedPathSnapPreview(activePath, point);
				return;
			}

			if (activeTool === 'pan') {
				pointerStart = point;
				document.body.classList.add('cursor-pan-tool');
			}
		};

		tool.onMouseDrag = (event: PaperMouseEvent) => {
			if (!paper) return;
			if (activeHandle === 'origin') {
				updateOriginHandle(toPlainPoint(event.point));
				return;
			}
			if (activeHandle === 'unit') {
				updateUnitHandle(toPlainPoint(event.point));
				return;
			}
			if (activeTool === 'pan' && activeCurveHandle) {
				const point = toPlainPoint(event.point);
				if (activeCurveHandle.kind === 'anchor') {
					moveCurveAnchor(activeCurveHandle.curveId, activeCurveHandle.index, point);
				} else {
					moveCurveControlHandle(
						activeCurveHandle.curveId,
						activeCurveHandle.kind,
						activeCurveHandle.index,
						point
					);
				}
				return;
			}
			if (activeTool === 'pan' && activeImageHandle) {
				if (activeImageHandle === 'move') {
					moveImageBy({ x: event.delta.x, y: event.delta.y });
					return;
				}
				resizeImageFromHandle(activeImageHandle, toPlainPoint(event.point));
				return;
			}
			if (activeTool === 'brush' && activePath) {
				const rawPoint = toPlainPoint(event.point);
				const snappedPoint = getSnappedBrushPoint(rawPoint);
				activePath.add(new paper.Point(snappedPoint.x, snappedPoint.y));
				updateClosedPathSnapPreview(activePath, rawPoint);
			}
			if (activeTool === 'pan' && pointerStart) {
				paper.view.center = paper.view.center.subtract(event.delta);
				drawCalibration();
			}
		};

		tool.onMouseUp = () => {
			if (activeTool === 'brush' && activePath) {
				clearClosedPathSnapPreview();
				addCurveFromPath(activePath);
				activePath = null;
			}
			if (activeHandle) {
				finalizePendingEditHistory('已更新坐标校准');
			}
			if (activeCurveHandle) {
				finalizePendingEditHistory('已更新路径');
			}
			if (activeImageHandle) {
				finalizePendingEditHistory('已更新参考图');
			}
			activeCurveHandle = null;
			activeImageHandle = null;
			imageDragStartPoint = null;
			imageStartBounds = null;
			activeHandle = null;
			document.body.classList.remove('cursor-pan-tool');
			drawCalibration();
			pointerStart = null;
		};

		canvasReady = true;
		syncLayerOrder();
		drawCalibration();
	});

	onDestroy(() => {
		if (browser) {
			document.body.classList.remove('cursor-pan-tool');
			cancelAnimationFrame(canvasResizeFrame);
			window.removeEventListener('pointermove', handlePanelResize);
			window.removeEventListener('pointerup', stopPanelResize);
			window.removeEventListener('pointercancel', stopPanelResize);
			window.removeEventListener('pointermove', handleRightSectionResize);
			window.removeEventListener('pointerup', stopRightSectionResize);
			window.removeEventListener('pointercancel', stopRightSectionResize);
			window.removeEventListener('keydown', handleShortcutKeydown);
		}
		if (image?.src) {
			URL.revokeObjectURL(image.src);
		}
		clearClosedPathSnapPreview();
		canvasResizeObserver?.disconnect();
		tool?.remove();
		project?.remove();
	});
</script>

<svelte:head>
	<title>Bezier Curve Digitizer</title>
</svelte:head>

<main class="flex h-screen flex-col overflow-hidden bg-zinc-100 text-zinc-950">
	<Header onCopyExport={copyExport} onFileChange={handleFileChange} />

	<div class="grid min-h-0 flex-1" style:grid-template-columns={workspaceGridColumns}>
		<aside
			class={`min-h-0 overflow-y-auto border-r border-zinc-300 bg-white p-4 ${
				leftPanelCollapsed ? 'pointer-events-none invisible' : ''
			}`}
		>
			<Toolbar
				{activeTool}
				canUndo={undoHistory.length > 0}
				canRedo={redoHistory.length > 0}
				onSetTool={setTool}
				onUndo={undoLastCurve}
				onRedo={redoLastCurve}
			/>
			<BrushSettings
				bind:stroke
				bind:strokeWidth
				bind:simplifyTolerance
				bind:smoothDrawnPath
				bind:snapToGridPoints
				bind:snapClosedPaths
				bind:closedPathSnapDistance
			/>
			<CalibrationSettings
				{unitRealLength}
				{showGrid}
				onUpdateUnitRealLength={updateUnitRealLength}
				onUpdateShowGrid={updateShowGrid}
			/>
			<ObjectPropertiesPanel
				{selectedImage}
				{selectedCurves}
				{selectedCurveObject}
				onStartImageOpacityEdit={beginSelectedImageOpacityEdit}
				onUpdateImageOpacity={updateSelectedImageOpacity}
				onCommitImageOpacityEdit={commitSelectedImageOpacityEdit}
				onToggleImageLock={toggleSelectedImageLock}
				onFitImageToCanvas={fitSelectedImageToCanvas}
				onResetImageTransform={resetSelectedImageTransform}
				onRenameSelectedCurve={renameSelectedCurve}
				onUpdateSelectedCurveStyle={updateSelectedCurveStyle}
			/>
		</aside>

		<div class="grid place-items-center border-r border-zinc-300 bg-zinc-100">
			<button
				class="grid h-7 w-7 place-items-center rounded border border-zinc-300 bg-white shadow-sm hover:bg-zinc-50"
				aria-label={leftPanelCollapsed ? '显示左侧面板' : '隐藏左侧面板'}
				title={leftPanelCollapsed ? '显示左侧面板' : '隐藏左侧面板'}
				onclick={(event) => togglePanel('left', event)}
				type="button"
			>
				{#if leftPanelCollapsed}
					<PanelLeftOpen size={15} />
				{:else}
					<PanelLeftClose size={15} />
				{/if}
			</button>
		</div>

		<div
			role="separator"
			aria-orientation="vertical"
			aria-label="调整左侧面板宽度"
			class={`border-r border-zinc-300 bg-zinc-100 transition-colors ${
				leftPanelCollapsed ? 'cursor-default opacity-60' : 'cursor-col-resize hover:bg-blue-200'
			} ${resizingPanel === 'left' ? 'bg-blue-300' : ''}`}
			onpointerdown={(event) => startPanelResize('left', event)}
		></div>

		<CanvasWorkspace
			bind:canvas
			bind:hostElement={canvasHost}
			{canvasReady}
			{overlayStatus}
			{canvasCursorClass}
			onResetView={resetView}
			onWheel={handleWheel}
		/>

		<div
			role="separator"
			aria-orientation="vertical"
			aria-label="调整右侧面板宽度"
			class={`border-l border-zinc-300 bg-zinc-100 transition-colors ${
				rightPanelCollapsed ? 'cursor-default opacity-60' : 'cursor-col-resize hover:bg-blue-200'
			} ${resizingPanel === 'right' ? 'bg-blue-300' : ''}`}
			onpointerdown={(event) => startPanelResize('right', event)}
		></div>

		<div class="grid place-items-center border-l border-zinc-300 bg-zinc-100">
			<button
				class="grid h-7 w-7 place-items-center rounded border border-zinc-300 bg-white shadow-sm hover:bg-zinc-50"
				aria-label={rightPanelCollapsed ? '显示右侧面板' : '隐藏右侧面板'}
				title={rightPanelCollapsed ? '显示右侧面板' : '隐藏右侧面板'}
				onclick={(event) => togglePanel('right', event)}
				type="button"
			>
				{#if rightPanelCollapsed}
					<PanelRightOpen size={15} />
				{:else}
					<PanelRightClose size={15} />
				{/if}
			</button>
		</div>

		<aside
			bind:this={rightPanelHost}
			class={`flex min-h-0 flex-col border-l border-zinc-300 bg-white ${
				rightPanelCollapsed ? 'pointer-events-none invisible' : ''
			}`}
		>
			<div style:height={`${rightCurvesPanelHeight}px`}>
				<CurveListPanel
					{curves}
					{selectedCurveIds}
					onSelectAllCurves={selectAllCurves}
					onClearCurveSelection={clearCurveSelection}
					onRemoveSelectedCurve={removeSelectedCurve}
					onClearCurves={clearCurves}
					onToggleCurveSelection={toggleCurveSelection}
				/>
			</div>
			<ExportPanel
				{exportFormat}
				{precision}
				{exportCode}
				settingsHeight={rightSettingsPanelHeight}
				resizing={resizingRightSection}
				onResizeStart={startRightSectionResize}
				onUpdateFormat={(v) => (exportFormat = v)}
				onUpdatePrecision={(v) => (precision = v)}
				onDownload={downloadExport}
			/>
		</aside>
	</div>
</main>
