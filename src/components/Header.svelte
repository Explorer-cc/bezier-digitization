<script lang="ts">
	import { Image as ImageIcon } from '@lucide/svelte';
	import { tick } from 'svelte';
	import { _ } from 'svelte-i18n';
	import ImageUploadDialog from './ImageUploadDialog.svelte';
	import LanguageSwitcher from './LanguageSwitcher.svelte';

	let {
		onSelectImageFile
	}: {
		onSelectImageFile: (file: File) => void;
	} = $props();

	let uploadButton: HTMLButtonElement;
	let uploadDialogOpen = $state(false);

	function closeUploadDialog() {
		uploadDialogOpen = false;
		void tick().then(() => uploadButton?.focus());
	}
</script>

<header class="flex h-14 items-center justify-between border-b border-zinc-300 bg-white px-4 shrink-0">
	<div>
		<h1 class="text-base font-semibold">{$_('app.title')}</h1>
		<p class="text-xs text-zinc-500">{$_('app.subtitle')}</p>
	</div>
	<div class="flex items-center gap-2">
		<LanguageSwitcher />
		<button
			bind:this={uploadButton}
			class="inline-flex h-9 items-center gap-2 rounded border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50"
			onclick={() => (uploadDialogOpen = true)}
			type="button"
		>
			<ImageIcon size={16} />
			{$_('header.uploadImage')}
		</button>
	</div>
</header>

<ImageUploadDialog
	open={uploadDialogOpen}
	onClose={closeUploadDialog}
	onSelectFile={onSelectImageFile}
/>
