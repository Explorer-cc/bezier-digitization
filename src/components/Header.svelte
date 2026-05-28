<script lang="ts">
	import { Copy, Image as ImageIcon } from '@lucide/svelte';

	let {
		onCopyExport,
		onFileChange
	}: {
		onCopyExport: () => void;
		onFileChange: (event: Event) => void;
	} = $props();

	let fileInput: HTMLInputElement;

	function handleLocalFileChange(event: Event) {
		onFileChange(event);
		fileInput.value = '';
	}
</script>

<header class="flex h-14 items-center justify-between border-b border-zinc-300 bg-white px-4 shrink-0">
	<div>
		<h1 class="text-base font-semibold">Bezier Curve Digitizer</h1>
		<p class="text-xs text-zinc-500">图片描线、坐标校准、多格式 Bezier 路径导出</p>
	</div>
	<div class="flex items-center gap-2">
		<input
			bind:this={fileInput}
			class="hidden"
			type="file"
			accept="image/*"
			onchange={handleLocalFileChange}
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
			onclick={onCopyExport}
			type="button"
		>
			<Copy size={16} />
			复制代码
		</button>
	</div>
</header>
