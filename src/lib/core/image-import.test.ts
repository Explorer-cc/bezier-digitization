import { describe, expect, it } from 'vitest';
import { createClipboardImageFile, isImageFile } from './image-import';

describe('image import helpers', () => {
	it('accepts image files and rejects other file types', () => {
		expect(isImageFile(new File(['image'], 'reference.png', { type: 'image/png' }))).toBe(true);
		expect(isImageFile(new File(['text'], 'notes.txt', { type: 'text/plain' }))).toBe(false);
		expect(isImageFile(null)).toBe(false);
	});

	it('creates stable clipboard file names with normalized extensions', () => {
		expect(createClipboardImageFile(new Blob(['jpeg'], { type: 'image/jpeg' }), 123).name).toBe(
			'clipboard-123.jpg'
		);
		expect(createClipboardImageFile(new Blob(['svg'], { type: 'image/svg+xml' }), 456).name).toBe(
			'clipboard-456.svg'
		);
	});
});
