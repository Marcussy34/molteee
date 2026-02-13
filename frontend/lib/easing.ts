/** Overshoot at the end — great for entrance dashes */
export const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/** Fast start, smooth stop — punches and lunges */
export const easeOutQuart = (t: number): number => {
  return 1 - Math.pow(1 - t, 4);
};

/** Smooth acceleration and deceleration */
export const easeInOutQuad = (t: number): number => {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
};

/** Springy bounce — landing squash, impact recoil */
export const easeOutElastic = (t: number): number => {
  if (t === 0 || t === 1) return t;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

/** Simple ease-out cubic */
export const easeOutCubic = (t: number): number => {
  return 1 - Math.pow(1 - t, 3);
};

/** Ease-in quad — slow start, fast end */
export const easeInQuad = (t: number): number => {
  return t * t;
};

/** Clamp value between 0 and 1 */
export const clamp01 = (t: number): number => {
  return Math.max(0, Math.min(1, t));
};

/** Linear interpolation */
export const lerp = (a: number, b: number, t: number): number => {
  return a + (b - a) * t;
};
