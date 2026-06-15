import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from './i18n/locales/en.json';
import zh from './i18n/locales/zh.json';
import {
	appLocale,
	defaultLocale,
	initializeI18n,
	localeStorageKey,
	normalizeLocale,
	restoreStoredLocale,
	setAppLocale
} from './i18n';

vi.mock('$app/environment', () => ({ browser: true }));

const storedValues = new Map<string, string>();
const documentElement = { lang: '' };

vi.stubGlobal('localStorage', {
	getItem: (key: string) => storedValues.get(key) ?? null,
	setItem: (key: string, value: string) => storedValues.set(key, value)
});
vi.stubGlobal('document', { documentElement });

function flattenKeys(value: Record<string, unknown>, prefix = ''): string[] {
	return Object.entries(value).flatMap(([key, child]) => {
		const fullKey = prefix ? `${prefix}.${key}` : key;
		return child && typeof child === 'object' && !Array.isArray(child)
			? flattenKeys(child as Record<string, unknown>, fullKey)
			: [fullKey];
	});
}

describe('i18n configuration', () => {
	beforeEach(() => {
		storedValues.clear();
		documentElement.lang = '';
		initializeI18n();
	});

	it('defaults to Chinese unless the user explicitly selected a supported locale', () => {
		expect(defaultLocale).toBe('zh');
		expect(get(appLocale)).toBe('zh');
		expect(documentElement.lang).toBe('zh-CN');
		expect(normalizeLocale(null)).toBe('zh');
		expect(normalizeLocale('')).toBe('zh');
		expect(normalizeLocale('fr-FR')).toBe('zh');
		expect(normalizeLocale('zh-CN')).toBe('zh');
		expect(normalizeLocale('en-US')).toBe('en');
	});

	it('persists and restores an explicit language selection', () => {
		setAppLocale('en');
		expect(storedValues.get(localeStorageKey)).toBe('en');
		expect(get(appLocale)).toBe('en');
		expect(documentElement.lang).toBe('en');

		initializeI18n();
		expect(get(appLocale)).toBe('zh');
		restoreStoredLocale();
		expect(get(appLocale)).toBe('en');
		expect(documentElement.lang).toBe('en');
	});

	it('keeps the Chinese and English catalogs in sync', () => {
		expect(flattenKeys(en).sort()).toEqual(flattenKeys(zh).sort());
	});

	it('provides the translated default curve name', () => {
		expect(zh.curves.defaultName).toBe('曲线 {count}');
		expect(en.curves.defaultName).toBe('Curve {count}');
	});
});
