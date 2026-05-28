export type Point = {
	x: number;
	y: number;
};

export type CubicBezierSegment = {
	start: Point;
	control1: Point;
	control2: Point;
	end: Point;
};

export type CurvePath = {
	id: string;
	name: string;
	segments: CubicBezierSegment[];
	stroke: string;
	strokeWidth: number;
	closed: boolean;
};

export type CoordinateSystem = {
	originCanvas: Point;
	xAxisPoint: Point;
	yAxisPoint?: Point;
	unitCanvasLength: number;
	unitRealLength: number;
};

export type CanvasImage = {
	id: string;
	name: string;
	src: string;
	x: number;
	y: number;
	width: number;
	height: number;
	opacity: number;
	locked: boolean;
};

export type ToolMode = 'brush' | 'pan';

export type ExportFormat = 'tikz' | 'luadraw' | 'cetz';

export type ExportOptions = {
	precision: number;
	format: ExportFormat;
};
