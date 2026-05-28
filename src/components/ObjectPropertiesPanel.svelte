<script lang="ts">
	import type { CanvasImage, CurvePath } from '$lib/core/types';
	import { Lock, Unlock } from '@lucide/svelte';
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
			statusMessage: string
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
		if (!selectedCurves.length) return 2;
		const firstWidth = selectedCurves[0].strokeWidth;
		return selectedCurves.every((curve) => curve.strokeWidth === firstWidth)
			? firstWidth
			: selectedCurves[0].strokeWidth;
	});

</script>

<section class="mt-6 space-y-3">
	<h2 class="text-sm font-semibold">对象属性</h2>
	{#if selectedImage}
		<div class="rounded border border-zinc-200 p-3 text-sm">
			<div class="truncate font-medium">{selectedImage.name}</div>
			<div class="mt-1 text-xs text-zinc-500">参考图对象</div>
			<label class="mt-3 block text-xs text-zinc-600">
				透明度 {Math.round(selectedImage.opacity * 100)}%
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
					{selectedImage.locked ? '已锁定' : '未锁定'}
				</button>
				<button
					class="inline-flex h-8 shrink-0 items-center rounded border border-zinc-300 px-2 text-xs"
					onclick={onFitImageToCanvas}
					type="button"
				>
					适配画布
				</button>
				<button
					class="inline-flex h-8 shrink-0 items-center rounded border border-zinc-300 px-2 text-xs"
					onclick={onResetImageTransform}
					type="button"
				>
					重置变换
				</button>
			</div>
		</div>
	{:else if selectedCurves.length}
		<div class="rounded border border-zinc-200 p-3 text-sm">
			<div class="truncate font-medium">
				{selectedCurveCount === 1 ? selectedCurveObject?.name : `已选择 ${selectedCurveCount} 条路径`}
			</div>
			<div class="mt-1 text-xs text-zinc-500">路径对象</div>
			<div class="mt-3 text-xs leading-5 text-zinc-600">
				<div>Bezier 段数 {selectedCurves.reduce((total, curve) => total + curve.segments.length, 0)}</div>
				{#if selectedCurveCount === 1 && selectedCurveObject}
					<div>{selectedCurveObject.closed ? '闭合路径' : '开放路径'}</div>
				{:else}
					<div>批量编辑已选路径样式</div>
				{/if}
			</div>
			{#if selectedCurveCount === 1 && selectedCurveObject}
				<label class="mt-3 block text-xs text-zinc-600">
					名称
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
				颜色{selectedCurveCount > 1 ? '（批量）' : ''}
				<input
					class="mt-1 h-9 w-full"
					type="color"
					value={selectedCurveCommonStroke}
					onchange={(event) =>
						onUpdateSelectedCurveStyle(
							{ stroke: (event.currentTarget as HTMLInputElement).value },
							selectedCurveCount > 1 ? '已批量更新路径颜色' : '已更新路径颜色'
						)}
				/>
			</label>
			<label class="mt-3 block text-xs text-zinc-600">
				线宽 {selectedCurveCommonStrokeWidth}px{selectedCurveCount > 1 ? '（批量）' : ''}
				<input
					class="mt-1 w-full"
					max="20"
					min="1"
					step="1"
					type="range"
					value={selectedCurveCommonStrokeWidth}
					onchange={(event) =>
						onUpdateSelectedCurveStyle(
							{ strokeWidth: Number((event.currentTarget as HTMLInputElement).value) },
							selectedCurveCount > 1 ? '已批量更新路径线宽' : '已更新路径线宽'
						)}
				/>
			</label>
		</div>
	{:else}
		<p class="text-sm text-zinc-500">未选中对象</p>
	{/if}
</section>
