import { browser } from '$app/environment';
import { derived, get } from 'svelte/store';
import { _, addMessages, init, isLoading, locale } from 'svelte-i18n';
import en from '$lib/i18n/locales/en.json';
import zh from '$lib/i18n/locales/zh.json';

export const supportedLocales = ['zh', 'en'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

export const defaultLocale: SupportedLocale = 'zh';
export const localeStorageKey = 'tikz-curve-digitizer:locale';

addMessages('zh', zh);
addMessages('en', en);

export function normalizeLocale(value: string | null | undefined): SupportedLocale {
	if (!value) return defaultLocale;
	const normalized = value.toLowerCase();
	if (normalized.startsWith('en')) return 'en';
	if (normalized.startsWith('zh')) return 'zh';
	return defaultLocale;
}

export function initializeI18n() {
	init({
		fallbackLocale: defaultLocale,
		initialLocale: defaultLocale
	});

	if (browser) {
		document.documentElement.lang = 'zh-CN';
	}
}

export function restoreStoredLocale() {
	if (!browser) return;
	const storedLocale = localStorage.getItem(localeStorageKey);
	if (storedLocale) setAppLocale(normalizeLocale(storedLocale));
}

export function setAppLocale(nextLocale: SupportedLocale) {
	locale.set(nextLocale);
	if (browser) {
		localStorage.setItem(localeStorageKey, nextLocale);
		document.documentElement.lang = nextLocale === 'zh' ? 'zh-CN' : 'en';
	}
}

export const appLocale = derived(locale, ($locale) => normalizeLocale($locale));
export const i18nReady = derived(isLoading, ($isLoading) => !$isLoading);

export function translate(
	key: string,
	values?: Record<string, string | number | boolean | Date | null | undefined>
) {
	return get(_)(key, { values });
}
