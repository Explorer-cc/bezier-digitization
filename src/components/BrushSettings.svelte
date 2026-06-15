<script lang="ts">
	import { _ } from 'svelte-i18n';

	let {
		stroke = $bindable(),
		strokeWidth = $bindable(),
		simplifyTolerance = $bindable(),
		smoothDrawnPath = $bindable(),
		snapToGridPoints = $bindable(),
		snapClosedPaths = $bindable(),
		snapOrthogonalControlPoints = $bindable(),
		snapCollinearControlPoints = $bindable(),
		snapAngleTolerance = $bindable(),
		closedPathSnapDistance = $bindable()
	}: {
		stroke: string;
		strokeWidth: number;
		simplifyTolerance: number;
		smoothDrawnPath: boolean;
		snapToGridPoints: boolean;
		snapClosedPaths: boolean;
		snapOrthogonalControlPoints: boolean;
		snapCollinearControlPoints: boolean;
		snapAngleTolerance: number;
		closedPathSnapDistance: number;
	} = $props();
</script>

<section class="mt-6 space-y-3">
	<h2 class="text-sm font-semibold">{$_('brush.title')}</h2>
	<label class="block text-xs text-zinc-600">
		{$_('brush.color')}
		<input bind:value={stroke} class="mt-1 h-9 w-full" type="color" />
	</label>
	<label class="block text-xs text-zinc-600">
		{$_('brush.strokeWidth', { values: { value: strokeWidth } })}
		<input
			bind:value={strokeWidth}
			class="mt-1 w-full"
			max="3"
			min="0.1"
			step="0.1"
			type="range"
		/>
	</label>
	<label class="block text-xs text-zinc-600">
		{$_('brush.simplifyTolerance', { values: { value: simplifyTolerance } })}
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
		{$_('brush.smoothDrawnPath')}
	</label>
	<label class="flex items-center gap-2 text-sm">
		<input bind:checked={snapToGridPoints} type="checkbox" />
		{$_('brush.snapToGridPoints')}
	</label>
	<label class="flex items-center gap-2 text-sm">
		<input bind:checked={snapClosedPaths} type="checkbox" />
		{$_('brush.snapClosedPaths')}
	</label>
	<label class="flex items-center gap-2 text-sm">
		<input bind:checked={snapOrthogonalControlPoints} type="checkbox" />
		{$_('brush.snapOrthogonalControlPoints')}
	</label>
	<label class="flex items-center gap-2 text-sm">
		<input bind:checked={snapCollinearControlPoints} type="checkbox" />
		{$_('brush.snapCollinearControlPoints')}
	</label>
	<label class="block text-xs text-zinc-600">
		{$_('brush.closedPathSnapDistance', { values: { value: closedPathSnapDistance } })}
		<input
			bind:value={closedPathSnapDistance}
			class="mt-1 w-full"
			disabled={!snapClosedPaths && !snapToGridPoints}
			max="38"
			min="4"
			step="0.5"
			type="range"
		/>
	</label>
	<label class="block text-xs text-zinc-600">
		{$_('brush.snapAngleTolerance', { values: { value: snapAngleTolerance } })}
		<input
			bind:value={snapAngleTolerance}
			class="mt-1 w-full"
			disabled={!snapOrthogonalControlPoints && !snapCollinearControlPoints}
			max="30"
			min="5"
			step="1"
			type="range"
		/>
	</label>
</section>
