<script lang="ts">
	import { ClipboardPaste, ImagePlus, Upload, X } from '@lucide/svelte';
	import { createClipboardImageFile, isImageFile } from '$lib/core/image-import';
	import { tick } from 'svelte';
	import { _ } from 'svelte-i18n';

	let {
		open,
		onClose,
		onSelectFile
	}: {
		open: boolean;
		onClose: () => void;
		onSelectFile: (file: File) => void;
	} = $props();

	let fileInput = $state<HTMLInputElement>();
	let dropZone = $state<HTMLDivElement>();
	let dialogPanel = $state<HTMLDivElement>();
	let isDragging = $state(false);
	let errorKey = $state('');

	function resetState() {
		isDragging = false;
		errorKey = '';
	}

	function closeDialog() {
		resetState();
		onClose();
	}

	function submitFile(file: File | null | undefined) {
		if (!isImageFile(file)) {
			errorKey = 'imageUpload.invalidFile';
			return;
		}
		errorKey = '';
		onSelectFile(file);
		closeDialog();
	}

	function handleFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		submitFile(input.files?.[0]);
		input.value = '';
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
		submitFile(event.dataTransfer?.files[0]);
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
		isDragging = true;
	}

	function handleDragLeave(event: DragEvent) {
		const nextTarget = event.relatedTarget;
		if (!(nextTarget instanceof Node) || !dropZone?.contains(nextTarget)) isDragging = false;
	}

	function handlePaste(event: ClipboardEvent) {
		if (!open) return;
		const target = event.target;
		if (
			target instanceof HTMLInputElement ||
			target instanceof HTMLTextAreaElement ||
			(target instanceof HTMLElement && target.isContentEditable)
		) {
			return;
		}

		const imageItem = Array.from(event.clipboardData?.items ?? []).find((item) =>
			item.type.startsWith('image/')
		);
		const blob = imageItem?.getAsFile();
		if (!blob) {
			errorKey = 'imageUpload.clipboardEmpty';
			return;
		}

		event.preventDefault();
		submitFile(createClipboardImageFile(blob));
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!open) return;
		event.stopImmediatePropagation();
		if (event.key === 'Escape') {
			event.preventDefault();
			closeDialog();
			return;
		}
		if (event.key === 'Tab' && dialogPanel) {
			const focusable = Array.from(
				dialogPanel.querySelectorAll<HTMLElement>(
					'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), [tabindex]:not([tabindex="-1"])'
				)
			).filter((element) => !element.hasAttribute('hidden'));
			if (!focusable.length) return;
			const first = focusable[0];
			const last = focusable.at(-1)!;
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}
	}

	$effect(() => {
		if (!open) return;
		resetState();
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		void tick().then(() => dropZone?.focus());
		return () => {
			document.body.style.overflow = previousOverflow;
		};
	});
</script>

<svelte:window onpaste={handlePaste} onkeydown={handleKeydown} />

{#if open}
	<div
		class="fixed inset-0 z-50 grid place-items-center bg-zinc-950/45 p-4 backdrop-blur-[2px]"
		onclick={(event) => {
			if (event.currentTarget === event.target) closeDialog();
		}}
		role="presentation"
	>
		<div
			bind:this={dialogPanel}
			aria-labelledby="image-upload-title"
			aria-modal="true"
			class="w-full max-w-[520px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-950/20"
			role="dialog"
		>
			<header class="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
				<div>
					<h2 id="image-upload-title" class="text-base font-semibold text-zinc-950">
						{$_('imageUpload.title')}
					</h2>
					<p class="mt-1 text-xs text-zinc-500">{$_('imageUpload.description')}</p>
				</div>
				<button
					aria-label={$_('imageUpload.close')}
					class="grid h-8 w-8 shrink-0 place-items-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950"
					onclick={closeDialog}
					type="button"
				>
					<X size={17} />
				</button>
			</header>

			<div class="p-5">
				<input
					bind:this={fileInput}
					accept="image/*"
					class="hidden"
					onchange={handleFileChange}
					type="file"
				/>
				<div
					bind:this={dropZone}
					aria-label={$_('imageUpload.dropZoneLabel')}
					class={`group relative flex min-h-56 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed px-8 py-10 text-center outline-none transition-all focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
						isDragging
							? 'scale-[1.01] border-blue-500 bg-blue-50 shadow-inner'
							: 'border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-zinc-100/70'
					}`}
					onclick={() => fileInput?.click()}
					ondragenter={handleDragOver}
					ondragleave={handleDragLeave}
					ondragover={handleDragOver}
					ondrop={handleDrop}
					onkeydown={(event) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							fileInput?.click();
						}
					}}
					role="button"
					tabindex="0"
				>
					<div class="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-blue-300 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
					<div
						class={`grid h-14 w-14 place-items-center rounded-2xl border shadow-sm transition-colors ${
							isDragging
								? 'border-blue-200 bg-blue-600 text-white'
								: 'border-zinc-200 bg-white text-zinc-700'
						}`}
					>
						{#if isDragging}<Upload size={25} />{:else}<ImagePlus size={25} />{/if}
					</div>
					<p class="mt-4 text-sm font-medium text-zinc-900">
						{isDragging ? $_('imageUpload.releaseToUpload') : $_('imageUpload.dropHere')}
					</p>
					<p class="mt-1.5 text-xs leading-5 text-zinc-500">{$_('imageUpload.formats')}</p>
					<div class="my-4 flex w-full max-w-64 items-center gap-3 text-[11px] uppercase tracking-wider text-zinc-400">
						<span class="h-px flex-1 bg-zinc-200"></span>
						{$_('imageUpload.or')}
						<span class="h-px flex-1 bg-zinc-200"></span>
					</div>
					<span
						class="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800"
					>
						<Upload size={15} />
						{$_('imageUpload.chooseFile')}
					</span>
				</div>

				<div class="mt-4 flex items-center justify-center gap-2 text-xs text-zinc-500">
					<ClipboardPaste size={14} />
					<span>{$_('imageUpload.pasteHint')}</span>
					<kbd class="rounded border border-zinc-300 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-700 shadow-sm">Ctrl+V</kbd>
				</div>
				{#if errorKey}
					<p class="mt-3 text-center text-xs font-medium text-red-600" role="alert">
						{$_(errorKey)}
					</p>
				{/if}
			</div>
		</div>
	</div>
{/if}
