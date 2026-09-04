export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  deviceId?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  deviceId?: string;
}

export interface AuthResponse {
  user: {
    id: number;
    email: string;
    name: string | null;
    openId: string;
  };
  sessionToken: string;
}
