// lib/lark-token.ts
import { auth } from '@/lib/auth';

export async function resolveLarkToken(): Promise<string | null> {
  const session = await auth();
  if (session?.larkAccessToken) {
    return session.larkAccessToken;
  }

  const token = process.env.LARK_USER_ACCESS_TOKEN ?? '';
  return token || null;
}
