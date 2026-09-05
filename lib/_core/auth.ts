import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { SESSION_TOKEN_KEY, USER_INFO_KEY } from "@/constants/oauth";

const LOG = __DEV__ ? console.log.bind(console) : () => {};
const LOG_ERROR = __DEV__ ? console.error.bind(console) : () => {};

export type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: Date;
  emailVerified?: boolean | null;
};

export async function getSessionToken(): Promise<string | null> {
  try {
    // Web platform uses cookie-based auth, no manual token management needed
    if (Platform.OS === "web") {
      LOG(
        "[Auth] Web platform uses cookie-based auth, skipping token retrieval",
      );
      return null;
    }

    // Use SecureStore for native
    LOG("[Auth] Getting session token...");
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    LOG(
      "[Auth] Session token retrieved from SecureStore:",
      token ? "present" : "missing",
    );
    return token;
  } catch (error) {
    LOG_ERROR("[Auth] Failed to get session token:", error);
    return null;
  }
}

export async function setSessionToken(token: string): Promise<void> {
  try {
    // Web platform uses cookie-based auth, no manual token management needed
    if (Platform.OS === "web") {
      LOG(
        "[Auth] Web platform uses cookie-based auth, skipping token storage",
      );
      return;
    }

    // Use SecureStore for native
    LOG("[Auth] Setting session token...");
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
    LOG("[Auth] Session token stored in SecureStore successfully");
  } catch (error) {
    LOG_ERROR("[Auth] Failed to set session token:", error);
    throw error;
  }
}

export async function removeSessionToken(): Promise<void> {
  try {
    // Web platform uses cookie-based auth, logout is handled by server clearing cookie
    if (Platform.OS === "web") {
      LOG(
        "[Auth] Web platform uses cookie-based auth, skipping token removal",
      );
      return;
    }

    // Use SecureStore for native
    LOG("[Auth] Removing session token...");
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
    LOG("[Auth] Session token removed from SecureStore successfully");
  } catch (error) {
    LOG_ERROR("[Auth] Failed to remove session token:", error);
  }
}

export async function getUserInfo(): Promise<User | null> {
  try {
    LOG("[Auth] Getting user info...");

    let info: string | null = null;
    if (Platform.OS === "web") {
      // Use localStorage for web
      info = window.localStorage.getItem(USER_INFO_KEY);
    } else {
      // Use SecureStore for native
      info = await SecureStore.getItemAsync(USER_INFO_KEY);
    }

    if (!info) {
      LOG("[Auth] No user info found");
      return null;
    }
    const user = JSON.parse(info);
    LOG("[Auth] User info retrieved:", user.id);
    return user;
  } catch (error) {
    LOG_ERROR("[Auth] Failed to get user info:", error);
    return null;
  }
}

export async function setUserInfo(user: User): Promise<void> {
  try {
    LOG("[Auth] Setting user info...", user.id);

    if (Platform.OS === "web") {
      // Use localStorage for web
      window.localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
      LOG("[Auth] User info stored in localStorage successfully");
      return;
    }

    // Use SecureStore for native
    await SecureStore.setItemAsync(USER_INFO_KEY, JSON.stringify(user));
    LOG("[Auth] User info stored in SecureStore successfully");
  } catch (error) {
    LOG_ERROR("[Auth] Failed to set user info:", error);
  }
}

export async function clearUserInfo(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      // Use localStorage for web
      window.localStorage.removeItem(USER_INFO_KEY);
      return;
    }

    // Use SecureStore for native
    await SecureStore.deleteItemAsync(USER_INFO_KEY);
  } catch (error) {
    LOG_ERROR("[Auth] Failed to clear user info:", error);
  }
}
