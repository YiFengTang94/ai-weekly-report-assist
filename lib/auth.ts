import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import type { OAuthConfig } from 'next-auth/providers';
import { config as appConfig } from '@/lib/config';
import { getAppAccessToken, refreshUserAccessToken } from '@/lib/lark/auth';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    larkAccessToken?: string;
  }
}

// NextAuth 5 beta JWT 类型扩展
interface LarkJWT {
  accessToken?: string;
  larkAccessToken?: string;
  larkRefreshToken?: string;
  larkExpiresAt?: number;
}

const LARK_SCOPES = [
  'calendar:calendar:read',
  'calendar:calendar.event:read',
  'vc:meeting.search:read',
  'vc:note:read',
  'minutes:minutes:readonly',
  'minutes:minutes.artifacts:read',
  'wiki:node:read',
  'docx:document:readonly',
].join(' ');

function LarkProvider(): OAuthConfig<Record<string, unknown>> {
  return {
    id: 'lark',
    name: 'Lark',
    type: 'oauth',
    authorization: {
      url: 'https://open.feishu.cn/open-apis/authen/v1/authorize',
      params: {
        app_id: appConfig.lark.appId,
        scope: LARK_SCOPES,
      },
    },
    token: {
      url: 'https://open.feishu.cn/open-apis/authen/v1/oidc/access_token',
      async request({ params }: { params: Record<string, unknown> }) {
        const appToken = await getAppAccessToken();
        const res = await fetch(
          'https://open.feishu.cn/open-apis/authen/v1/oidc/access_token',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${appToken}`,
            },
            body: JSON.stringify({
              grant_type: 'authorization_code',
              code: params.code,
            }),
          }
        );
        const json = await res.json();
        if (json.code !== 0) {
          throw new Error(`飞书 token 交换失败: ${json.msg}`);
        }
        return {
          tokens: {
            access_token: json.data.access_token,
            refresh_token: json.data.refresh_token,
            expires_in: json.data.expires_in,
            token_type: 'Bearer',
          },
        };
      },
    },
    userinfo: {
      url: 'https://open.feishu.cn/open-apis/authen/v1/user_info',
      async request({ tokens }: { tokens: Record<string, unknown> }) {
        const res = await fetch(
          'https://open.feishu.cn/open-apis/authen/v1/user_info',
          {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          }
        );
        const json = await res.json();
        return json.data;
      },
    },
    profile(profile) {
      return {
        id: profile.open_id as string,
        name: profile.name as string,
        email: profile.email as string,
        image: profile.avatar_url as string,
      };
    },
    clientId: appConfig.lark.appId,
    clientSecret: appConfig.lark.appSecret,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      authorization: { params: { scope: 'repo read:user' } },
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: profile.name || profile.login,
          email: profile.email,
          image: profile.avatar_url,
        };
      },
    }),
    LarkProvider(),
  ],
  callbacks: {
    async jwt({ token, account }) {
      const t = token as unknown as LarkJWT;
      if (account?.provider === 'github') {
        t.accessToken = account.access_token ?? undefined;
      }
      if (account?.provider === 'lark') {
        t.larkAccessToken = account.access_token ?? undefined;
        t.larkRefreshToken = account.refresh_token ?? undefined;
        const expiresIn = (account.expires_in as number | undefined) ?? 7200;
        t.larkExpiresAt = Date.now() + expiresIn * 1000;
      }
      // 自动刷新飞书 token
      if (
        t.larkRefreshToken &&
        t.larkExpiresAt &&
        Date.now() > t.larkExpiresAt - 300_000
      ) {
        try {
          const refreshed = await refreshUserAccessToken(t.larkRefreshToken);
          t.larkAccessToken = refreshed.access_token;
          t.larkRefreshToken = refreshed.refresh_token;
          t.larkExpiresAt = Date.now() + refreshed.expires_in * 1000;
        } catch {
          console.warn('飞书 token 刷新失败，用户需要重新授权');
          t.larkAccessToken = undefined;
          t.larkRefreshToken = undefined;
          t.larkExpiresAt = undefined;
        }
      }
      return token;
    },
    async session({ session, token }) {
      const t = token as unknown as LarkJWT;
      session.accessToken = t.accessToken as string;
      session.larkAccessToken = t.larkAccessToken as string;
      return session;
    },
  },
});
