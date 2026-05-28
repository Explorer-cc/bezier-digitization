import { canvasToCoordinate } from './coordinate';
import type { CoordinateSystem, CurvePath, ExportOptions, Point } from './types';

const colorName = (stroke: string) => {
	const colors: Record<string, string> = {
		'#111827': 'black',
		'#2563eb': 'blue',
		'#dc2626': 'red',
		'#16a34a': 'green',
		'#9333ea': 'violet'
	};

	return colors[stroke.toLowerCase()] ?? stroke;
};

export function formatNumber(value: number, precision: number) {
	const fixed = value.toFixed(precision);
	return fixed.replace(/\.?0+$/, '') || '0';
}

export function formatPoint(point: Point, precision: number) {
	return `(${formatNumber(point.x, precision)},${formatNumber(point.y, precision)})`;
}

export function exportCurveToTikz(
	curve: CurvePath,
	system: CoordinateSystem,
	options: ExportOptions
) {
	const precision = options.precision;
	const style = `line width=${formatNumber(curve.strokeWidth / 10, 2)}pt, draw=${colorName(curve.stroke)}`;
	const parts = curve.segments.map((segment, index) => {
		const start = canvasToCoordinate(segment.start, system);
		const control1 = canvasToCoordinate(segment.control1, system);
		const control2 = canvasToCoordinate(segment.control2, system);
		const end = canvasToCoordinate(segment.end, system);
		const prefix = index === 0 ? `\\draw[${style}] ${formatPoint(start, precision)}` : '';

		return `${prefix} .. controls ${formatPoint(control1, precision)} and ${formatPoint(control2, precision)} .. ${formatPoint(end, precision)}`;
	});

	return `${parts.join('\n')};`;
}

export function exportCurvesToTikz(
	curves: CurvePath[],
	system: CoordinateSystem,
	options: ExportOptions
) {
	const body = curves.map((curve) => exportCurveToTikz(curve, system, options)).join('\n');

	if (!options.includeWrapper) return body;

	return `\\begin{tikzpicture}\n${body}\n\\end{tikzpicture}`;
}
