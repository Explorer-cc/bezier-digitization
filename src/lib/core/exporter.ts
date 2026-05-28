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
	if (Number(fixed) === 0) return '0';
	return fixed.replace(/\.?0+$/, '') || '0';
}

export function formatPoint(point: Point, precision: number) {
	return `(${formatNumber(point.x, precision)},${formatNumber(point.y, precision)})`;
}

function formatLuaDrawPoint(point: Point, precision: number) {
	return `Z(${formatNumber(point.x, precision)},${formatNumber(point.y, precision)})`;
}

function formatCetzPoint(point: Point, precision: number) {
	return formatPoint(point, precision);
}

export function exportCurveToTikz(
	curve: CurvePath,
	system: CoordinateSystem,
	options: ExportOptions
) {
	const precision = options.precision;
	const style = `line width=${formatNumber(curve.strokeWidth / 10, 2)}pt, draw=${colorName(curve.stroke)}`;
	const firstSegment = curve.segments[0];
	if (!firstSegment) return '';

	const start = canvasToCoordinate(firstSegment.start, system);
	const parts = [`\\draw[${style}]`, formatPoint(start, precision)];

	for (const segment of curve.segments) {
		const control1 = canvasToCoordinate(segment.control1, system);
		const control2 = canvasToCoordinate(segment.control2, system);
		const end = canvasToCoordinate(segment.end, system);

		parts.push(
			`.. controls ${formatPoint(control1, precision)} and ${formatPoint(control2, precision)} .. ${formatPoint(end, precision)}`
		);
	}

	return `${parts.join('\n')};`;
}

export function exportCurvesToTikz(
	curves: CurvePath[],
	system: CoordinateSystem,
	options: ExportOptions
) {
	return curves.map((curve) => exportCurveToTikz(curve, system, options)).join('\n');
}

export function exportCurveToLuaDraw(
	curve: CurvePath,
	system: CoordinateSystem,
	options: ExportOptions
) {
	const points: Point[] = [];
	for (const [index, segment] of curve.segments.entries()) {
		if (index === 0) points.push(canvasToCoordinate(segment.start, system));
		points.push(
			canvasToCoordinate(segment.control1, system),
			canvasToCoordinate(segment.control2, system),
			canvasToCoordinate(segment.end, system)
		);
	}

	if (!points.length) return '';

	const drawOptions = `line width=${formatNumber(curve.strokeWidth / 10, 2)}pt, draw=${colorName(curve.stroke)}`;
	return `g:Dbezier({${points.map((point) => formatLuaDrawPoint(point, options.precision)).join(', ')}}, "${drawOptions}")`;
}

export function exportCurvesToLuaDraw(
	curves: CurvePath[],
	system: CoordinateSystem,
	options: ExportOptions
) {
	return curves
		.map((curve) => exportCurveToLuaDraw(curve, system, options))
		.filter(Boolean)
		.join('\n');
}

export function exportCurveToCetz(
	curve: CurvePath,
	system: CoordinateSystem,
	options: ExportOptions
) {
	const precision = options.precision;
	const style = `stroke: ${formatNumber(curve.strokeWidth / 10, 2)}pt + ${colorName(curve.stroke)}`;

	return curve.segments
		.map((segment) => {
			const start = canvasToCoordinate(segment.start, system);
			const control1 = canvasToCoordinate(segment.control1, system);
			const control2 = canvasToCoordinate(segment.control2, system);
			const end = canvasToCoordinate(segment.end, system);

			return `bezier(${formatCetzPoint(start, precision)}, ${formatCetzPoint(end, precision)}, ${formatCetzPoint(control1, precision)}, ${formatCetzPoint(control2, precision)}, ${style})`;
		})
		.join('\n');
}

export function exportCurvesToCetz(
	curves: CurvePath[],
	system: CoordinateSystem,
	options: ExportOptions
) {
	return curves
		.map((curve) => exportCurveToCetz(curve, system, options))
		.filter(Boolean)
		.join('\n');
}

export function exportCurves(
	curves: CurvePath[],
	system: CoordinateSystem,
	options: ExportOptions
) {
	if (options.format === 'luadraw') return exportCurvesToLuaDraw(curves, system, options);
	if (options.format === 'cetz') return exportCurvesToCetz(curves, system, options);
	return exportCurvesToTikz(curves, system, options);
}
