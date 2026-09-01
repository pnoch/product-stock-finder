// Desktop build stub for expo-secure-store — desktop runs with
// Platform.OS === "web", where lib/_core/auth never touches SecureStore
// (cookie-based auth instead). This stub only satisfies the bundler.
export async function getItemAsync(_key: string): Promise<string | null> {
  return null;
}
export async function setItemAsync(_key: string, _value: string): Promise<void> {}
export async function deleteItemAsync(_key: string): Promise<void> {}