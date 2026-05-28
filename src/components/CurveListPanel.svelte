<script lang="ts">
	import type { CurvePath } from '$lib/core/types';
	import { Trash2 } from '@lucide/svelte';

	let {
		curves,
		selectedCurveIds,
		onSelectAllCurves,
		onClearCurveSelection,
		onRemoveSelectedCurve,
		onClearCurves,
		onToggleCurveSelection
	}: {
		curves: CurvePath[];
		selectedCurveIds: string[];
		onSelectAllCurves: () => void;
		onClearCurveSelection: () => void;
		onRemoveSelectedCurve: () => void;
		onClearCurves: () => void;
		onToggleCurveSelection: (id: string) => void;
	} = $props();

	let selectedCurveIdSet = $derived(new Set(selectedCurveIds));
</script>

<section class="min-h-0 overflow-hidden border-b border-zinc-200">
	<div class="flex h-full min-h-0 flex-col p-4">
		<div class="flex items-center justify-between gap-3">
			<h2 class="text-sm font-semibold">曲线</h2>
			<div class="flex shrink-0 gap-2">
				<button
					class="rounded border border-zinc-300 px-2 text-xs disabled:cursor-not-allowed disabled:opacity-45"
					disabled={!curves.length || selectedCurveIds.length === curves.length}
					onclick={onSelectAllCurves}
					type="button"
				>
					全选
				</button>
				<button
					class="rounded border border-zinc-300 px-2 text-xs disabled:cursor-not-allowed disabled:opacity-45"
					disabled={!selectedCurveIds.length}
					onclick={onClearCurveSelection}
					type="button"
				>
					全不选
				</button>
				<button
					class="rounded border border-zinc-300 p-2 disabled:cursor-not-allowed disabled:opacity-45"
					disabled={!selectedCurveIds.length}
					onclick={onRemoveSelectedCurve}
					title="删除已选曲线"
					type="button"
				>
					<Trash2 size={15} />
				</button>
				<button
					class="rounded border border-zinc-300 px-2 text-xs"
					onclick={onClearCurves}
					type="button"
				>
					清空
				</button>
			</div>
		</div>
		<p class="mt-2 text-xs text-zinc-500">
			{selectedCurveIds.length ? `已选择 ${selectedCurveIds.length} 条曲线` : '未选择曲线'}
		</p>
		<div class="mt-3 min-h-0 flex-1 overflow-y-auto">
			{#if curves.length}
				{#each curves as curve (curve.id)}
					{@const selected = selectedCurveIdSet.has(curve.id)}
					<button
						aria-pressed={selected}
						class={`mb-2 flex w-full items-center justify-between rounded border px-3 py-2 text-left text-sm ${
							selected ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-zinc-200'
						}`}
						onclick={() => onToggleCurveSelection(curve.id)}
						type="button"
					>
						<span class="flex min-w-0 items-center gap-2">
							<span
								aria-hidden="true"
								class={`grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] ${
									selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-zinc-300'
								}`}
							>
								{selected ? '✓' : ''}
							</span>
							<span class="truncate">{curve.name}</span>
						</span>
						<span class="shrink-0 text-xs text-zinc-500">{curve.segments.length} 段</span>
					</button>
				{/each}
			{:else}
				<p class="text-sm text-zinc-500">暂无曲线</p>
			{/if}
		</div>
	</div>
</section>
