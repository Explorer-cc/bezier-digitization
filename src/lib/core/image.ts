import type { Point } from './types';

const imageNudgeDirections: Record<string, Point> = {
	arrowup: { x: 0, y: -1 },
	arrowdown: { x: 0, y: 1 },
	arrowleft: { x: -1, y: 0 },
	arrowright: { x: 1, y: 0 }
};

export function getImageNudgeDelta(key: string, zoom: number, accelerated = false): Point | null {
	const direction = imageNudgeDirections[key.toLowerCase()];
	if (!direction || zoom <= 0) return null;
	const projectStep = (accelerated ? 10 : 1) / zoom;
	return {
		x: direction.x * projectStep,
		y: direction.y * projectStep
	};
}
