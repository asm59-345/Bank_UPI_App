// ═══════════════════════════════════════════════════════
//  Auth Service — Login, Register, Logout
// ═══════════════════════════════════════════════════════

import api from '@/lib/api';
import type { LoginRequest, RegisterRequest, AuthResponse } from '@/types/auth.types';

export const authService = {
  /**
   * POST /api/auth/login
   */
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  /**
   * POST /api/auth/register
   */
  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  /**
   * POST /api/auth/logout
   */
  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },
};
