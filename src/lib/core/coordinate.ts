import type { CoordinateSystem, Point } from './types';

export const defaultCoordinateSystem: CoordinateSystem = {
	originCanvas: { x: 0, y: 0 },
	xAxisPoint: { x: 100, y: 0 },
	unitCanvasLength: 100,
	unitRealLength: 1
};

const subtract = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (point: Point, amount: number): Point => ({
	x: point.x * amount,
	y: point.y * amount
});
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function normalize(point: Point): Point {
	const length = Math.hypot(point.x, point.y);
	if (length === 0) return { x: 1, y: 0 };
	return { x: point.x / length, y: point.y / length };
}

export function getBasis(system: CoordinateSystem) {
	const xAxis = normalize(subtract(system.xAxisPoint, system.originCanvas));
	const yAxis = system.yAxisPoint
		? normalize(subtract(system.yAxisPoint, system.originCanvas))
		: { x: -xAxis.y, y: xAxis.x };

	return {
		xAxis,
		yAxis,
		scale: system.unitRealLength / system.unitCanvasLength
	};
}

export function canvasToCoordinate(point: Point, system: CoordinateSystem): Point {
	const { xAxis, yAxis, scale: unitScale } = getBasis(system);
	const delta = subtract(point, system.originCanvas);

	return {
		x: dot(delta, xAxis) * unitScale,
		y: dot(delta, yAxis) * unitScale * -1
	};
}

export function coordinateToCanvas(point: Point, system: CoordinateSystem): Point {
	const { xAxis, yAxis, scale: unitScale } = getBasis(system);
	const xCanvas = scale(xAxis, point.x / unitScale);
	const yCanvas = scale(yAxis, (point.y * -1) / unitScale);

	return add(system.originCanvas, add(xCanvas, yCanvas));
}

export function calibrateUnit(
	system: CoordinateSystem,
	start: Point,
	end: Point,
	realLength: number
) {
	return {
		...system,
		unitCanvasLength: Math.max(distance(start, end), 1),
		unitRealLength: realLength
	};
}
