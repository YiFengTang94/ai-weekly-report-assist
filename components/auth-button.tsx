'use client';

import { useState } from 'react';
import Image from 'next/image';
import { signIn, signOut, useSession } from 'next-auth/react';

export function AuthButton() {
  const { data: session, status } = useSession();
  const [failedAvatarSrc, setFailedAvatarSrc] = useState<string | null>(null);
  const displayName = session?.user?.name ?? session?.user?.email ?? 'GitHub';
  const avatarLabel = displayName.slice(0, 1).toUpperCase();
  const avatarSrc = session?.user?.image;
  const showAvatarImage = Boolean(avatarSrc) && failedAvatarSrc !== avatarSrc;

  if (status === 'loading') {
    return <span className="auth-loading">同步身份...</span>;
  }

  if (session?.user) {
    return (
      <div className="auth-chip">
        {showAvatarImage && (
          <Image
            src={avatarSrc as string}
            alt={`${displayName} 的 GitHub 头像`}
            width={32}
            height={32}
            className="auth-avatar"
            unoptimized
            onError={() => setFailedAvatarSrc(avatarSrc ?? null)}
          />
        )}
        {!showAvatarImage && <span className="auth-avatar">{avatarLabel}</span>}
        <span className="auth-name">{displayName}</span>
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
    <button
      onClick={() => signIn('github')}
      className="auth-signin"
    >
      使用 GitHub 登录
    </button>
  );
}
