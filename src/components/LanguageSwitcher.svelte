<script lang="ts">
	import {
		appLocale,
		setAppLocale,
		supportedLocales,
		type SupportedLocale
	} from '$lib/i18n';
	import { Languages } from '@lucide/svelte';
	import { _ } from 'svelte-i18n';
</script>

<div
	class="inline-flex h-9 items-center gap-1 rounded border border-zinc-300 bg-white px-1 shadow-sm"
	aria-label={$_('language.label')}
>
	<Languages size={15} class="ml-1 text-zinc-500" />
	{#each supportedLocales as item (item)}
		<button
			class={`h-7 rounded px-2 text-xs font-medium transition-colors ${
				$appLocale === item
					? 'bg-zinc-950 text-white'
					: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
			}`}
			type="button"
			aria-pressed={$appLocale === item}
			onclick={() => setAppLocale(item as SupportedLocale)}
		>
			{$_(`language.${item}`)}
		</button>
	{/each}
</div>
