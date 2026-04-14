'use client';

import { signIn, signOut, useSession } from 'next-auth/react';

type ConnectedIdentity = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

const ALLOWED_AVATAR_HOSTS = ['avatars.githubusercontent.com'];
const ALLOWED_AVATAR_HOST_SUFFIXES = ['.feishucdn.com'];

function isAllowedAvatarSrc(src: string | null | undefined): src is string {
  if (!src) {
    return false;
  }

  try {
    const hostname = new URL(src).hostname;
    return (
      ALLOWED_AVATAR_HOSTS.includes(hostname) ||
      ALLOWED_AVATAR_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
    );
  } catch {
    return src.startsWith('/');
  }
}

function getIdentityLabel(
  identity: ConnectedIdentity | undefined,
  fallback: string
) {
  return identity?.name ?? identity?.email ?? fallback;
}

function hasIdentityDetails(identity: ConnectedIdentity | undefined) {
  return Boolean(identity?.name || identity?.email || identity?.image);
}

function AuthAvatar({
  identity,
  label,
  fallbackInitial = 'ID',
}: {
  identity: ConnectedIdentity | undefined;
  label: string;
  fallbackInitial?: string;
}) {
  const avatarSrc = identity?.image;
  const showAvatarImage = isAllowedAvatarSrc(avatarSrc);
  const avatarLabel = hasIdentityDetails(identity)
    ? getIdentityLabel(identity, label).slice(0, 1).toUpperCase()
    : fallbackInitial;

  if (!showAvatarImage) {
    return <span className="auth-avatar">{avatarLabel}</span>;
  }

  return (
    <span
      aria-label={`${label} 头像`}
      className="auth-avatar auth-avatar-image"
      role="img"
      style={{ backgroundImage: `url(${JSON.stringify(avatarSrc)})` }}
    />
  );
}

function ProviderStatus({
  provider,
  identity,
  connected,
  onConnect,
  action,
  secondary,
}: {
  provider: string;
  identity: ConnectedIdentity | undefined;
  connected: boolean;
  onConnect: () => void;
  action: string;
  secondary?: boolean;
}) {
  if (!connected) {
    return (
      <button
        onClick={onConnect}
        className={secondary ? 'auth-signin auth-signin-secondary' : 'auth-signin'}
      >
        {action}
      </button>
    );
  }

  return (
    <div className={secondary ? 'auth-chip auth-chip-secondary' : 'auth-chip'}>
      <AuthAvatar identity={identity} label={provider} />
      <span className="auth-provider-label">{provider}</span>
      <span className="auth-name">{getIdentityLabel(identity, '已连接')}</span>
    </div>
  );
}

export function AuthButton() {
  const { data: session, status } = useSession();
  const hasGitHubToken = Boolean(session?.accessToken);
  const hasLarkToken = Boolean(session?.larkAccessToken);
  const githubIdentity =
    session?.githubUser ??
    (hasGitHubToken
      ? {
          name: session?.user?.name,
          email: session?.user?.email,
          image: session?.user?.image,
        }
      : undefined);
  const larkIdentity = session?.larkUser;

  if (status === 'loading') {
    return <span className="auth-loading">同步身份...</span>;
  }

  if (session?.user) {
    return (
      <div className="auth-status-list">
        <ProviderStatus
          action="连接 GitHub"
          connected={hasGitHubToken}
          identity={githubIdentity}
          onConnect={() => signIn('github')}
          provider="GitHub"
        />
        <ProviderStatus
          action="连接飞书"
          connected={hasLarkToken}
          identity={larkIdentity}
          onConnect={() => signIn('lark')}
          provider="飞书"
          secondary
        />
        <button
          onClick={() => signOut()}
          className="auth-action"
        >
          退出
        </button>
      </div>
    );
  }

  return (
    <div className="auth-actions">
      <ProviderStatus
        action="使用 GitHub 登录"
        connected={false}
        identity={undefined}
        onConnect={() => signIn('github')}
        provider="GitHub"
      />
      <ProviderStatus
        action="使用飞书登录"
        connected={false}
        identity={undefined}
        onConnect={() => signIn('lark')}
        provider="飞书"
        secondary
      />
    </div>
  );
}
