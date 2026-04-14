import NextAuth, { customFetch } from 'next-auth';
import { cookies } from 'next/headers';
import { decode, type JWT } from 'next-auth/jwt';
import GitHub from 'next-auth/providers/github';
import type { OAuthConfig } from 'next-auth/providers';
import { config as appConfig } from '@/lib/config';
import {
  LARK_OAUTH_TOKEN_URL,
  fetchLarkUserInfo,
  refreshUserAccessToken,
  requestLarkOAuthToken,
  type LarkUserInfo,
} from '@/lib/lark/auth';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    larkAccessToken?: string;
    larkExpiresAt?: number;
    larkAuthError?: 'expired' | 'refresh_failed';
    githubUser?: ConnectedIdentity;
    larkUser?: ConnectedIdentity;
  }
}

interface ConnectedIdentity {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

// NextAuth 5 beta JWT 类型扩展
interface AppJWT extends JWT {
  accessToken?: string;
  picture?: string | null;
  githubUser?: ConnectedIdentity;
  larkUser?: ConnectedIdentity;
  larkAccessToken?: string;
  larkRefreshToken?: string;
  larkExpiresAt?: number;
  larkAuthError?: 'expired' | 'refresh_failed';
}

type GitHubProfile = {
  id: string | number;
  login?: string | null;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
};

type AvatarProfile = {
  avatar_url?: string | null;
};

function asGitHubProfile(profile: unknown): GitHubProfile {
  return profile as GitHubProfile;
}

function asAvatarProfile(profile: unknown): AvatarProfile {
  return profile as AvatarProfile;
}

const AUTH_SESSION_COOKIE_NAMES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
];

async function readExistingAuthToken(): Promise<AppJWT | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return null;
  }

  const cookieStore = await cookies();
  for (const name of AUTH_SESSION_COOKIE_NAMES) {
    const value =
      cookieStore.get(name)?.value ??
      cookieStore
        .getAll()
        .filter((cookie) => cookie.name.startsWith(`${name}.`))
        .sort((a, b) => {
          const aIndex = Number(a.name.slice(name.length + 1));
          const bIndex = Number(b.name.slice(name.length + 1));
          return aIndex - bIndex;
        })
        .map((cookie) => cookie.value)
        .join('');
    if (!value) {
      continue;
    }

    try {
      const decoded = await decode({ token: value, secret, salt: name });
      if (decoded) {
        return decoded as AppJWT;
      }
    } catch {
      // Try the next known Auth.js cookie name.
    }
  }

  return null;
}

function mergeExistingProviderState(token: AppJWT, existing: AppJWT | null) {
  if (!existing) {
    return;
  }

  token.accessToken ??= existing.accessToken;
  token.githubUser ??= existing.githubUser;
  token.larkAccessToken ??= existing.larkAccessToken;
  token.larkRefreshToken ??= existing.larkRefreshToken;
  token.larkExpiresAt ??= existing.larkExpiresAt;
  token.larkAuthError ??= existing.larkAuthError;
  token.larkUser ??= existing.larkUser;
}

function mapLarkIdentity(profile: LarkUserInfo | undefined): ConnectedIdentity {
  return {
    name:
      profile?.display_name ??
      profile?.name ??
      profile?.nickname ??
      profile?.en_name,
    email: profile?.email,
    image:
      profile?.avatar_url ??
      profile?.avatar_middle ??
      profile?.avatar_big ??
      profile?.avatar_thumb,
  };
}

const LARK_SCOPES = [
  'calendar:calendar:read',
  'calendar:calendar.event:read',
  'vc:meeting.search:read',
  'vc:note:read',
  'minutes:minutes:readonly',
  'minutes:minutes.transcript:export',
  'minutes:minutes.artifacts:read',
  'wiki:node:read',
  'docx:document:readonly',
].join(' ');

function LarkProvider(): OAuthConfig<Record<string, unknown>> {
  return {
    id: 'lark',
    name: 'Lark',
    type: 'oauth',
    checks: ['state'],
    authorization: {
      url: 'https://accounts.feishu.cn/open-apis/authen/v1/authorize',
      params: {
        scope: LARK_SCOPES,
      },
    },
    token: LARK_OAUTH_TOKEN_URL,
    async [customFetch](...args) {
      const request =
        args[0] instanceof Request ? args[0] : new Request(args[0], args[1]);
      const url = new URL(request.url);

      if (url.href === LARK_OAUTH_TOKEN_URL) {
        const form = new URLSearchParams(await request.clone().text());
        const tokens = await requestLarkOAuthToken({
          grant_type: form.get('grant_type') ?? 'authorization_code',
          code: form.get('code') ?? undefined,
          redirect_uri: form.get('redirect_uri') ?? undefined,
          refresh_token: form.get('refresh_token') ?? undefined,
        });

        return Response.json(tokens);
      }

      return fetch(...args);
    },
    userinfo: {
      url: 'https://open.feishu.cn/open-apis/authen/v1/user_info',
      async request({ tokens }: { tokens: Record<string, unknown> }) {
        return fetchLarkUserInfo(tokens.access_token as string);
      },
    },
    profile(profile) {
      const larkIdentity = mapLarkIdentity(profile as LarkUserInfo);

      return {
        id: profile.open_id as string,
        name: larkIdentity.name,
        email: larkIdentity.email,
        image: larkIdentity.image,
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
        const githubProfile = asGitHubProfile(profile);

        return {
          id: githubProfile.id.toString(),
          name: githubProfile.name || githubProfile.login,
          email: githubProfile.email,
          image: githubProfile.avatar_url,
        };
      },
    }),
    LarkProvider(),
  ],
  callbacks: {
    async jwt({ token, account, profile, user }) {
      const t = token as AppJWT;
      mergeExistingProviderState(
        t,
        account ? await readExistingAuthToken() : null
      );

      if (account?.provider === 'github') {
        t.accessToken = account.access_token ?? undefined;
        const githubProfile = asGitHubProfile(profile);
        t.githubUser = {
          name: githubProfile.name || githubProfile.login || user?.name,
          email: githubProfile.email ?? user?.email,
          image: githubProfile.avatar_url ?? user?.image,
        };
      }
      if (profile) {
        const avatarProfile = asAvatarProfile(profile);
        t.picture = avatarProfile.avatar_url ?? t.picture;
      }
      if (account?.provider === 'lark') {
        t.larkAccessToken = account.access_token ?? undefined;
        t.larkRefreshToken = account.refresh_token ?? undefined;
        t.larkAuthError = undefined;
        const larkProfileIdentity = mapLarkIdentity(profile as LarkUserInfo);
        t.larkUser = larkProfileIdentity;
        const expiresIn = (account.expires_in as number | undefined) ?? 7200;
        const expiresAt = account.expires_at
          ? Number(account.expires_at) * 1000
          : Date.now() + expiresIn * 1000;
        t.larkExpiresAt = expiresAt;
      }
      // 自动刷新飞书 token
      if (
        t.larkRefreshToken &&
        t.larkExpiresAt &&
        Date.now() > t.larkExpiresAt - 300_000
      ) {
        try {
          const refreshed = await refreshUserAccessToken(t.larkRefreshToken);
          const refreshedExpiresIn = refreshed.expires_in ?? 7200;
          t.larkAccessToken = refreshed.access_token;
          t.larkRefreshToken = refreshed.refresh_token ?? t.larkRefreshToken;
          t.larkExpiresAt = Date.now() + refreshedExpiresIn * 1000;
          t.larkAuthError = undefined;
        } catch {
          console.warn('飞书 token 刷新失败，用户需要重新授权');
          t.larkAccessToken = undefined;
          t.larkRefreshToken = undefined;
          t.larkExpiresAt = undefined;
          t.larkAuthError = 'refresh_failed';
        }
      }
      if (
        t.larkAccessToken &&
        t.larkExpiresAt &&
        Date.now() >= t.larkExpiresAt
      ) {
        t.larkAccessToken = undefined;
        t.larkAuthError = 'expired';
      }
      if (
        t.larkAccessToken &&
        (!t.larkUser?.name ||
          t.larkUser.name === '飞书' ||
          t.larkUser.name === 'Lark' ||
          (Boolean(t.githubUser?.name) &&
            t.larkUser.name === t.githubUser?.name))
      ) {
        try {
          t.larkUser = mapLarkIdentity(
            await fetchLarkUserInfo(t.larkAccessToken)
          );
        } catch {
          // Keep the token usable even if userinfo is temporarily unavailable.
        }
      }
      return token;
    },
    async session({ session, token }) {
      const t = token as AppJWT;
      session.accessToken = t.accessToken as string;
      const larkTokenIsExpired =
        Boolean(t.larkExpiresAt) && Date.now() >= Number(t.larkExpiresAt);
      session.larkAuthError =
        t.larkAuthError ?? (larkTokenIsExpired ? 'expired' : undefined);
      session.larkExpiresAt = t.larkExpiresAt;
      session.larkAccessToken =
        !session.larkAuthError && !larkTokenIsExpired
          ? (t.larkAccessToken as string)
          : undefined;
      session.githubUser = t.githubUser;
      session.larkUser = t.larkUser;
      if (session.user) {
        const primaryUser = t.githubUser ?? t.larkUser;
        session.user.name = primaryUser?.name ?? session.user.name;
        session.user.email = primaryUser?.email ?? session.user.email;
        session.user.image = primaryUser?.image ?? t.picture ?? session.user.image;
      }
      return session;
    },
  },
});
