import "server-only";

import { ConfigurationError } from "@/lib/tasks/errors";

export type ServerConfig = {
  appPassphraseHash: string;
  sessionSecret: string;
  googleServiceAccountEmail: string;
  googlePrivateKey: string;
  googleSheetId: string;
  googleSheetTab: string;
  googleScheduleTab: string;
  appTimeZone: string;
};

export type AuthConfig = Pick<ServerConfig, "appPassphraseHash" | "sessionSecret">;

export function getAuthConfig(): AuthConfig {
  const passphraseHash = process.env.APP_PASSPHRASE_HASH;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!passphraseHash || !sessionSecret) throw new ConfigurationError("APP_PASSPHRASE_HASH and SESSION_SECRET are required");
  if (sessionSecret.length < 32) throw new ConfigurationError("SESSION_SECRET must be at least 32 characters");
  return { appPassphraseHash: passphraseHash, sessionSecret };
}

export function getServerConfig(): ServerConfig {
  const auth = getAuthConfig();
  const required = [
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_PRIVATE_KEY",
    "GOOGLE_SHEET_ID",
  ] as const;
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) throw new ConfigurationError(`Missing server configuration: ${missing.join(",")}`);
  return {
    ...auth,
    googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
    googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY!,
    googleSheetId: process.env.GOOGLE_SHEET_ID!,
    googleSheetTab: process.env.GOOGLE_SHEET_TAB || "Tasks",
    googleScheduleTab: process.env.GOOGLE_SCHEDULE_TAB || "ScheduleItems",
    appTimeZone: process.env.APP_TIME_ZONE || "Asia/Tokyo",
  };
}

export function hasGoogleConfiguration(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY &&
    process.env.GOOGLE_SHEET_ID,
  );
}
