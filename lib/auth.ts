import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { and, eq, gt } from "drizzle-orm";

import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { sendResetPasswordEmail, sendVerificationEmail } from "@/lib/email";
import { isCloudMode } from "@/lib/env";
import {
  canCreateUser,
  getValidWaitlistInvitation,
  hashWaitlistToken,
  isBootstrapAdminEmail,
  normalizeEmail,
} from "@/lib/registration";

const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
const emailVerificationSetting =
  process.env.EMAIL_VERIFICATION_ENABLED ?? process.env.AUTH_EMAIL_VERIFICATION;
const emailVerificationEnabled = ["1", "true", "yes", "on"].includes(
  (emailVerificationSetting || "").trim().toLowerCase(),
);

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

      const email = typeof ctx.body?.email === "string" ? normalizeEmail(ctx.body.email) : "";
      const registrationToken = ctx.headers?.get("x-markai-email-verification")?.trim() || "";
      const invitationToken = ctx.headers?.get("x-markai-waitlist-invitation")?.trim() || "";
      if (!email || !registrationToken) {
        throw new APIError("BAD_REQUEST", { message: "请先完成邮箱验证码验证" });
      }

      if (!(await canCreateUser({ email, invitationToken }))) {
        throw new APIError("FORBIDDEN", {
          code: "REGISTRATION_NOT_ALLOWED",
          message: "当前注册需要有效的管理员邀请",
        });
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
    after: createAuthMiddleware(async (ctx) => {
      if (!isCloudMode() || ctx.path !== "/sign-up/email") return;
      const email = typeof ctx.body?.email === "string" ? normalizeEmail(ctx.body.email) : "";
      if (!email) return;

      const [user] = await getDb()
        .select({ id: schema.users.id, role: schema.users.role })
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1);
      if (!user) return;

      if (isBootstrapAdminEmail(email) && user.role !== "admin") {
        await getDb()
          .update(schema.users)
          .set({ role: "admin", updatedAt: new Date() })
          .where(eq(schema.users.id, user.id));
      }

      const invitationToken = ctx.headers?.get("x-markai-waitlist-invitation")?.trim() || "";
      if (!invitationToken) return;
      const invitation = await getValidWaitlistInvitation({ email, token: invitationToken });
      if (!invitation) return;
      const now = new Date();
      await getDb()
        .update(schema.waitlistInvitations)
        .set({ usedAt: now })
        .where(eq(schema.waitlistInvitations.tokenHash, hashWaitlistToken(invitationToken)));
      await getDb()
        .update(schema.waitlistEntries)
        .set({ registeredUserId: user.id, status: "registered", updatedAt: now })
        .where(eq(schema.waitlistEntries.id, invitation.entry.id));
    }),
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user, context) => {
          const email = normalizeEmail(user.email || "");
          const registrationToken = context?.headers?.get("x-markai-email-verification")?.trim();
          const invitationToken = context?.headers?.get("x-markai-waitlist-invitation")?.trim();
          if (!email || !(await canCreateUser({ email, invitationToken }))) {
            throw new APIError("FORBIDDEN", {
              code: "REGISTRATION_NOT_ALLOWED",
              message: "当前未开放注册，请先申请加入等候名单",
            });
          }

          const invited = invitationToken
            ? await getValidWaitlistInvitation({ email, token: invitationToken })
            : undefined;
          const verifiedByRegistrationCode = isCloudMode() && Boolean(registrationToken);
          return {
            data: {
              ...user,
              email,
              emailVerified: invited || verifiedByRegistrationCode ? true : user.emailVerified,
              role: isBootstrapAdminEmail(email) ? "admin" : user.role,
            },
          };
        },
      },
    },
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 64,
    requireEmailVerification: emailVerificationEnabled,
    sendResetPassword: async ({ user, url }) => {
      await sendResetPasswordEmail(user.email, url);
    },
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }, request) => {
      if (
        !emailVerificationEnabled ||
        request?.headers.get("x-markai-waitlist-invitation")?.trim()
      ) {
        return;
      }
      await sendVerificationEmail(user.email, url);
    },
    sendOnSignUp: emailVerificationEnabled,
    autoSignInAfterVerification: true,
    expiresIn: 3600,
  },

  socialProviders: getSSOProviders(),

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 120,
    },
    expiresIn: 60 * 60 * 24 * 2,
    updateAge: 60 * 60 * 12,
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
