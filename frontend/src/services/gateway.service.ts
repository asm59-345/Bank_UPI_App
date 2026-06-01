// ═══════════════════════════════════════════════════════
//  Developer Gateway Service — API Key & Merchant Simulator
// ═══════════════════════════════════════════════════════

import axios from 'axios';
import api from '@/lib/api';

// Since some gateway requests are simulated as third-party server-to-server calls,
// we will provide a utility to call the /v1 endpoints with a custom secret key
// as would be done by an external developer.

export interface ApiKeyData {
  api_key: string;
  api_secret: string;
  usage_limit: number;
  plan: string;
}

export interface PaymentOrderRequest {
  amount: number;
  currency?: string;
  upi_id: string;
  description?: string;
}

export interface PaymentOrderResponse {
  payment_id: string;
  status: string;
  amount: number;
  webhook_supported: boolean;
  qr_code: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
const GATEWAY_BASE_URL = API_BASE_URL.replace('/api', '/v1');

export const gatewayService = {
  // Generate keypair — called by standard logged-in user in dashboard portal
  generateKeys: async (): Promise<ApiKeyData> => {
    const response = await api.post('/v1/keys/generate');
    return response.data.data || response.data;
  },

  // Simulates an external P2M client creating a payment order
  createPaymentOrder: async (
    data: PaymentOrderRequest,
    secretKey: string
  ): Promise<PaymentOrderResponse> => {
    const response = await axios.post(`${GATEWAY_BASE_URL}/payments/create`, data, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secretKey}`,
      },
    });
    return response.data;
  },

  // Simulates an external client verifying a payment order status
  verifyPaymentOrder: async (paymentId: string, secretKey: string) => {
    const response = await axios.get(`${GATEWAY_BASE_URL}/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${secretKey}`,
      },
    });
    return response.data;
  },

  // Triggers webhook simulator
  triggerWebhook: async (
    paymentId: string,
    status: 'completed' | 'failed',
    secretKey: string
  ) => {
    const response = await axios.post(
      `${GATEWAY_BASE_URL}/webhook/trigger`,
      { payment_id: paymentId, status },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secretKey}`,
        },
      }
    );
    return response.data;
  },
};
