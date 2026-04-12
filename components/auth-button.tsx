'use client';

import Image from 'next/image';
import { signIn, signOut, useSession } from 'next-auth/react';

export function AuthButton() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <span className="text-sm text-gray-400">加载中...</span>;
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-3">
        {session.user.image && (
          <Image
            src={session.user.image}
            alt=""
            width={32}
            height={32}
            className="rounded-full"
          />
        )}
        <span className="text-sm">{session.user.name}</span>
        <button
          onClick={() => signOut()}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          退出
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn('github')}
      className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800"
    >
      使用 GitHub 登录
    </button>
  );
}
