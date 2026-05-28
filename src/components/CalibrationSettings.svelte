<script lang="ts">
	let {
		unitRealLength,
		showGrid,
		onUpdateUnitRealLength,
		onUpdateShowGrid
	}: {
		unitRealLength: number;
		showGrid: boolean;
		onUpdateUnitRealLength: (value: number) => void;
		onUpdateShowGrid: (value: boolean) => void;
	} = $props();
</script>

<section class="mt-6 space-y-3">
	<h2 class="text-sm font-semibold">坐标校准</h2>
	<label class="block text-xs text-zinc-600">
		真实单位长度
		<input
			class="mt-1 h-9 w-full rounded border border-zinc-300 px-2 text-sm"
			min="0.0001"
			onchange={(event) =>
				onUpdateUnitRealLength((event.currentTarget as HTMLInputElement).valueAsNumber)}
			step="0.1"
			type="number"
			value={unitRealLength}
		/>
	</label>
	<label class="flex items-center gap-2 text-sm">
		<input
			checked={showGrid}
			onchange={(event) => onUpdateShowGrid((event.currentTarget as HTMLInputElement).checked)}
			type="checkbox"
		/>
		显示坐标网格
	</label>
</section>
