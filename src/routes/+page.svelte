<script lang="ts">
	import { browser } from '$app/environment';
	import { canvasToCoordinate, defaultCoordinateSystem, getBasis } from '$lib/core/coordinate';
	import { exportCurvesToTikz } from '$lib/core/exporter';
	import type {
		CanvasImage,
		CoordinateSystem,
		CubicBezierSegment,
		CurvePath,
		Point,
		ToolMode
	} from '$lib/core/types';
	import {
		Copy,
		Download,
		Hand,
		PanelLeftClose,
		PanelLeftOpen,
		PanelRightClose,
		PanelRightOpen,
		Image as ImageIcon,
		Lock,
		Pencil,
		Trash2,
		Unlock
	} from '@lucide/svelte';
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

	let paper: PaperScope | null = null;
	let canvas: HTMLCanvasElement;
	let canvasHost: HTMLElement;
	let fileInput: HTMLInputElement;
	let tool: PaperTool | null = null;
	let project: PaperProject | null = null;
	let activePath: PaperPath | null = null;
	let referenceRaster: PaperRaster | null = null;
	let canvasResizeObserver: ResizeObserver | null = null;
	let canvasResizeFrame = 0;
	let pointerStart: Point | null = null;
	let activeHandle: 'origin' | 'unit' | null = null;

	let activeTool = $state<ToolMode>('brush');
	let image = $state<CanvasImage | null>(null);
	let curves = $state<CurvePath[]>([]);
	let selectedCurveId = $state('');
	let coordinateSystem = $state<CoordinateSystem>({
		...defaultCoordinateSystem,
		originCanvas: { x: 360, y: 300 },
		xAxisPoint: { x: 460, y: 300 }
	});
	let unitRealLength = $state(1);
	let precision = $state(3);
	let includeWrapper = $state(true);
	let stroke = $state('#111827');
	let strokeWidth = $state(2);
	let showGrid = $state(true);
	let leftPanelWidth = $state(280);
	let rightPanelWidth = $state(360);
	let leftPanelCollapsed = $state(false);
	let rightPanelCollapsed = $state(false);
	let resizingPanel = $state<'left' | 'right' | null>(null);
	let canvasReady = $state(false);
	let status = $state('选择图片或直接用画笔描曲线');

	const tools: Array<{ id: ToolMode; label: string; icon: typeof Pencil }> = [
		{ id: 'brush', label: '画笔', icon: Pencil },
		{ id: 'pan', label: '平移', icon: Hand }
	];

	let selectedCurve = $derived(
		curves.find((curve) => curve.id === selectedCurveId) ?? curves.at(-1) ?? null
	);
	let exportCode = $derived(
		exportCurvesToTikz(selectedCurve ? [selectedCurve] : curves, coordinateSystem, {
			precision,
			includeWrapper
		})
	);
	let originCoord = $derived(canvasToCoordinate(coordinateSystem.originCanvas, coordinateSystem));
	let workspaceGridColumns = $derived(
		`${leftPanelCollapsed ? 0 : leftPanelWidth}px 28px 6px minmax(0, 1fr) 6px 28px ${rightPanelCollapsed ? 0 : rightPanelWidth}px`
	);
	let canvasCursorClass = $derived(
		activeTool === 'pan'
			? activeHandle || pointerStart
				? 'cursor-grabbing'
				: 'cursor-grab'
			: 'cursor-crosshair'
	);

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

	function measureCanvasHost() {
		if (!canvasHost) return null;
		const rect = canvasHost.getBoundingClientRect();
		const width = Math.max(1, Math.floor(rect.width));
		const height = Math.max(1, Math.floor(rect.height));
		return { width, height };
	}

	function syncCanvasSize() {
		if (!canvas) return;
		const size = measureCanvasHost();
		if (!size) return;

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
			drawCalibration();
		}
	}

	function scheduleCanvasResize() {
		if (!browser) return;
		cancelAnimationFrame(canvasResizeFrame);
		canvasResizeFrame = requestAnimationFrame(syncCanvasSize);
	}

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

		for (let index = 0; index < path.segments.length - 1; index += 1) {
			const current = path.segments[index];
			const next = path.segments[index + 1];
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
		path.simplify(2);
		path.smooth({ type: 'continuous' });
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
			strokeWidth
		};
		curves = [...curves, curve];
		selectedCurveId = curve.id;
		path.remove();
		redrawCurves();
		status = `已生成 ${segments.length} 段 Bezier 曲线`;
	}

	function removeSelectedCurve() {
		if (!selectedCurveId) return;
		curves = curves.filter((curve) => curve.id !== selectedCurveId);
		selectedCurveId = curves.at(-1)?.id ?? '';
		redrawCurves();
	}

	function clearCurves() {
		curves = [];
		selectedCurveId = '';
		redrawCurves();
		status = '已清空曲线';
	}

	function drawCalibration() {
		if (!paper || !project) return;
		const layer =
			project.layers.find((item: PaperLayer) => item.name === 'calibration') ?? new paper.Layer();
		layer.name = 'calibration';
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
			strokeColor: '#2563eb',
			strokeWidth: 2 / paper.view.zoom,
			parent: layer
		});
		new paper.Path.Line({
			from: origin.subtract(yDirection.multiply(diagonal)),
			to: origin.add(yDirection.multiply(diagonal)),
			strokeColor: '#dc2626',
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
	}

	function redrawCurves() {
		if (!paper || !project) return;
		const layer =
			project.layers.find((item: PaperLayer) => item.name === 'curves') ?? new paper.Layer();
		layer.name = 'curves';
		layer.removeChildren();

		for (const curve of curves) {
			const path = new paper.Path({
				strokeColor: curve.id === selectedCurveId ? '#2563eb' : curve.stroke,
				strokeWidth: curve.id === selectedCurveId ? curve.strokeWidth + 1 : curve.strokeWidth,
				parent: layer
			});

			for (const [index, segment] of curve.segments.entries()) {
				if (index === 0) path.moveTo(new paper.Point(segment.start.x, segment.start.y));
				path.cubicCurveTo(
					new paper.Point(segment.control1.x, segment.control1.y),
					new paper.Point(segment.control2.x, segment.control2.y),
					new paper.Point(segment.end.x, segment.end.y)
				);
			}
		}

		drawCalibration();
	}

	async function loadImage(file: File) {
		if (!paper || !project) return;
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

		referenceRaster?.remove();
		referenceRaster = new paper.Raster(src);
		referenceRaster.onLoad = () => {
			if (!referenceRaster) return;
			referenceRaster.position = paper!.view.center;
			referenceRaster.opacity = image?.opacity ?? 0.65;
			referenceRaster.sendToBack();
			image = {
				...image!,
				x: referenceRaster.bounds.x,
				y: referenceRaster.bounds.y,
				width: referenceRaster.bounds.width,
				height: referenceRaster.bounds.height
			};
			project!.activeLayer.activate();
			redrawCurves();
			status = `已载入参考图：${file.name}`;
		};
	}

	function updateImageOpacity() {
		if (!referenceRaster || !image) return;
		referenceRaster.opacity = image.opacity;
	}

	function resetView() {
		if (!paper) return;
		syncCanvasSize();
		paper.view.zoom = 1;
		paper.view.center = new paper.Point(canvas.width / 2, canvas.height / 2);
	}

	function handleFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file) void loadImage(file);
		target.value = '';
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

	function selectCurve(id: string) {
		selectedCurveId = id;
		redrawCurves();
	}

	async function copyExport() {
		if (!browser || !exportCode) return;
		await navigator.clipboard.writeText(exportCode);
		status = 'TikZ 代码已复制';
	}

	function downloadExport() {
		if (!browser || !exportCode) return;
		const blob = new Blob([exportCode], { type: 'text/plain;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = 'curves.tikz';
		anchor.click();
		URL.revokeObjectURL(url);
	}

	onMount(async () => {
		loadPanelLayout();
		syncCanvasSize();
		const paperModule = (await import('paper')).default;
		paper = paperModule;
		paperModule.setup(canvas);
		syncCanvasSize();
		project = paperModule.project;
		tool = new paperModule.Tool();
		canvasResizeObserver = new ResizeObserver(scheduleCanvasResize);
		canvasResizeObserver.observe(canvasHost);

		tool.onMouseDown = (event: PaperMouseEvent) => {
			if (!paper) return;
			const point = toPlainPoint(event.point);
			const handle = activeTool === 'pan' ? hitCalibrationHandle(point) : null;

			if (handle) {
				activeHandle = handle;
				if (handle === 'origin') updateOriginHandle(point);
				else updateUnitHandle(point);
				return;
			}

			if (activeTool === 'brush') {
				activePath = new paper.Path({
					strokeColor: stroke,
					strokeWidth,
					strokeCap: 'round',
					strokeJoin: 'round'
				});
				activePath.add(event.point);
				return;
			}

			if (activeTool === 'pan') {
				pointerStart = point;
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
			if (activeTool === 'brush' && activePath) {
				activePath.add(event.point);
			}
			if (activeTool === 'pan' && pointerStart) {
				paper.view.center = paper.view.center.subtract(event.delta);
				drawCalibration();
			}
		};

		tool.onMouseUp = () => {
			if (activeTool === 'brush' && activePath) {
				addCurveFromPath(activePath);
				activePath = null;
			}
			activeHandle = null;
			drawCalibration();
			pointerStart = null;
		};

		canvasReady = true;
		drawCalibration();
	});

	onDestroy(() => {
		if (browser) {
			cancelAnimationFrame(canvasResizeFrame);
			window.removeEventListener('pointermove', handlePanelResize);
			window.removeEventListener('pointerup', stopPanelResize);
			window.removeEventListener('pointercancel', stopPanelResize);
		}
		canvasResizeObserver?.disconnect();
		tool?.remove();
		project?.remove();
	});
</script>

<svelte:head>
	<title>TikZ Curve Digitizer</title>
</svelte:head>

<main class="flex h-screen min-h-[720px] flex-col bg-zinc-100 text-zinc-950">
	<header class="flex h-14 items-center justify-between border-b border-zinc-300 bg-white px-4">
		<div>
			<h1 class="text-base font-semibold">TikZ Curve Digitizer</h1>
			<p class="text-xs text-zinc-500">图片描线、坐标校准、Bezier 到 TikZ</p>
		</div>
		<div class="flex items-center gap-2">
			<input
				bind:this={fileInput}
				class="hidden"
				type="file"
				accept="image/*"
				onchange={handleFileChange}
			/>
			<button
				class="inline-flex h-9 items-center gap-2 rounded border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50"
				onclick={() => fileInput.click()}
				type="button"
			>
				<ImageIcon size={16} />
				上传图片
			</button>
			<button
				class="inline-flex h-9 items-center gap-2 rounded bg-zinc-950 px-3 text-sm text-white hover:bg-zinc-800"
				onclick={copyExport}
				type="button"
			>
				<Copy size={16} />
				复制 TikZ
			</button>
		</div>
	</header>

	<div class="grid min-h-0 flex-1" style:grid-template-columns={workspaceGridColumns}>
		<aside
			class={`overflow-y-auto border-r border-zinc-300 bg-white p-4 ${
				leftPanelCollapsed ? 'pointer-events-none invisible' : ''
			}`}
		>
			<section>
				<h2 class="text-sm font-semibold">工具</h2>
				<div class="mt-3 grid grid-cols-2 gap-2">
					{#each tools as item (item.id)}
						{@const Icon = item.icon}
						<button
							class={`inline-flex h-10 items-center justify-center gap-2 rounded border text-sm ${
								activeTool === item.id
									? 'border-zinc-950 bg-zinc-950 text-white'
									: 'border-zinc-300 bg-white hover:bg-zinc-50'
							}`}
							onclick={() => setTool(item.id)}
							type="button"
						>
							<Icon size={16} />
							{item.label}
						</button>
					{/each}
				</div>
			</section>

			<section class="mt-6 space-y-3">
				<h2 class="text-sm font-semibold">画笔</h2>
				<label class="block text-xs text-zinc-600">
					颜色
					<input bind:value={stroke} class="mt-1 h-9 w-full" type="color" />
				</label>
				<label class="block text-xs text-zinc-600">
					线宽 {strokeWidth}px
					<input bind:value={strokeWidth} class="mt-1 w-full" max="12" min="1" type="range" />
				</label>
			</section>

			<section class="mt-6 space-y-3">
				<h2 class="text-sm font-semibold">坐标校准</h2>
				<label class="block text-xs text-zinc-600">
					真实单位长度
					<input
						bind:value={unitRealLength}
						class="mt-1 h-9 w-full rounded border border-zinc-300 px-2 text-sm"
						min="0.0001"
						step="0.1"
						type="number"
					/>
				</label>
				<label class="flex items-center gap-2 text-sm">
					<input bind:checked={showGrid} type="checkbox" onchange={drawCalibration} />
					显示坐标网格
				</label>
				<p class="text-xs leading-5 text-zinc-500">
					切换到“平移”工具后，可拖动黑色原点或蓝色单位点。单位点只支持水平拖动，坐标轴方向固定水平和垂直。
				</p>
				<div class="rounded border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 text-zinc-600">
					<div>
						原点 canvas: {Math.round(coordinateSystem.originCanvas.x)}, {Math.round(
							coordinateSystem.originCanvas.y
						)}
					</div>
					<div>原点坐标: {originCoord.x}, {originCoord.y}</div>
					<div>单位像素: {coordinateSystem.unitCanvasLength.toFixed(1)}</div>
					<div>
						单位点: {Math.round(coordinateSystem.xAxisPoint.x)}, {Math.round(
							coordinateSystem.xAxisPoint.y
						)}
					</div>
				</div>
			</section>

			<section class="mt-6 space-y-3">
				<h2 class="text-sm font-semibold">参考图</h2>
				{#if image}
					<div class="rounded border border-zinc-200 p-3 text-sm">
						<div class="truncate font-medium">{image.name}</div>
						<label class="mt-3 block text-xs text-zinc-600">
							透明度 {Math.round(image.opacity * 100)}%
							<input
								bind:value={image.opacity}
								class="mt-1 w-full"
								max="1"
								min="0.1"
								step="0.05"
								type="range"
								oninput={updateImageOpacity}
							/>
						</label>
						<button
							class="mt-3 inline-flex h-8 items-center gap-2 rounded border border-zinc-300 px-2 text-xs"
							onclick={() => (image = image ? { ...image, locked: !image.locked } : image)}
							type="button"
						>
							{#if image.locked}<Lock size={14} />{:else}<Unlock size={14} />{/if}
							{image.locked ? '已锁定' : '可移动'}
						</button>
					</div>
				{:else}
					<p class="text-sm text-zinc-500">尚未上传参考图。</p>
				{/if}
			</section>
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

		<section bind:this={canvasHost} class="relative min-w-0 bg-zinc-200">
			<div
				class="absolute top-3 left-3 z-10 rounded border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-600 shadow-sm"
			>
				{status}
			</div>
			<canvas
				bind:this={canvas}
				class={`h-full w-full bg-white ${canvasCursorClass}`}
				height="900"
				onwheel={handleWheel}
				width="1200"
			></canvas>
			{#if !canvasReady}
				<div class="absolute inset-0 grid place-items-center text-sm text-zinc-500">
					初始化画布...
				</div>
			{/if}
			<button
				class="absolute bottom-3 left-3 rounded border border-zinc-300 bg-white px-3 py-2 text-xs shadow-sm"
				onclick={resetView}
				type="button"
			>
				重置视图
			</button>
		</section>

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
			class={`flex min-h-0 flex-col border-l border-zinc-300 bg-white ${
				rightPanelCollapsed ? 'pointer-events-none invisible' : ''
			}`}
		>
			<section class="border-b border-zinc-200 p-4">
				<div class="flex items-center justify-between">
					<h2 class="text-sm font-semibold">曲线</h2>
					<div class="flex gap-2">
						<button
							class="rounded border border-zinc-300 p-2"
							onclick={removeSelectedCurve}
							type="button"
						>
							<Trash2 size={15} />
						</button>
						<button
							class="rounded border border-zinc-300 px-2 text-xs"
							onclick={clearCurves}
							type="button"
						>
							清空
						</button>
					</div>
				</div>
				<div class="mt-3 max-h-36 overflow-y-auto">
					{#if curves.length}
						{#each curves as curve (curve.id)}
							<button
								class={`mb-2 flex w-full items-center justify-between rounded border px-3 py-2 text-left text-sm ${
									selectedCurveId === curve.id ? 'border-blue-600 bg-blue-50' : 'border-zinc-200'
								}`}
								onclick={() => selectCurve(curve.id)}
								type="button"
							>
								<span>{curve.name}</span>
								<span class="text-xs text-zinc-500">{curve.segments.length} 段</span>
							</button>
						{/each}
					{:else}
						<p class="text-sm text-zinc-500">暂无曲线。</p>
					{/if}
				</div>
			</section>

			<section class="border-b border-zinc-200 p-4">
				<h2 class="text-sm font-semibold">导出设置</h2>
				<label class="mt-3 block text-xs text-zinc-600">
					小数位数
					<input
						bind:value={precision}
						class="mt-1 h-9 w-full rounded border border-zinc-300 px-2 text-sm"
						max="6"
						min="0"
						type="number"
					/>
				</label>
				<label class="mt-3 flex items-center gap-2 text-sm">
					<input bind:checked={includeWrapper} type="checkbox" />
					包含 tikzpicture
				</label>
			</section>

			<section class="flex min-h-0 flex-1 flex-col p-4">
				<div class="flex items-center justify-between">
					<h2 class="text-sm font-semibold">TikZ 输出</h2>
					<button
						class="inline-flex h-8 items-center gap-2 rounded border border-zinc-300 px-2 text-xs"
						onclick={downloadExport}
						type="button"
					>
						<Download size={14} />
						下载
					</button>
				</div>
				<textarea
					class="mt-3 min-h-0 flex-1 resize-none rounded border border-zinc-300 bg-zinc-950 p-3 font-mono text-xs leading-5 text-zinc-100"
					readonly
					value={exportCode}
				></textarea>
			</section>
		</aside>
	</div>
</main>
