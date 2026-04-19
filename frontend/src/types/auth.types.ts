// ═══════════════════════════════════════════════════════
//  TypeScript Types — Auth
// ═══════════════════════════════════════════════════════

export interface User {
  _id: string;
  email: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ApiError {
  message: string;
  status?: string;
  errors?: string[];
}
