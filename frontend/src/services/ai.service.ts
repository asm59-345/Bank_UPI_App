// ═══════════════════════════════════════════════════════
//  AI Service — Financial Advisor, Chat, Smart Routing
// ═══════════════════════════════════════════════════════

import api from '@/lib/api';

export interface AdviceResponse {
  current_spending: number;
  predicted_expenses: number;
  advice: string;
}

export interface ChatResponse {
  success: boolean;
  answer: string;
}

export interface GatewayOption {
  id: string;
  name: string;
  latency: number;
  success_rate: number;
  load: number;
  score?: number;
}

export interface SmartRouteResponse {
  success: boolean;
  best_gateway: GatewayOption;
}

export const aiService = {
  getAdvice: async (): Promise<AdviceResponse> => {
    const response = await api.get('/ai/advice');
    return response.data.data || response.data;
  },

  sendChat: async (message: string): Promise<ChatResponse> => {
    const response = await api.post('/ai/chat', { message });
    return response.data;
  },

  getGatewayRoute: async (amount: number): Promise<SmartRouteResponse> => {
    const response = await api.post('/ai/route-payment', { amount });
    return response.data;
  },
};
