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

const samePoint = (a: Point, b: Point) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;

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
	const style = `line width=${formatNumber(curve.strokeWidth, 2)}pt, draw=${colorName(curve.stroke)}`;
	const firstSegment = curve.segments[0];
	if (!firstSegment) return '';

	const start = canvasToCoordinate(firstSegment.start, system);
	const parts = [`\\draw[${style}] ${formatPoint(start, precision)}`];

	for (const segment of curve.segments) {
		const control1 = canvasToCoordinate(segment.control1, system);
		const control2 = canvasToCoordinate(segment.control2, system);
		const end = canvasToCoordinate(segment.end, system);

		parts.push(
			`.. controls ${formatPoint(control1, precision)} and ${formatPoint(control2, precision)} .. ${formatPoint(end, precision)}`
		);
	}

	if (curve.closed) parts.push('-- cycle');

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

	const drawOptions = `line width=${formatNumber(curve.strokeWidth, 2)}pt, draw=${colorName(curve.stroke)}`;
	if (curve.closed) {
		const pathParts: string[] = [];
		for (const [index, segment] of curve.segments.entries()) {
			if (index === 0)
				pathParts.push(
					formatLuaDrawPoint(canvasToCoordinate(segment.start, system), options.precision)
				);
			pathParts.push(
				formatLuaDrawPoint(canvasToCoordinate(segment.control1, system), options.precision),
				formatLuaDrawPoint(canvasToCoordinate(segment.control2, system), options.precision),
				formatLuaDrawPoint(canvasToCoordinate(segment.end, system), options.precision),
				'"b"'
			);
		}
		pathParts.push('"cl"');
		return `g:Dpath({${pathParts.join(', ')}}, "${drawOptions}")`;
	}

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
	const style = `stroke: ${formatNumber(curve.strokeWidth, 2)}pt + ${colorName(curve.stroke)}`;
	const firstSegment = curve.segments[0];
	const lastSegment = curve.segments.at(-1);
	const closingLine =
		curve.closed && firstSegment && lastSegment && !samePoint(firstSegment.start, lastSegment.end)
			? `line(${formatCetzPoint(canvasToCoordinate(lastSegment.end, system), precision)}, ${formatCetzPoint(canvasToCoordinate(firstSegment.start, system), precision)}, ${style})`
			: null;

	return curve.segments
		.map((segment) => {
			const start = canvasToCoordinate(segment.start, system);
			const control1 = canvasToCoordinate(segment.control1, system);
			const control2 = canvasToCoordinate(segment.control2, system);
			const end = canvasToCoordinate(segment.end, system);

			return `bezier(${formatCetzPoint(start, precision)}, ${formatCetzPoint(end, precision)}, ${formatCetzPoint(control1, precision)}, ${formatCetzPoint(control2, precision)}, ${style})`;
		})
		.concat(closingLine ? [closingLine] : [])
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
