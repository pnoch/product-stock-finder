export const LOG_ERROR: (...args: unknown[]) => void =
  typeof __DEV__ !== "undefined" && __DEV__ ? console.error.bind(console) : () => {};
