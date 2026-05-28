import { describe, expect, it } from 'vitest';
import { canvasToCoordinate, coordinateToCanvas } from './coordinate';
import type { CoordinateSystem } from './types';

const system: CoordinateSystem = {
	originCanvas: { x: 100, y: 100 },
	xAxisPoint: { x: 200, y: 100 },
	unitCanvasLength: 100,
	unitRealLength: 1
};

describe('coordinate conversion', () => {
	it('converts canvas points into calibrated coordinates', () => {
		expect(canvasToCoordinate({ x: 200, y: 100 }, system)).toEqual({ x: 1, y: -0 });
		expect(canvasToCoordinate({ x: 100, y: 0 }, system)).toEqual({ x: 0, y: 1 });
	});

	it('round-trips calibrated coordinates', () => {
		const canvas = coordinateToCanvas({ x: 2, y: -1 }, system);
		expect(canvas.x).toBeCloseTo(300);
		expect(canvas.y).toBeCloseTo(200);
	});
});
