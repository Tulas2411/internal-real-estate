import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { db } from "./db";

export const auth = betterAuth({
  appName: "Nhà Nội Bộ",
  baseURL: process.env.APP_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12, maxPasswordLength: 128 },
  session: { expiresIn: 60 * 60 * 12, cookieCache: { enabled: false } },
  advanced: { useSecureCookies: process.env.NODE_ENV === "production", defaultCookieAttributes: { httpOnly: true, sameSite: "lax" } },
  rateLimit: { enabled: true, storage: "database", window: 60, max: 30, customRules: { "/sign-in/email": { window: 60, max: 5 } } },
  databaseHooks: {
    session: { create: { before: async (session) => {
      const user = await db.user.findUnique({ where: { id: session.userId } });
      if (!user || user.status !== "ACTIVE") throw new APIError("UNAUTHORIZED", { message: "Email hoặc mật khẩu không hợp lệ." });
      if (user.mustChangePassword) {
        const used = await db.user.updateMany({ where: { id: user.id, status: "ACTIVE", tempPasswordUsedAt: null }, data: { tempPasswordUsedAt: new Date() } });
        if (!used.count) throw new APIError("UNAUTHORIZED", { message: "Email hoặc mật khẩu không hợp lệ." });
      }
      return { data: session };
    } } },
  },
});
