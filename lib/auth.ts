import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
  }
}

type GitHubProfile = {
  id: string | number;
  login?: string | null;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
};

function asGitHubProfile(profile: unknown): GitHubProfile {
  return profile as GitHubProfile;
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
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      const githubToken = token as typeof token & {
        accessToken?: string;
        picture?: string | null;
      };

      if (account) {
        githubToken.accessToken = account.access_token;
      }
      if (profile) {
        const githubProfile = asGitHubProfile(profile);
        githubToken.picture = githubProfile.avatar_url ?? githubToken.picture;
      }
      return githubToken;
    },
    async session({ session, token }) {
      const githubToken = token as typeof token & {
        accessToken?: string;
        picture?: string | null;
      };

      session.accessToken = githubToken.accessToken;
      if (session.user) {
        session.user.image = githubToken.picture ?? session.user.image;
      }
      return session;
    },
  },
});
