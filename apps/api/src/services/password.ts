import {
  argon2 as argon2Callback,
  argon2Sync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

/** Node exposes callback-style `argon2`; promisify for async route handlers. */
const argon2 = promisify(argon2Callback);

/** OWASP-ish defaults for interactive logins. */
const MEMORY_KIB = 65_536;
const PASSES = 3;
const PARALLELISM = 4;
const TAG_LENGTH = 32;
const SALT_LENGTH = 16;

type Argon2Params = {
  message: string;
  nonce: Buffer;
  parallelism: number;
  memory: number;
  passes: number;
  tagLength: number;
};

/**
 * Hash a password with Argon2id via Node's built-in crypto (DESIGN §10 / §13).
 * Stored as a PHC string so parameters travel with the hash.
 */
export async function hashPassword(password: string): Promise<string> {
  const nonce = randomBytes(SALT_LENGTH);
  const params: Argon2Params = {
    message: password,
    nonce,
    parallelism: PARALLELISM,
    memory: MEMORY_KIB,
    passes: PASSES,
    tagLength: TAG_LENGTH,
  };
  const hash = (await argon2('argon2id', params)) as Buffer;
  return [
    '$argon2id',
    'v=19',
    `m=${MEMORY_KIB},t=${PASSES},p=${PARALLELISM}`,
    toB64(nonce),
    toB64(hash),
  ].join('$');
}

/** Constant-time verify against a PHC Argon2id string. */
export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const parts = encoded.split('$');
  // '', 'argon2id', 'v=19', 'm=…,t=…,p=…', salt, hash
  if (parts.length !== 6 || parts[1] !== 'argon2id') return false;
  const paramPart = parts[3];
  const saltB64 = parts[4];
  const hashB64 = parts[5];
  if (!paramPart || saltB64 === undefined || hashB64 === undefined) return false;

  const params = Object.fromEntries(
    paramPart.split(',').map((pair) => {
      const [k, v] = pair.split('=');
      return [k ?? '', v ?? ''];
    }),
  );
  const memory = Number(params['m']);
  const passes = Number(params['t']);
  const parallelism = Number(params['p']);
  if (!Number.isFinite(memory) || !Number.isFinite(passes) || !Number.isFinite(parallelism)) {
    return false;
  }

  let nonce: Buffer;
  let expected: Buffer;
  try {
    nonce = fromB64(saltB64);
    expected = fromB64(hashB64);
  } catch {
    return false;
  }

  const actual = argon2Sync('argon2id', {
    message: password,
    nonce,
    parallelism,
    memory,
    passes,
    tagLength: expected.length,
  });

  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function toB64(buf: Buffer): string {
  return buf.toString('base64').replace(/=+$/u, '');
}

function fromB64(value: string): Buffer {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}
