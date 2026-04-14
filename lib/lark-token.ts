// lib/lark-token.ts
import { auth } from '@/lib/auth';

export interface LarkTokenState {
  token: string | null;
  reconnectRequired: boolean;
  reason?: 'expired' | 'refresh_failed' | 'not_connected';
}

export async function resolveLarkToken(): Promise<string | null> {
  const state = await resolveLarkTokenState();
  return state.token;
}

export async function resolveLarkTokenState(): Promise<LarkTokenState> {
  const session = await auth();
  if (session?.larkAuthError) {
    return {
      token: null,
      reconnectRequired: true,
      reason: session.larkAuthError,
    };
  }

  if (session?.larkAccessToken) {
    return {
      token: session.larkAccessToken,
      reconnectRequired: false,
    };
  }

  const token = process.env.LARK_USER_ACCESS_TOKEN ?? '';
  if (token) {
    return {
      token,
      reconnectRequired: false,
    };
  }

  return {
    token: null,
    reconnectRequired: false,
    reason: 'not_connected',
  };
}
