/** "4.7 s" for targets, "4.73 s" for taps. */
export const seconds = (ms: number, digits = 2) => `${(ms / 1000).toFixed(digits)} s`;
