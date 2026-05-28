import { describe, expect, it } from 'vitest';
import { exportCurvesToTikz } from './exporter';
import type { CoordinateSystem, CurvePath } from './types';

const system: CoordinateSystem = {
	originCanvas: { x: 0, y: 0 },
	xAxisPoint: { x: 100, y: 0 },
	unitCanvasLength: 100,
	unitRealLength: 1
};

const curve: CurvePath = {
	id: 'curve-1',
	name: 'Curve 1',
	stroke: '#111827',
	strokeWidth: 2,
	segments: [
		{
			start: { x: 0, y: 0 },
			control1: { x: 25, y: -50 },
			control2: { x: 75, y: -50 },
			end: { x: 100, y: 0 }
		}
	]
};

describe('TikZ exporter', () => {
	it('exports cubic Bezier controls', () => {
		expect(exportCurvesToTikz([curve], system, { precision: 2, includeWrapper: false })).toBe(
			'\\draw[line width=0.2pt, draw=black] (0,0) .. controls (0.25,0.5) and (0.75,0.5) .. (1,0);'
		);
	});
});
