<script lang="ts">
	import { _ } from 'svelte-i18n';

	let {
		canvasReady,
		overlayStatus,
		canvasCursorClass,
		onResetView,
		onWheel,
		canvas = $bindable<HTMLCanvasElement>(),
		hostElement = $bindable<HTMLElement>()
	}: {
		canvasReady: boolean;
		overlayStatus: string;
		canvasCursorClass: string;
		onResetView: () => void;
		onWheel: (event: WheelEvent) => void;
		canvas?: HTMLCanvasElement;
		hostElement?: HTMLElement;
	} = $props();
</script>

<section bind:this={hostElement} class="relative min-h-0 min-w-0 overflow-hidden bg-zinc-200">
	<div
		class="absolute top-3 left-3 z-10 rounded border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-600 shadow-sm"
	>
		{overlayStatus}
	</div>
	<button
		class="absolute top-3 right-3 z-10 inline-flex h-8 items-center rounded border border-zinc-300 bg-white px-2 text-xs shadow-sm"
		onclick={onResetView}
		type="button"
	>
		{$_('workspace.resetView')}
	</button>
	<canvas
		bind:this={canvas}
		class={`h-full w-full bg-white ${canvasCursorClass}`}
		height="900"
		width="1200"
		onwheel={onWheel}
	></canvas>
	{#if !canvasReady}
		<div class="absolute inset-0 grid place-items-center text-sm text-zinc-500">
			{$_('workspace.initializing')}
		</div>
	{/if}
</section>
