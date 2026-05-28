<script lang="ts">
	import type { ToolMode } from '$lib/core/types';
	import { Hand, Pencil, Redo2, Undo2 } from '@lucide/svelte';

	let {
		activeTool,
		canUndo,
		canRedo,
		onSetTool,
		onUndo,
		onRedo
	}: {
		activeTool: ToolMode;
		canUndo: boolean;
		canRedo: boolean;
		onSetTool: (mode: ToolMode) => void;
		onUndo: () => void;
		onRedo: () => void;
	} = $props();

	const tools: Array<{ id: ToolMode; label: string; icon: typeof Pencil }> = [
		{ id: 'brush', label: '画笔', icon: Pencil },
		{ id: 'pan', label: '平移', icon: Hand }
	];
</script>

<section>
	<h2 class="text-sm font-semibold">工具</h2>
	<div class="mt-3 grid grid-cols-2 gap-2">
		{#each tools as item (item.id)}
			{@const Icon = item.icon}
			<button
				class={`inline-flex h-10 items-center justify-center gap-2 rounded border text-sm ${
					activeTool === item.id
						? 'border-blue-600 bg-blue-50 text-blue-700 shadow-inner'
						: 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950'
				}`}
				onclick={() => onSetTool(item.id)}
				type="button"
			>
				<Icon size={16} />
				{item.label}
			</button>
		{/each}
	</div>
	<div class="mt-3 grid grid-cols-2 gap-2">
		<button
			class="inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-zinc-300 bg-white text-sm text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-45"
			disabled={!canUndo}
			onclick={onUndo}
			type="button"
			title="Ctrl+Z"
		>
			<Undo2 size={16} />
			撤销
		</button>
		<button
			class="inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-zinc-300 bg-white text-sm text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-45"
			disabled={!canRedo}
			onclick={onRedo}
			type="button"
			title="Ctrl+Y"
		>
			<Redo2 size={16} />
			恢复
		</button>
	</div>
</section>
