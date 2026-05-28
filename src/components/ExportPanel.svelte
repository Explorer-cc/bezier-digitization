<script lang="ts">
	import { Copy, Download } from '@lucide/svelte';
	import type { ExportFormat } from '$lib/core/types';

	let {
		exportFormat,
		precision,
		exportCode,
		settingsHeight,
		resizing,
		onResizeStart,
		onUpdateFormat,
		onUpdatePrecision,
		onCopy,
		onDownload
	}: {
		exportFormat: ExportFormat;
		precision: number;
		exportCode: string;
		settingsHeight: number;
		resizing: boolean;
		onResizeStart: (event: PointerEvent) => void;
		onUpdateFormat: (format: ExportFormat) => void;
		onUpdatePrecision: (value: number) => void;
		onCopy: () => void;
		onDownload: () => void;
	} = $props();

	const exportFormats: Array<{ id: ExportFormat; label: string }> = [
		{ id: 'tikz', label: 'TikZ' },
		{ id: 'luadraw', label: 'LuaDraw' },
		{ id: 'cetz', label: 'CeTZ' }
	];
</script>

<div
	role="separator"
	aria-orientation="horizontal"
	aria-label="调整曲线区域高度"
	class={`h-2 shrink-0 cursor-row-resize border-y border-zinc-200 bg-zinc-100 transition-colors hover:bg-blue-200 ${
		resizing ? 'bg-blue-300' : ''
	}`}
	onpointerdown={onResizeStart}
></div>

<section
	class="min-h-0 overflow-hidden border-b border-zinc-200"
	style:height={`${settingsHeight}px`}
>
	<div class="h-full overflow-y-auto p-4">
		<h2 class="text-sm font-semibold">导出设置</h2>
		<div class="mt-3">
			<div class="text-xs text-zinc-600">导出格式</div>
			<div class="mt-1 grid grid-cols-3 gap-1">
				{#each exportFormats as format (format.id)}
					<button
						class={`h-8 rounded border text-xs ${
							exportFormat === format.id
								? 'border-blue-600 bg-blue-50 text-blue-800'
								: 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
						}`}
						onclick={() => onUpdateFormat(format.id)}
						type="button"
					>
						{format.label}
					</button>
				{/each}
			</div>
		</div>
		<label class="mt-3 block text-xs text-zinc-600">
			小数位数
			<input
				class="mt-1 h-9 w-full rounded border border-zinc-300 px-2 text-sm"
				max="6"
				min="0"
				type="number"
				value={precision}
				onchange={(event) =>
					onUpdatePrecision(Number((event.currentTarget as HTMLInputElement).value))}
			/>
		</label>
	</div>
</section>

<div
	role="separator"
	aria-orientation="horizontal"
	aria-label="调整代码输出区域高度"
	class={`h-2 shrink-0 cursor-row-resize border-y border-zinc-200 bg-zinc-100 transition-colors hover:bg-blue-200 ${
		resizing ? 'bg-blue-300' : ''
	}`}
	onpointerdown={onResizeStart}
></div>

<section class="flex min-h-0 flex-1 flex-col overflow-hidden">
	<div class="flex h-full min-h-0 flex-col p-4">
		<div class="flex items-center justify-between">
			<h2 class="text-sm font-semibold">代码输出</h2>
			<div class="flex items-center gap-2">
				<button
					class="inline-flex h-8 items-center gap-2 rounded bg-zinc-950 px-2 text-xs text-white hover:bg-zinc-800"
					onclick={onCopy}
					type="button"
				>
					<Copy size={14} />
					复制
				</button>
				<button
					class="inline-flex h-8 items-center gap-2 rounded border border-zinc-300 px-2 text-xs"
					onclick={onDownload}
					type="button"
				>
					<Download size={14} />
					下载
				</button>
			</div>
		</div>
		<textarea
			class="mt-3 min-h-0 flex-1 resize-none rounded border border-zinc-300 bg-zinc-950 p-3 font-mono text-xs leading-5 text-zinc-100"
			readonly
			value={exportCode}
		></textarea>
	</div>
</section>
