<script lang="ts">
	let {
		stroke = $bindable(),
		strokeWidth = $bindable(),
		simplifyTolerance = $bindable(),
		smoothDrawnPath = $bindable(),
		snapToGridPoints = $bindable(),
		snapClosedPaths = $bindable(),
		closedPathSnapDistance = $bindable()
	}: {
		stroke: string;
		strokeWidth: number;
		simplifyTolerance: number;
		smoothDrawnPath: boolean;
		snapToGridPoints: boolean;
		snapClosedPaths: boolean;
		closedPathSnapDistance: number;
	} = $props();
</script>

<section class="mt-6 space-y-3">
	<h2 class="text-sm font-semibold">画笔</h2>
	<label class="block text-xs text-zinc-600">
		颜色
		<input bind:value={stroke} class="mt-1 h-9 w-full" type="color" />
	</label>
	<label class="block text-xs text-zinc-600">
		线宽 {strokeWidth}px
		<input bind:value={strokeWidth} class="mt-1 w-full" max="8" min="1" type="range" />
	</label>
	<label class="block text-xs text-zinc-600">
		简化容差 {simplifyTolerance}
		<input
			bind:value={simplifyTolerance}
			class="mt-1 w-full"
			max="5"
			min="0"
			step="0.5"
			type="range"
		/>
	</label>
	<label class="flex items-center gap-2 text-sm">
		<input bind:checked={smoothDrawnPath} type="checkbox" />
		平滑路径
	</label>
	<label class="flex items-center gap-2 text-sm">
		<input bind:checked={snapToGridPoints} type="checkbox" />
		开启格点吸附
	</label>
	<label class="flex items-center gap-2 text-sm">
		<input bind:checked={snapClosedPaths} type="checkbox" />
		开启闭合路径吸附
	</label>
	<label class="block text-xs text-zinc-600">
		吸附阈值 {closedPathSnapDistance}px
		<input
			bind:value={closedPathSnapDistance}
			class="mt-1 w-full"
			disabled={!snapClosedPaths && !snapToGridPoints}
			max="50"
			min="5"
			step="1"
			type="range"
		/>
	</label>
</section>
