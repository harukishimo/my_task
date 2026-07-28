import "server-only";

import { google } from "googleapis";
import { getServerConfig } from "@/lib/server-config";

export function getSheetsClient() {
  const config = getServerConfig();
  const auth = new google.auth.JWT({
    email: config.googleServiceAccountEmail,
    key: config.googlePrivateKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}
