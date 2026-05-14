export interface SharedValue<T> {
  value: T;
}

export interface StyleProp<T> {
  readonly value: T | readonly T[] | null | undefined;
}

export interface ViewStyle {
  readonly width?: number | string;
  readonly height?: number | string;
  readonly flex?: number;
}

export const createSharedValue = <T>(value: T): SharedValue<T> => ({ value });

export const setSharedValue = <T>(shared: SharedValue<T>, value: T): T => {
  shared.value = value;
  return value;
};

export const withSpring = <T>(shared: SharedValue<T>, value: T): T => setSharedValue(shared, value);

export const withTiming = <T>(shared: SharedValue<T>, value: T): T => setSharedValue(shared, value);

export const withDecay = (
  shared: SharedValue<number>,
  velocity: number,
  deceleration = 0.95
): number => {
  const next = shared.value + velocity * Math.max(0.01, 1 - Math.min(0.999, deceleration));
  shared.value = next;
  return next;
};
