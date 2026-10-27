import { randomBytes, scryptSync } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(projectRoot, ".env.local");

function readHidden(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("Run npm run admin:setup from an interactive project terminal.");
  }
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolveValue, reject) => {
    let value = "";
    const onData = (chunk) => {
      for (const character of String(chunk)) {
        if (character === "\u0003") {
          process.stdin.off("data", onData);
          process.stdin.setRawMode(false);
          reject(new Error("Setup cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          process.stdin.off("data", onData);
          process.stdin.setRawMode(false);
          process.stdout.write("\n");
          resolveValue(value);
          return;
        }
        if (character === "\u0008" || character === "\u007f") value = value.slice(0, -1);
        else if (character >= " ") value += character;
      }
    };
    process.stdin.on("data", onData);
  });
}

function encodeEnvValue(key, value, source) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  return pattern.test(source) ? source.replace(pattern, line) : `${source.replace(/(?:\r?\n)*$/, "")}\n${line}\n`;
}

const password = await readHidden("Choose an admin owner password (12 to 128 characters): ");
if (password.length < 12 || password.length > 128) throw new Error("Choose a password between 12 and 128 characters.");
const confirmation = await readHidden("Confirm the admin owner password: ");
if (password !== confirmation) throw new Error("The two passwords did not match.");

const salt = randomBytes(16);
const key = scryptSync(password, salt, 64, { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const passwordHash = `scrypt$16384$8$1$${salt.toString("hex")}$${key.toString("hex")}`;
const sessionSecret = randomBytes(48).toString("base64url");
let current = "";
try { current = await readFile(envPath, "utf8"); } catch (error) { if (error?.code !== "ENOENT") throw error; }
let updated = encodeEnvValue("ADMIN_OWNER_PASSWORD_HASH", passwordHash, current);
updated = encodeEnvValue("ADMIN_SESSION_SECRET", sessionSecret, updated);
await writeFile(envPath, updated, { encoding: "utf8", mode: 0o600 });
process.stdout.write("Local admin credentials saved to .env.local. Secret values were not printed.\n");
