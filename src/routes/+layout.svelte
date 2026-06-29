<script lang="ts">
	import { initializeI18n, restoreStoredLocale } from '$lib/i18n';
	import { onMount } from 'svelte';
	import './layout.css';
	import favicon from '$lib/assets/beziericon.svg';

	initializeI18n();
	onMount(restoreStoredLocale);

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
