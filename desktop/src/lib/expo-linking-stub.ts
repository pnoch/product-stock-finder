// Desktop build stub for expo-linking — constants/oauth uses it only for
// native deep-link handling, which desktop never exercises.
export async function getInitialURL(): Promise<string | null> {
  return window.location.href;
}
export async function openURL(url: string): Promise<void> {
  window.open(url, "_blank");
}
export const addEventListener = () => ({ remove: () => {} });
export const parse = (url: string) => ({ url, hostname: "", path: null });
export function createURL(path?: string, _options?: { scheme?: string }): string {
  const base = window.location.origin;
  return path ? `${base}/${path.replace(/^\//, "")}` : base;
}