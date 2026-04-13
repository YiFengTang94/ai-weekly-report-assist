import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
  }
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
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      return session;
    },
  },
});
