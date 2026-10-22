export function isUrlLike(value: string): boolean {
  return /^https?:\/\/\S+/i.test(value.trim());
}
