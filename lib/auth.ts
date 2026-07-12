import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';

import { getDb } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { sendResetPasswordEmail, sendVerificationEmail } from '@/lib/email';

const getSSOProviders = () => {
  const providers: ReturnType<typeof betterAuth>['options']['socialProviders'] = {};
  const enabledProviders = (process.env.AUTH_SSO_PROVIDERS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (
    enabledProviders.includes('google') &&
    process.env.AUTH_GOOGLE_ID &&
    process.env.AUTH_GOOGLE_SECRET
  ) {
    providers.google = {
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      prompt: 'select_account',
    };
  }

  if (
    enabledProviders.includes('github') &&
    process.env.AUTH_GITHUB_ID &&
    process.env.AUTH_GITHUB_SECRET
  ) {
    providers.github = {
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    };
  }

  return providers;
};

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.authSessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),

  baseURL: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL,
  secret: process.env.AUTH_SECRET,

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 64,
    requireEmailVerification: process.env.AUTH_EMAIL_VERIFICATION === '1',
    sendResetPassword: async ({ user, url }) => {
      await sendResetPasswordEmail(user.email, url);
    },
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url);
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 3600,
  },

  socialProviders: getSSOProviders(),

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 120,
    },
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google', 'github'],
    },
  },

  user: {
    fields: {
      image: 'avatar',
      name: 'fullName',
    },
    additionalFields: {
      username: {
        type: 'string',
        required: false,
      },
    },
  },

  plugins: [
    admin({
      defaultRole: 'user',
      adminRole: 'admin',
    }),
  ],
});

export type Auth = typeof auth;
