export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}
export function isMoney(value: unknown): value is string {
  return isString(value) && /^-?\d+$/.test(value);
}
export function isNumericString(value: unknown): value is string {
  return isString(value) && /^-?\d+(?:\.\d+)?$/.test(value);
}
export function isTimestamp(value: unknown): value is string {
  return (
    isString(value) && value.endsWith('Z') && Number.isFinite(Date.parse(value))
  );
}
export function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}
export function isList<T>(
  value: unknown,
  item: (value: unknown) => value is T,
): value is { items: T[] } {
  return (
    isRecord(value) && Array.isArray(value.items) && value.items.every(item)
  );
}
