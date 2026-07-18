import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { and, eq, gt } from "drizzle-orm";

import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { sendResetPasswordEmail, sendVerificationEmail } from "@/lib/email";
import { isCloudMode } from "@/lib/env";

const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;

const getSSOProviders = () => {
  const providers: ReturnType<typeof betterAuth>["options"]["socialProviders"] = {};
  const enabledProviders = (process.env.AUTH_SSO_PROVIDERS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (
    enabledProviders.includes("google") &&
    process.env.AUTH_GOOGLE_ID &&
    process.env.AUTH_GOOGLE_SECRET
  ) {
    providers.google = {
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      prompt: "select_account",
    };
  }

  if (
    enabledProviders.includes("github") &&
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
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.authSessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),

  baseURL: appUrl,
  secret: process.env.AUTH_SECRET,
  trustedOrigins: appUrl ? [appUrl] : [],

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (!isCloudMode() || ctx.path !== "/sign-up/email") return;

      const email = typeof ctx.body?.email === "string" ? ctx.body.email.trim().toLowerCase() : "";
      const registrationToken = ctx.headers?.get("x-markai-email-verification")?.trim() || "";
      if (!email || !registrationToken) {
        throw new APIError("BAD_REQUEST", { message: "请先完成邮箱验证码验证" });
      }

      const db = getDb();
      const tokenId = `email-register:${registrationToken}`;
      const verified = await db
        .select({ id: schema.verifications.id })
        .from(schema.verifications)
        .where(
          and(
            eq(schema.verifications.identifier, tokenId),
            eq(schema.verifications.value, email),
            gt(schema.verifications.expiresAt, new Date()),
          ),
        )
        .limit(1);

      if (!verified.length) {
        throw new APIError("BAD_REQUEST", { message: "邮箱验证已失效，请重新验证" });
      }

      await db.delete(schema.verifications).where(eq(schema.verifications.identifier, tokenId));
    }),
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 64,
    requireEmailVerification: process.env.AUTH_EMAIL_VERIFICATION === "1",
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
      trustedProviders: ["google", "github"],
    },
  },

  user: {
    fields: {
      image: "avatar",
      name: "fullName",
    },
    additionalFields: {
      username: {
        type: "string",
        required: false,
      },
      age: {
        type: "number",
        required: false,
      },
      profileCompleted: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },

  plugins: [
    admin({
      defaultRole: "user",
      adminRole: "admin",
    }),
  ],
});

export type Auth = typeof auth;
