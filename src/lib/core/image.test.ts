import { describe, expect, it } from 'vitest';
import { getImageNudgeDelta } from './image';

describe('image keyboard nudging', () => {
	it('maps arrow keys to one screen pixel in project coordinates', () => {
		expect(getImageNudgeDelta('ArrowUp', 2)).toEqual({ x: 0, y: -0.5 });
		expect(getImageNudgeDelta('ArrowDown', 2)).toEqual({ x: 0, y: 0.5 });
		expect(getImageNudgeDelta('ArrowLeft', 2)).toEqual({ x: -0.5, y: 0 });
		expect(getImageNudgeDelta('ArrowRight', 2)).toEqual({ x: 0.5, y: 0 });
	});

	it('uses ten screen pixels for accelerated nudging', () => {
		expect(getImageNudgeDelta('ArrowRight', 2, true)).toEqual({ x: 5, y: 0 });
	});

	it('ignores unsupported keys and invalid zoom values', () => {
		expect(getImageNudgeDelta('Enter', 1)).toBeNull();
		expect(getImageNudgeDelta('ArrowUp', 0)).toBeNull();
	});
});
