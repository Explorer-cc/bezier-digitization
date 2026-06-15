<script lang="ts">
	import type { CanvasImage, CurvePath } from '$lib/core/types';
	import { Lock, Unlock } from '@lucide/svelte';
	import { _ } from 'svelte-i18n';
	let imageActionRow = $state<HTMLDivElement | null>(null);

	let {
		selectedImage,
		selectedCurves,
		selectedCurveObject,
		onStartImageOpacityEdit,
		onUpdateImageOpacity,
		onCommitImageOpacityEdit,
		onToggleImageLock,
		onFitImageToCanvas,
		onResetImageTransform,
		onRenameSelectedCurve,
		onUpdateSelectedCurveStyle
	}: {
		selectedImage: CanvasImage | null;
		selectedCurves: CurvePath[];
		selectedCurveObject: CurvePath | null;
		onStartImageOpacityEdit: () => void;
		onUpdateImageOpacity: (value: number) => void;
		onCommitImageOpacityEdit: () => void;
		onToggleImageLock: () => void;
		onFitImageToCanvas: () => void;
		onResetImageTransform: () => void;
	onRenameSelectedCurve: (name: string) => void;
	onUpdateSelectedCurveStyle: (
		changes: Partial<Pick<CurvePath, 'stroke' | 'strokeWidth'>>,
		nextStatus: { key: string }
	) => void;
	} = $props();

	let selectedCurveCount = $derived(selectedCurves.length);
	let selectedCurveCommonStroke = $derived.by(() => {
		if (!selectedCurves.length) return '#111827';
		const firstStroke = selectedCurves[0].stroke;
		return selectedCurves.every((curve) => curve.stroke === firstStroke)
			? firstStroke
			: selectedCurves[0].stroke;
	});
	let selectedCurveCommonStrokeWidth = $derived.by(() => {
		if (!selectedCurves.length) return 0.4;
		const firstWidth = selectedCurves[0].strokeWidth;
		return selectedCurves.every((curve) => curve.strokeWidth === firstWidth)
			? firstWidth
			: selectedCurves[0].strokeWidth;
	});
</script>

<section class="mt-6 space-y-3">
	<h2 class="text-sm font-semibold">{$_('objects.title')}</h2>
	{#if selectedImage}
		<div class="rounded border border-zinc-200 p-3 text-sm">
			<div class="truncate font-medium">{selectedImage.name}</div>
			<div class="mt-1 text-xs text-zinc-500">{$_('objects.referenceImage')}</div>
			<label class="mt-3 block text-xs text-zinc-600">
				{$_('objects.opacity', { values: { value: Math.round(selectedImage.opacity * 100) } })}
				<input
					class="mt-1 w-full"
					max="1"
					min="0.1"
					step="0.05"
					type="range"
					value={selectedImage.opacity}
					onpointerdown={onStartImageOpacityEdit}
					oninput={(event) =>
						onUpdateImageOpacity(Number((event.currentTarget as HTMLInputElement).value))}
					onchange={onCommitImageOpacityEdit}
				/>
			</label>
			<div bind:this={imageActionRow} class="mt-3 flex flex-nowrap gap-2">
				<button
					class="inline-flex h-8 shrink-0 items-center gap-2 rounded border border-zinc-300 px-2 text-xs"
					onclick={onToggleImageLock}
					type="button"
				>
					{#if selectedImage.locked}<Lock size={14} />{:else}<Unlock size={14} />{/if}
					{selectedImage.locked ? $_('objects.locked') : $_('objects.unlocked')}
				</button>
				<button
					class="inline-flex h-8 shrink-0 items-center rounded border border-zinc-300 px-2 text-xs"
					onclick={onFitImageToCanvas}
					type="button"
				>
					{$_('objects.fitToCanvas')}
				</button>
				<button
					class="inline-flex h-8 shrink-0 items-center rounded border border-zinc-300 px-2 text-xs"
					onclick={onResetImageTransform}
					type="button"
				>
					{$_('objects.resetTransform')}
				</button>
			</div>
		</div>
	{:else if selectedCurves.length}
		<div class="rounded border border-zinc-200 p-3 text-sm">
			<div class="truncate font-medium">
				{selectedCurveCount === 1
					? selectedCurveObject?.name
					: $_('objects.selectedPaths', { values: { count: selectedCurveCount } })}
			</div>
			<div class="mt-1 text-xs text-zinc-500">{$_('objects.pathObject')}</div>
			<div class="mt-3 text-xs leading-5 text-zinc-600">
				<div>
					{$_('objects.bezierSegmentCount', {
						values: {
							count: selectedCurves.reduce((total, curve) => total + curve.segments.length, 0)
						}
					})}
				</div>
				{#if selectedCurveCount === 1 && selectedCurveObject}
					<div>{selectedCurveObject.closed ? $_('objects.closedPath') : $_('objects.openPath')}</div>
				{:else}
					<div>{$_('objects.batchEditPathStyle')}</div>
				{/if}
			</div>
			{#if selectedCurveCount === 1 && selectedCurveObject}
				<label class="mt-3 block text-xs text-zinc-600">
					{$_('objects.name')}
					<input
						class="mt-1 h-9 w-full rounded border border-zinc-300 px-2 text-sm"
						type="text"
						value={selectedCurveObject.name}
						onchange={(event) =>
							onRenameSelectedCurve((event.currentTarget as HTMLInputElement).value)}
					/>
				</label>
			{/if}
			<label class="mt-3 block text-xs text-zinc-600">
				{selectedCurveCount > 1 ? $_('objects.colorBatch') : $_('objects.color')}
				<input
					class="mt-1 h-9 w-full"
					type="color"
					value={selectedCurveCommonStroke}
					onchange={(event) =>
						onUpdateSelectedCurveStyle(
							{ stroke: (event.currentTarget as HTMLInputElement).value },
							selectedCurveCount > 1
								? { key: 'status.pathColorBatchUpdated' }
								: { key: 'status.pathColorUpdated' }
						)}
				/>
			</label>
			<label class="mt-3 block text-xs text-zinc-600">
				{selectedCurveCount > 1
					? $_('objects.strokeWidthBatch', { values: { value: selectedCurveCommonStrokeWidth } })
					: $_('objects.strokeWidth', { values: { value: selectedCurveCommonStrokeWidth } })}
				<input
					class="mt-1 w-full"
					max="3"
					min="0.1"
					step="0.1"
					type="range"
					value={selectedCurveCommonStrokeWidth}
					onchange={(event) =>
						onUpdateSelectedCurveStyle(
							{ strokeWidth: Number((event.currentTarget as HTMLInputElement).value) },
							selectedCurveCount > 1
								? { key: 'status.pathStrokeWidthBatchUpdated' }
								: { key: 'status.pathStrokeWidthUpdated' }
						)}
				/>
			</label>
		</div>
	{:else}
		<p class="text-sm text-zinc-500">{$_('objects.noneSelected')}</p>
	{/if}
</section>
