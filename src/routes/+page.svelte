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
	type ImageResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
	type ImageHandle = 'move' | 'rotate' | ImageResizeHandle;
	type ImageTransformSnapshot = Pick<CanvasImage, 'x' | 'y' | 'width' | 'height' | 'rotation'>;

	let paper: PaperScope | null = null;
	let canvas = $state<HTMLCanvasElement>();
	let canvasHost = $state<HTMLElement>();
	let rightPanelHost = $state<HTMLElement>();
	let tool: PaperTool | null = null;
	let project: PaperProject | null = null;
	let activePath: PaperPath | null = null;
	let referenceRaster: PaperRaster | null = null;
	let snapPreviewCircle: PaperPath | null = null;
	let pointPreviewPath: PaperPath | null = null;
	let canvasResizeObserver: ResizeObserver | null = null;
	let canvasResizeFrame = 0;
	let pointerStart: Point | null = null;
	let activeHandle: 'origin' | 'unit' | null = null;
	let activeImageHandle: ImageHandle | null = null;
	let activeCurveHandle:
		| {
				curveId: string;
				kind: 'anchor' | 'control1' | 'control2';
				index: number;
		  }
		| null = null;
	let imageStartTransform: ImageTransformSnapshot | null = null;
	let imageRotationStartAngle = 0;
	let imageNaturalSize: { width: number; height: number } | null = null;
	let hasInitializedCoordinateSystem = false;
	let pointModeAnchors = $state<Point[]>([]);
	let pointModeHoverPoint = $state<Point | null>(null);
	let pointModeLastClickAt = 0;
	let pointModeLastClickPoint: Point | null = null;

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
		...defaultCoordinateSystem
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
	let panelResizeStartX = 0;
	let panelResizeStartWidth = 0;
	let resizingRightSection = $state(false);
	let rightSectionResizeStartY = 0;
	let rightSectionStartHeight = 0;
	let canvasReady = $state(false);
	let status = $state('选择图片或直接用画笔描曲线');
	let snapPreviewStatus = $state('');
	let hoverCanvasCursor = $state<string | null>(null);

	let rightSettingsPanelHeight = $state(210);
	const leftPanelMinWidth = 296;
	const leftPanelMaxWidth = 460;

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
	let workspaceGridColumns = $derived(
		`${leftPanelCollapsed ? 0 : leftPanelWidth}px 28px 6px minmax(0, 1fr) 6px 28px ${rightPanelCollapsed ? 0 : rightPanelWidth}px`
	);
	let canvasCursorClass = $derived.by(() => {
		if (hoverCanvasCursor) return hoverCanvasCursor;
		return activeTool === 'pan' ? 'cursor-pan-tool' : 'cursor-crosshair';
	});
	let overlayStatus = $derived(snapPreviewStatus ? `${status} | ${snapPreviewStatus}` : status);

	const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

	function clampLeftPanelWidth(value: number) {
		return clamp(value, leftPanelMinWidth, leftPanelMaxWidth);
	}

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
			leftPanelWidth = clampLeftPanelWidth(parsed.left ?? leftPanelWidth);
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
		if (hasInitializedCoordinateSystem) return false;
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
		return true;
	}

	function syncCanvasSize() {
		if (!canvas) return;
		const size = measureCanvasHost();
		if (!size) return;
		const initializedNow = initializeCoordinateSystemFromCanvas(size);

		const previousCenter = paper?.view.center;
		const changed = canvas.width !== size.width || canvas.height !== size.height;
		if (!changed) return;

		canvas.width = size.width;
		canvas.height = size.height;

		if (paper) {
			paper.view.viewSize = new paper.Size(size.width, size.height) as PaperSize;
			if (initializedNow) {
				paper.view.center = new paper.Point(
					coordinateSystem.originCanvas.x,
					coordinateSystem.originCanvas.y
				);
			} else if (previousCenter) {
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
		else if (activeTool === 'point') status = '逐点点击描出路径，双击完成';
		else if (activeTool === 'pan') status = '拖动画布空白区域平移；也可拖动原点或单位点';
	}

	function setTool(mode: ToolMode) {
		if (activeTool === 'point' && mode !== 'point') {
			cancelPointModeDraft();
		}
		activeTool = mode;
		activeHandle = null;
		hoverCanvasCursor = null;
		clearClosedPathSnapPreview();
		document.body.classList.remove('cursor-pan-tool');
		updateStatusForTool();
	}

	function clearPointModePreview() {
		pointPreviewPath?.remove();
		pointPreviewPath = null;
		pointModeHoverPoint = null;
	}

	function cancelPointModeDraft() {
		pointModeAnchors = [];
		pointModeLastClickAt = 0;
		pointModeLastClickPoint = null;
		clearPointModePreview();
		clearClosedPathSnapPreview();
	}

	function createDefaultCubicSegment(start: Point, end: Point): CubicBezierSegment {
		return {
			start,
			control1: {
				x: start.x + (end.x - start.x) / 3,
				y: start.y + (end.y - start.y) / 3
			},
			control2: {
				x: start.x + ((end.x - start.x) * 2) / 3,
				y: start.y + ((end.y - start.y) * 2) / 3
			},
			end
		};
	}

	function buildSegmentsFromPoints(points: Point[]) {
		const segments: CubicBezierSegment[] = [];
		for (let index = 0; index < points.length - 1; index += 1) {
			segments.push(createDefaultCubicSegment(points[index], points[index + 1]));
		}
		return segments;
	}

	function getPointModeClosedSnapState(point: Point) {
		if (!snapClosedPaths || pointModeAnchors.length < 2) {
			return {
				eligible: false,
				withinSnapRange: false,
				snapRadius: 0,
				targetPoint: null as Point | null
			};
		}
		const targetPoint = pointModeAnchors[0];
		const snapRadius = getSnapRadius();
		return {
			eligible: true,
			withinSnapRange: distanceBetween(point, targetPoint) <= snapRadius,
			snapRadius,
			targetPoint
		};
	}

	function updatePointModePreview(hoverPoint?: Point | null) {
		if (!paper) return;
		pointPreviewPath?.remove();
		pointPreviewPath = null;
		const draftPoints = [...pointModeAnchors];
		const nextHoverPoint = hoverPoint ?? pointModeHoverPoint;
		if (nextHoverPoint) {
			pointModeHoverPoint = nextHoverPoint;
		}
		if (nextHoverPoint && pointModeAnchors.length) {
			draftPoints.push(nextHoverPoint);
		}
		if (!draftPoints.length) return;
		const previewLayer = getOrCreateLayer('preview');
		if (!previewLayer) return;
		pointPreviewPath = new paper.Path({
			strokeColor: '#f59e0b',
			strokeWidth: 2 / paper.view.zoom,
			dashArray: [8 / paper.view.zoom, 5 / paper.view.zoom],
			parent: previewLayer
		});
		pointPreviewPath.moveTo(new paper.Point(draftPoints[0].x, draftPoints[0].y));
		const previewSegments = buildSegmentsFromPoints(draftPoints);
		for (const segment of previewSegments) {
			pointPreviewPath.cubicCurveTo(
				new paper.Point(segment.control1.x, segment.control1.y),
				new paper.Point(segment.control2.x, segment.control2.y),
				new paper.Point(segment.end.x, segment.end.y)
			);
		}
		syncLayerOrder();
	}

	function commitPointModeCurve(options?: { closed?: boolean; finalPoint?: Point | null }) {
		const closed = options?.closed ?? false;
		const finalPoint = options?.finalPoint ?? null;
		const points = closed && finalPoint ? [...pointModeAnchors, finalPoint] : [...pointModeAnchors];
		if (points.length < 2) {
			cancelPointModeDraft();
			setTool('pan');
			return;
		}
		const segments = buildSegmentsFromPoints(points);
		const nextCurve: CurvePath = {
			id: crypto.randomUUID(),
			name: `Curve ${curves.length + 1}`,
			segments,
			stroke,
			strokeWidth,
			closed
		};
		commitEditorMutation(() => {
			curves = [...curves, nextCurve];
			selectedCurveIds = [nextCurve.id];
			selectedObject = { type: 'curve', id: nextCurve.id };
		}, closed ? '已吸附到起点并闭合路径' : '已完成描点路径');
		cancelPointModeDraft();
		setTool('pan');
		updateCurveSelectionStatus();
	}

	function isPointModeDoubleClick(point: Point) {
		const now = Date.now();
		const isDoubleClick =
			!!pointModeLastClickPoint &&
			now - pointModeLastClickAt <= 300 &&
			distanceBetween(pointModeLastClickPoint, point) <= 8 / (paper?.view.zoom ?? 1);
		pointModeLastClickAt = now;
		pointModeLastClickPoint = point;
		return isDoubleClick;
	}

	function addPointModeAnchor(point: Point) {
		const lastPoint = pointModeAnchors.at(-1);
		if (lastPoint && distanceBetween(lastPoint, point) < 0.5) {
			return;
		}
		const nextAnchors = [...pointModeAnchors, point];
		pointModeAnchors = nextAnchors;
		pointModeHoverPoint = point;
		updatePointModePreview(point);
		status =
			nextAnchors.length === 1
				? '已落下起点，继续点击添加下一点'
				: `已添加第 ${nextAnchors.length} 个描点，双击完成`;
	}

	function getCursorClassForImageHandle(handle: ImageResizeHandle) {
		switch (handle) {
			case 'nw':
			case 'se':
				return 'cursor-nwse-resize';
			case 'ne':
			case 'sw':
				return 'cursor-nesw-resize';
			case 'n':
			case 's':
				return 'cursor-ns-resize';
			case 'e':
			case 'w':
				return 'cursor-ew-resize';
		}
	}

	function getImageCenter(source: Pick<CanvasImage, 'x' | 'y' | 'width' | 'height'>) {
		return {
			x: source.x + source.width / 2,
			y: source.y + source.height / 2
		};
	}

	function rotatePoint(point: Point, center: Point, angleDegrees: number) {
		const radians = (angleDegrees * Math.PI) / 180;
		const cos = Math.cos(radians);
		const sin = Math.sin(radians);
		const dx = point.x - center.x;
		const dy = point.y - center.y;
		return {
			x: center.x + dx * cos - dy * sin,
			y: center.y + dx * sin + dy * cos
		};
	}

	function rotateVector(vector: Point, angleDegrees: number) {
		const radians = (angleDegrees * Math.PI) / 180;
		const cos = Math.cos(radians);
		const sin = Math.sin(radians);
		return {
			x: vector.x * cos - vector.y * sin,
			y: vector.x * sin + vector.y * cos
		};
	}

	function toImageLocalVector(point: Point, source: ImageTransformSnapshot) {
		const center = getImageCenter(source);
		return rotateVector(
			{
				x: point.x - center.x,
				y: point.y - center.y
			},
			-source.rotation
		);
	}

	function normalizeDegrees(angle: number) {
		let normalized = angle % 360;
		if (normalized > 180) normalized -= 360;
		if (normalized <= -180) normalized += 360;
		return normalized;
	}

	function getImageSelectionGeometry(source: CanvasImage) {
		const center = getImageCenter(source);
		const baseCorners = {
			nw: { x: source.x, y: source.y },
			ne: { x: source.x + source.width, y: source.y },
			se: { x: source.x + source.width, y: source.y + source.height },
			sw: { x: source.x, y: source.y + source.height }
		};
		const corners = {
			nw: rotatePoint(baseCorners.nw, center, source.rotation),
			ne: rotatePoint(baseCorners.ne, center, source.rotation),
			se: rotatePoint(baseCorners.se, center, source.rotation),
			sw: rotatePoint(baseCorners.sw, center, source.rotation)
		};
		const edgeCenters = {
			n: {
				x: (corners.nw.x + corners.ne.x) / 2,
				y: (corners.nw.y + corners.ne.y) / 2
			},
			e: {
				x: (corners.ne.x + corners.se.x) / 2,
				y: (corners.ne.y + corners.se.y) / 2
			},
			s: {
				x: (corners.sw.x + corners.se.x) / 2,
				y: (corners.sw.y + corners.se.y) / 2
			},
			w: {
				x: (corners.nw.x + corners.sw.x) / 2,
				y: (corners.nw.y + corners.sw.y) / 2
			}
		};
		const rotateOffset = rotateVector({ x: 0, y: -28 / (paper?.view.zoom ?? 1) }, source.rotation);
		return {
			corners,
			handles: {
				...corners,
				...edgeCenters
			},
			rotationStemStart: edgeCenters.n,
			rotationHandle: {
				x: edgeCenters.n.x + rotateOffset.x,
				y: edgeCenters.n.y + rotateOffset.y
			}
		};
	}

	function updateCanvasHoverCursor(point: Point) {
		if (!paper || activeHandle || activeCurveHandle || activeImageHandle || pointerStart || activePath) {
			hoverCanvasCursor = null;
			return;
		}

		if (activeTool !== 'pan') {
			hoverCanvasCursor = null;
			return;
		}

		const calibrationHandle = hitCalibrationHandle(point);
		if (calibrationHandle) {
			hoverCanvasCursor = 'cursor-pan-tool';
			return;
		}

		const target = resolvePanPointerTarget(point);
		if (!target) {
			hoverCanvasCursor = 'cursor-pan-tool';
			return;
		}

			switch (target.kind) {
			case 'image-handle':
				hoverCanvasCursor =
					target.imageHandle === 'rotate'
						? 'cursor-rotate-tool'
						: getCursorClassForImageHandle(target.imageHandle);
				return;
			case 'image-body':
			case 'curve-handle':
				hoverCanvasCursor = 'cursor-pan-tool';
				return;
			case 'curve':
				hoverCanvasCursor = 'cursor-pointer';
				return;
		}
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

	function applyImageStateToRaster() {
		if (!paper || !referenceRaster || !image || !imageNaturalSize) return;
		const safeWidth = Math.max(image.width, 24 / paper.view.zoom);
		const safeHeight = Math.max(image.height, 24 / paper.view.zoom);
		const center = getImageCenter(image);
		referenceRaster.matrix = new paper.Matrix();
		referenceRaster.position = new paper.Point(center.x, center.y);
		referenceRaster.scale(safeWidth / imageNaturalSize.width, safeHeight / imageNaturalSize.height);
		referenceRaster.position = new paper.Point(center.x, center.y);
		if (image.rotation !== 0) {
			referenceRaster.rotate(image.rotation, new paper.Point(center.x, center.y));
		}
		referenceRaster.opacity = image.opacity;
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
				applyImageStateToRaster();
				drawObjectSelectionOverlay();
			};
			return;
		}

		applyImageStateToRaster();
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
		imageStartTransform = null;
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
	function drawObjectSelectionOverlay() {
		if (!paper || !project) return;
		const scope = paper;
		const layer = getOrCreateLayer('selection');
		if (!layer) return;
		layer.removeChildren();

		if (selectedImage) {
			const geometry = getImageSelectionGeometry(selectedImage);
			new scope.Path({
				segments: [
					new scope.Point(geometry.corners.nw.x, geometry.corners.nw.y),
					new scope.Point(geometry.corners.ne.x, geometry.corners.ne.y),
					new scope.Point(geometry.corners.se.x, geometry.corners.se.y),
					new scope.Point(geometry.corners.sw.x, geometry.corners.sw.y)
				],
				closed: true,
				strokeColor: '#16a34a',
				strokeWidth: 2 / scope.view.zoom,
				dashArray: [8 / scope.view.zoom, 5 / scope.view.zoom],
				parent: layer
			});
			if (!selectedImage.locked) {
				new scope.Path.Line({
					from: new scope.Point(
						geometry.rotationStemStart.x,
						geometry.rotationStemStart.y
					),
					to: new scope.Point(geometry.rotationHandle.x, geometry.rotationHandle.y),
					strokeColor: '#16a34a',
					strokeWidth: 2 / scope.view.zoom,
					parent: layer
				});
				new scope.Path.Circle({
					center: new scope.Point(geometry.rotationHandle.x, geometry.rotationHandle.y),
					radius: 6 / scope.view.zoom,
					fillColor: '#ffffff',
					strokeColor: '#16a34a',
					strokeWidth: 2 / scope.view.zoom,
					parent: layer,
					data: { imageHandle: 'rotate' }
				});
				const handles = geometry.handles;
				const cornerNames = ['nw', 'ne', 'se', 'sw'] as const;
				const edgeNames = ['n', 'e', 's', 'w'] as const;
				const handleSize = 6 / scope.view.zoom;
				for (const name of cornerNames) {
					const center = handles[name];
					const rect = new scope.Rectangle(
						center.x - handleSize,
						center.y - handleSize,
						handleSize * 2,
						handleSize * 2
					);
					new scope.Path.Rectangle({
						rectangle: rect,
						fillColor: '#ffffff',
						strokeColor: '#16a34a',
						strokeWidth: 2 / scope.view.zoom,
						parent: layer,
						data: { imageHandle: name }
					});
				}
				for (const name of edgeNames) {
					const center = handles[name];
					new scope.Path.Circle({
						center: new scope.Point(center.x, center.y),
						radius: 5 / scope.view.zoom,
						fillColor: '#ffffff',
						strokeColor: '#16a34a',
						strokeWidth: 2 / scope.view.zoom,
						parent: layer,
						data: { imageHandle: name }
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
		if (selectedObject?.type !== 'image' || !image || !paper) return null;
		const selectionLayer = getOrCreateLayer('selection');
		if (!selectionLayer) return null;
			const hit = selectionLayer.hitTest(new paper.Point(point.x, point.y), {
				fill: true,
				stroke: true,
			tolerance: 10 / paper.view.zoom,
			match: (result: paper.HitResult) => typeof result.item.data?.imageHandle === 'string'
		});
		return (hit?.item?.data?.imageHandle as Exclude<ImageHandle, 'move'> | undefined) ?? null;
		}

	function hitImageBody(point: Point) {
		if (!image || !referenceRaster || !paper) return false;
		return referenceRaster.contains(new paper.Point(point.x, point.y));
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

		const isImageSelected = selectedObject?.type === 'image' && image && !image.locked;
		if (isImageSelected) {
			const imageHandle = hitImageHandle(point);
			if (imageHandle) {
				return { kind: 'image-handle' as const, imageHandle };
			}
		}

		const curveId = hitCurve(point);
		const imageBodyHit = hitImageBody(point);

		if (isImageSelected && imageBodyHit) {
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
		panelResizeStartX = event.clientX;
		panelResizeStartWidth = panel === 'left' ? leftPanelWidth : rightPanelWidth;
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
			leftPanelWidth = clampLeftPanelWidth(
				panelResizeStartWidth + (event.clientX - panelResizeStartX)
			);
		} else {
			rightPanelWidth = clamp(
				panelResizeStartWidth - (event.clientX - panelResizeStartX),
				300,
				620
			);
		}
		scheduleCanvasResize();
	}

	function stopPanelResize() {
		if (!resizingPanel) return;
		resizingPanel = null;
		panelResizeStartX = 0;
		panelResizeStartWidth = 0;
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

	function removeSelectedImage() {
		if (!selectedImage) return;
		commitEditorMutation(() => {
			image = null;
			selectedObject = null;
			selectedCurveIds = [];
		}, '已删除参考图');
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
			if (activeTool === 'point' && pointModeAnchors.length) {
				event.preventDefault();
				cancelPointModeDraft();
				status = '已取消描点';
				return;
			}
			if (selectedObject || selectedCurveIds.length) {
				event.preventDefault();
				clearObjectSelection();
				status = '已取消对象选择';
			}
			return;
		}

		if (key === 'delete' || key === 'backspace') {
			if (selectedObject?.type === 'image' && selectedImage) {
				event.preventDefault();
				removeSelectedImage();
				return;
			}
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
		if (activeTool === 'point' || pointModeAnchors.length) {
			updatePointModePreview();
		}
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
			rotation: 0,
			opacity: 0.65,
			locked: false
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
			image = {
				...image!,
				x: paper!.view.center.x - imageNaturalSize.width / 2,
				y: paper!.view.center.y - imageNaturalSize.height / 2,
				width: imageNaturalSize.width,
				height: imageNaturalSize.height,
				rotation: 0
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

	function applyImageBounds(bounds: { x: number; y: number; width: number; height: number }) {
		if (!referenceRaster || !image || !paper) return;
		const safeWidth = Math.max(bounds.width, 24 / paper.view.zoom);
		const safeHeight = Math.max(bounds.height, 24 / paper.view.zoom);
		image = {
			...image,
			x: bounds.x,
			y: bounds.y,
			width: safeWidth,
			height: safeHeight
		};
		applyImageStateToRaster();
		drawObjectSelectionOverlay();
	}

	function moveImageBy(delta: Point) {
		if (!referenceRaster || !image || !paper) return;
		image = {
			...image,
			x: image.x + delta.x,
			y: image.y + delta.y
		};
		applyImageStateToRaster();
		drawObjectSelectionOverlay();
	}


	function resizeImageFromHandle(
		handle: ImageResizeHandle,
		point: Point,
		preserveAspectRatio = false
	) {
		if (!image || !paper || !imageStartTransform) return;
		const minWidth = 24 / paper.view.zoom;
		const minHeight = 24 / paper.view.zoom;
		const start = imageStartTransform;
		const localPoint = toImageLocalVector(point, start);
		const aspectRatio = start.width / start.height;
		let left = -start.width / 2;
		let right = start.width / 2;
		let top = -start.height / 2;
		let bottom = start.height / 2;

		switch (handle) {
			case 'nw':
				left = Math.min(localPoint.x, right - minWidth);
				top = Math.min(localPoint.y, bottom - minHeight);
				break;
			case 'n':
				top = Math.min(localPoint.y, bottom - minHeight);
				break;
			case 'ne':
				right = Math.max(localPoint.x, left + minWidth);
				top = Math.min(localPoint.y, bottom - minHeight);
				break;
			case 'e':
				right = Math.max(localPoint.x, left + minWidth);
				break;
			case 'se':
				right = Math.max(localPoint.x, left + minWidth);
				bottom = Math.max(localPoint.y, top + minHeight);
				break;
			case 's':
				bottom = Math.max(localPoint.y, top + minHeight);
				break;
			case 'sw':
				left = Math.min(localPoint.x, right - minWidth);
				bottom = Math.max(localPoint.y, top + minHeight);
				break;
			case 'w':
				left = Math.min(localPoint.x, right - minWidth);
				break;
		}

		if (preserveAspectRatio) {
			switch (handle) {
				case 'nw': {
					const fixedRight = start.width / 2;
					const fixedBottom = start.height / 2;
					let width = Math.max(fixedRight - localPoint.x, minWidth);
					let height = Math.max(fixedBottom - localPoint.y, minHeight);
					if (width / aspectRatio >= height) {
						height = Math.max(width / aspectRatio, minHeight);
					} else {
						width = Math.max(height * aspectRatio, minWidth);
					}
					left = fixedRight - width;
					top = fixedBottom - height;
					right = fixedRight;
					bottom = fixedBottom;
					break;
				}
				case 'ne': {
					const fixedLeft = -start.width / 2;
					const fixedBottom = start.height / 2;
					let width = Math.max(localPoint.x - fixedLeft, minWidth);
					let height = Math.max(fixedBottom - localPoint.y, minHeight);
					if (width / aspectRatio >= height) {
						height = Math.max(width / aspectRatio, minHeight);
					} else {
						width = Math.max(height * aspectRatio, minWidth);
					}
					left = fixedLeft;
					top = fixedBottom - height;
					right = fixedLeft + width;
					bottom = fixedBottom;
					break;
				}
				case 'se': {
					const fixedLeft = -start.width / 2;
					const fixedTop = -start.height / 2;
					let width = Math.max(localPoint.x - fixedLeft, minWidth);
					let height = Math.max(localPoint.y - fixedTop, minHeight);
					if (width / aspectRatio >= height) {
						height = Math.max(width / aspectRatio, minHeight);
					} else {
						width = Math.max(height * aspectRatio, minWidth);
					}
					left = fixedLeft;
					top = fixedTop;
					right = fixedLeft + width;
					bottom = fixedTop + height;
					break;
				}
				case 'sw': {
					const fixedRight = start.width / 2;
					const fixedTop = -start.height / 2;
					let width = Math.max(fixedRight - localPoint.x, minWidth);
					let height = Math.max(localPoint.y - fixedTop, minHeight);
					if (width / aspectRatio >= height) {
						height = Math.max(width / aspectRatio, minHeight);
					} else {
						width = Math.max(height * aspectRatio, minWidth);
					}
					left = fixedRight - width;
					top = fixedTop;
					right = fixedRight;
					bottom = fixedTop + height;
					break;
				}
				case 'n': {
					const fixedBottom = start.height / 2;
					const height = Math.max(fixedBottom - localPoint.y, minHeight);
					const width = Math.max(height * aspectRatio, minWidth);
					const centerX = 0;
					left = centerX - width / 2;
					right = centerX + width / 2;
					top = fixedBottom - height;
					bottom = fixedBottom;
					break;
				}
				case 's': {
					const fixedTop = -start.height / 2;
					const height = Math.max(localPoint.y - fixedTop, minHeight);
					const width = Math.max(height * aspectRatio, minWidth);
					const centerX = 0;
					left = centerX - width / 2;
					right = centerX + width / 2;
					top = fixedTop;
					bottom = fixedTop + height;
					break;
				}
				case 'e': {
					const fixedLeft = -start.width / 2;
					const width = Math.max(localPoint.x - fixedLeft, minWidth);
					const height = Math.max(width / aspectRatio, minHeight);
					const centerY = 0;
					left = fixedLeft;
					right = fixedLeft + width;
					top = centerY - height / 2;
					bottom = centerY + height / 2;
					break;
				}
				case 'w': {
					const fixedRight = start.width / 2;
					const width = Math.max(fixedRight - localPoint.x, minWidth);
					const height = Math.max(width / aspectRatio, minHeight);
					const centerY = 0;
					left = fixedRight - width;
					right = fixedRight;
					top = centerY - height / 2;
					bottom = centerY + height / 2;
					break;
				}
			}
		}

		const width = right - left;
		const height = bottom - top;
		const localCenter = {
			x: (left + right) / 2,
			y: (top + bottom) / 2
		};
		const startCenter = getImageCenter(start);
		const centerOffset = rotateVector(localCenter, start.rotation);
		const nextCenter = {
			x: startCenter.x + centerOffset.x,
			y: startCenter.y + centerOffset.y
		};

		applyImageBounds({
			x: nextCenter.x - width / 2,
			y: nextCenter.y - height / 2,
			width,
			height
		});
	}

	function rotateImageFromHandle(point: Point) {
		if (!image || !imageStartTransform) return;
		const center = getImageCenter(imageStartTransform);
		const angle = Math.atan2(point.y - center.y, point.x - center.x) * (180 / Math.PI);
		image = {
			...image,
			rotation: normalizeDegrees(imageStartTransform.rotation + (angle - imageRotationStartAngle))
		};
		applyImageStateToRaster();
		drawObjectSelectionOverlay();
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
		image = {
			...image,
			x: paper.view.center.x - width / 2,
			y: paper.view.center.y - height / 2,
			width,
			height,
			rotation: 0
		};
		applyImageStateToRaster();
		drawObjectSelectionOverlay();
	}

	function resetImageTransform() {
		if (!image || !paper || !imageNaturalSize) return;
		const width = imageNaturalSize.width;
		const height = imageNaturalSize.height;
		image = {
			...image,
			x: paper.view.center.x - width / 2,
			y: paper.view.center.y - height / 2,
			width,
			height,
			rotation: 0
		};
		applyImageStateToRaster();
		drawObjectSelectionOverlay();
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
		status = `${exportFormat === 'luadraw' ? 'LuaDraw 输出' : exportFormat === 'cetz' ? 'CeTZ 输出' : 'TikZ 输出'}代码已复制`;
	}

	function downloadExport() {
		if (!browser || !exportCode) return;
		const blob = new Blob([exportCode], { type: 'text/plain;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = exportFormat === 'luadraw' ? 'curves.lua' : exportFormat === 'cetz' ? 'curves.typ' : 'curves.tikz';
		anchor.click();
		URL.revokeObjectURL(url);
	}

	onMount(async () => {
		loadPanelLayout();
		loadRightPanelLayout();
		loadBrushSettings();
		window.addEventListener('keydown', handleShortcutKeydown);
		const paperModule = (await import('paper')).default;
		paper = paperModule;
		paperModule.setup(canvas!);
		syncCanvasSize();
		project = paperModule.project;
		tool = new paperModule.Tool();
		canvasResizeObserver = new ResizeObserver(scheduleCanvasResize);
		canvasResizeObserver.observe(canvasHost!);
		canvasResizeObserver.observe(rightPanelHost!);

		tool.onMouseDown = (event: PaperMouseEvent) => {
			if (!paper) return;
			const point = toPlainPoint(event.point);
			hoverCanvasCursor = null;
			if (activeTool === 'point') {
				const closedSnap = getPointModeClosedSnapState(point);
				if (closedSnap.eligible && closedSnap.withinSnapRange && closedSnap.targetPoint) {
					updateSnapPreviewCircle(closedSnap.targetPoint, closedSnap.snapRadius);
					snapPreviewStatus = '吸附到起点，点击闭合路径';
					commitPointModeCurve({ closed: true, finalPoint: closedSnap.targetPoint });
					return;
				}
				const snappedPoint = getSnappedBrushPoint(point);
				const gridSnap = getGridPointSnapState(point);
				if (
					gridSnap.eligible &&
					gridSnap.withinSnapRange &&
					gridSnap.targetPoint &&
					gridSnap.gridCoordinate
				) {
					updateSnapPreviewCircle(gridSnap.targetPoint, gridSnap.snapRadius);
					snapPreviewStatus = `格点吸附 (${gridSnap.gridCoordinate.x}, ${gridSnap.gridCoordinate.y})`;
				} else {
					clearClosedPathSnapPreview();
				}
				addPointModeAnchor(snappedPoint);
				if (isPointModeDoubleClick(snappedPoint)) {
					commitPointModeCurve();
				}
				return;
			}
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
					clearClosedPathSnapPreview();
					setSelectedCurves([target.curveHandle.curveId]);
					updateCurveSelectionStatus();
					return;
				}

				if (target?.kind === 'image-handle') {
					beginPendingEditHistory();
					activeImageHandle = target.imageHandle;
					imageStartTransform = image
						? {
								x: image.x,
								y: image.y,
								width: image.width,
								height: image.height,
								rotation: image.rotation
							}
						: null;
					if (target.imageHandle === 'rotate' && imageStartTransform) {
						const center = getImageCenter(imageStartTransform);
						imageRotationStartAngle =
							Math.atan2(point.y - center.y, point.x - center.x) * (180 / Math.PI);
					}
					return;
				}

				if (target?.kind === 'image-body') {
					setSelectedImage();
					status = '已选中参考图';
					if (!image?.locked) {
						beginPendingEditHistory();
						activeImageHandle = 'move';
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
			hoverCanvasCursor = null;
			if (activeHandle === 'origin') {
				updateOriginHandle(toPlainPoint(event.point));
				return;
			}
			if (activeHandle === 'unit') {
				updateUnitHandle(toPlainPoint(event.point));
				return;
			}
			if (activeTool === 'pan' && activeCurveHandle) {
				const rawPoint = toPlainPoint(event.point);
				const handle = activeCurveHandle!;
				let snappedPoint = getSnappedBrushPoint(rawPoint);
				const curve = curves.find((c) => c.id === handle.curveId);
				if (snapClosedPaths && curve && !curve.closed && handle.kind === 'anchor') {
					const snapRadius = getSnapRadius();
					const segCount = curve.segments.length;
					let targetPoint: Point | null = null;
					if (handle.index === 0) {
						const endPoint = curve.segments[segCount - 1].end;
						if (distanceBetween(rawPoint, endPoint) <= snapRadius) targetPoint = endPoint;
					} else if (handle.index === segCount) {
						const startPoint = curve.segments[0].start;
						if (distanceBetween(rawPoint, startPoint) <= snapRadius) targetPoint = startPoint;
					}
					if (targetPoint) {
						snappedPoint = targetPoint;
						updateSnapPreviewCircle(targetPoint, snapRadius);
						snapPreviewStatus = '';
					}
				}
				if (handle.kind === 'anchor') {
					moveCurveAnchor(handle.curveId, handle.index, snappedPoint);
				} else {
					moveCurveControlHandle(
						handle.curveId,
						handle.kind,
						handle.index,
						snappedPoint
					);
				}
				const gridSnap = getGridPointSnapState(rawPoint);
				if (gridSnap.eligible && gridSnap.withinSnapRange && gridSnap.targetPoint && gridSnap.gridCoordinate) {
					updateSnapPreviewCircle(gridSnap.targetPoint, gridSnap.snapRadius);
					snapPreviewStatus = `格点吸附 (${gridSnap.gridCoordinate.x}, ${gridSnap.gridCoordinate.y})`;
				} else if (!(snapClosedPaths && curve && !curve.closed && handle.kind === 'anchor')) {
					clearClosedPathSnapPreview();
				}
				return;
			}
			if (activeTool === 'pan' && activeImageHandle) {
				if (activeImageHandle === 'move') {
					moveImageBy({ x: event.delta.x, y: event.delta.y });
					return;
				}
				if (activeImageHandle === 'rotate') {
					rotateImageFromHandle(toPlainPoint(event.point));
					return;
				}
				resizeImageFromHandle(
					activeImageHandle,
					toPlainPoint(event.point),
					!!event.modifiers.shift
				);
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
				const handle = activeCurveHandle!;
				const dragCurve = curves.find((c) => c.id === handle.curveId);
				if (
					snapClosedPaths &&
					dragCurve &&
					!dragCurve.closed &&
					handle.kind === 'anchor' &&
					(handle.index === 0 || handle.index === dragCurve.segments.length)
				) {
					const snapRadius = getSnapRadius();
					const segCount = dragCurve.segments.length;
					const startPoint = dragCurve.segments[0].start;
					const endPoint = dragCurve.segments[segCount - 1].end;
					if (distanceBetween(startPoint, endPoint) <= snapRadius) {
						if (handle.index === 0) {
							moveCurveAnchor(handle.curveId, 0, endPoint);
						} else {
							moveCurveAnchor(handle.curveId, segCount, startPoint);
						}
						curves = curves.map((c) =>
							c.id === handle.curveId ? { ...c, closed: true } : c
						);
						redrawCurves();
					}
				}
				finalizePendingEditHistory('已更新路径');
				clearClosedPathSnapPreview();
			}
			if (activeImageHandle) {
				finalizePendingEditHistory('已更新参考图');
			}
			activeCurveHandle = null;
			activeImageHandle = null;
			imageStartTransform = null;
			activeHandle = null;
			document.body.classList.remove('cursor-pan-tool');
			drawCalibration();
			pointerStart = null;
			if (paper) {
				updateCanvasHoverCursor(toPlainPoint(paper.view.center));
			}
		};

		tool.onMouseMove = (event: PaperMouseEvent) => {
			if (activeTool === 'point') {
				const rawPoint = toPlainPoint(event.point);
				const closedSnap = getPointModeClosedSnapState(rawPoint);
				let snappedPoint: Point;
				if (closedSnap.eligible && closedSnap.withinSnapRange && closedSnap.targetPoint) {
					snappedPoint = closedSnap.targetPoint;
					updateSnapPreviewCircle(closedSnap.targetPoint, closedSnap.snapRadius);
					snapPreviewStatus = '吸附到起点，点击闭合路径';
				} else {
					snappedPoint = getSnappedBrushPoint(rawPoint);
					const gridSnap = getGridPointSnapState(rawPoint);
					if (
						gridSnap.eligible &&
						gridSnap.withinSnapRange &&
						gridSnap.targetPoint &&
						gridSnap.gridCoordinate
					) {
						updateSnapPreviewCircle(gridSnap.targetPoint, gridSnap.snapRadius);
						snapPreviewStatus = `格点吸附 (${gridSnap.gridCoordinate.x}, ${gridSnap.gridCoordinate.y})`;
					} else {
						clearClosedPathSnapPreview();
					}
				}
				updatePointModePreview(snappedPoint);
				return;
			}
			updateCanvasHoverCursor(toPlainPoint(event.point));
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
	<Header onFileChange={handleFileChange} />

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
			<div class="shrink-0 overflow-hidden" style:height={`${rightCurvesPanelHeight}px`}>
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
				onCopy={copyExport}
			/>
		</aside>
	</div>
</main>
