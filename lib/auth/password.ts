import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

export function createPassphraseHash(passphrase: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(passphrase, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }).toString("hex");
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${derived}`;
}

export function verifyPassphrase(passphrase: string, encoded: string): boolean {
  const [algorithm, n, r, p, salt, expectedHex] = encoded.split("$");
  if (algorithm !== "scrypt" || !n || !r || !p || !salt || !expectedHex) return false;
  try {
    const expected = Buffer.from(expectedHex, "hex");
    const actual = scryptSync(passphrase, salt, expected.length, { N: Number(n), r: Number(r), p: Number(p) });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
