import { randomBytes, scryptSync } from "node:crypto";

const passphrase = process.argv.slice(2).join(" ");
if (!passphrase || passphrase.length < 16) {
  console.error("Usage: node scripts/generate-passphrase-hash.mjs '<16文字以上のパスフレーズ>'");
  process.exit(1);
}
const salt = randomBytes(16).toString("hex");
const derived = scryptSync(passphrase, salt, 64, { N: 16_384, r: 8, p: 1 }).toString("hex");
console.log(`scrypt$16384$8$1$${salt}$${derived}`);
