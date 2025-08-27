import { NextAuthOptions } from "next-auth";
import credentialsProvider from "next-auth/providers/credentials";

declare module "next-auth" {
  interface Session {
    sub: string;
  }
}

const nextAuthSecret = `${process.env.NEXTAUTH_SECRET}`;
if (!nextAuthSecret) {
  throw new Error("NEXTAUTH_SECRET is not set");
}

const authOptions: NextAuthOptions = {
  providers: [
    credentialsProvider({
      name: "credentials",
      credentials: {
        address: {
          label: "Address",
          type: "text",
          placeholder: "0x0",
        },
      },
      async authorize(credentials, req) {
        try {
          if (!credentials?.address) {
            throw new Error("Address is undefined");
          }
          return {
            id: credentials.address,
          };
        } catch (e) {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (!token.sub) {
        return session;
      }

      session.sub = token.sub;

      return session;
    },
  },
  secret: nextAuthSecret,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/",
  },
};

export default authOptions;
