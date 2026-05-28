import { describe, expect, it } from 'vitest';
import {
	exportCurves,
	exportCurvesToCetz,
	exportCurvesToLuaDraw,
	exportCurvesToTikz,
	formatNumber
} from './exporter';
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
	it('normalizes negative zero after rounding', () => {
		expect(formatNumber(-0.4, 0)).toBe('0');
		expect(formatNumber(-0, 0)).toBe('0');
		expect(formatNumber(-0.004, 2)).toBe('0');
	});

	it('exports cubic Bezier controls', () => {
		expect(
			exportCurvesToTikz([curve], system, {
				precision: 2,
				format: 'tikz'
			})
		).toBe(
			'\\draw[line width=0.2pt, draw=black]\n(0,0)\n.. controls (0.25,0.5) and (0.75,0.5) .. (1,0);'
		);
	});

	it('exports LuaDraw Dbezier paths', () => {
		expect(
			exportCurvesToLuaDraw([curve], system, {
				precision: 2,
				format: 'luadraw'
			})
		).toBe('g:Dbezier({Z(0,0), Z(0.25,0.5), Z(0.75,0.5), Z(1,0)}, "line width=0.2pt, draw=black")');
	});

	it('exports CeTZ bezier paths', () => {
		expect(
			exportCurvesToCetz([curve], system, {
				precision: 2,
				format: 'cetz'
			})
		).toBe('bezier((0,0), (1,0), (0.25,0.5), (0.75,0.5), stroke: 0.2pt + black)');
	});

	it('dispatches by export format', () => {
		expect(
			exportCurves([curve], system, {
				precision: 2,
				format: 'luadraw'
			})
		).toContain('g:Dbezier');
	});
});
