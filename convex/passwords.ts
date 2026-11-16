/// <reference types="node" />
'use node';

import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { ConvexError, v } from 'convex/values';
import { action } from './_generated/server';
import { internal } from './_generated/api';

/**
 * Login/registration run as Node actions so they can use real randomness
 * (session tokens, salts) and a memory-hard hash (scrypt).
 */

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>;

const ALGO = 'scrypt-v1';
const KEY_LEN = 64;
const MIN_PASSWORD_LENGTH = 8;
const INVALID_CREDENTIALS = 'E-mail ou senha inválidos.';

type CoachProfile = {
  id: string;
  name: string;
  email: string;
  cref: string;
  specialty: string;
  createdAt: string;
};

type AuthResult = { profile: CoachProfile; sessionToken: string };

async function hashPassword(password: string, saltHex: string): Promise<string> {
  const key = await scrypt(password, Buffer.from(saltHex, 'hex'), KEY_LEN);
  return key.toString('hex');
}

/** Hash format used before scrypt (fixed salt, single SHA-256). Kept only to migrate old accounts. */
function legacyHash(password: string): string {
  return createHash('sha256').update(`raia_pro_salt_v1:${password}`).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function newSessionToken() {
  const sessionToken = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(sessionToken).digest('hex');
  return { sessionToken, tokenHash };
}

function newClientId() {
  return `ch-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
}

export const register = action({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.string(),
    cref: v.string(),
    specialty: v.string(),
  },
  handler: async (ctx, args): Promise<AuthResult> => {
    const email = args.email.trim().toLowerCase();
    const name = args.name.trim();
    if (!name) throw new ConvexError('Informe seu nome.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ConvexError('E-mail inválido.');
    if (args.password.length < MIN_PASSWORD_LENGTH) {
      throw new ConvexError(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    }

    const passwordSalt = randomBytes(16).toString('hex');
    const passwordHash = await hashPassword(args.password, passwordSalt);
    const { sessionToken, tokenHash } = newSessionToken();

    const profile: CoachProfile = await ctx.runMutation(internal.auth.createCoachWithSession, {
      clientId: newClientId(),
      name,
      email,
      passwordHash,
      passwordSalt,
      passwordAlgo: ALGO,
      cref: args.cref.trim(),
      specialty: args.specialty.trim(),
      createdAt: new Date().toISOString(),
      tokenHash,
    });
    return { profile, sessionToken };
  },
});

export const login = action({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { email, password }): Promise<AuthResult> => {
    const normalizedEmail = email.trim().toLowerCase();
    const creds = await ctx.runQuery(internal.auth.getCredentials, { email: normalizedEmail });

    if (!creds) {
      // Spend the same work as a real check so response time doesn't reveal which e-mails exist.
      await hashPassword(password, randomBytes(16).toString('hex'));
      throw new ConvexError(INVALID_CREDENTIALS);
    }

    if (creds.lockedUntil && creds.lockedUntil > Date.now()) {
      const minutes = Math.ceil((creds.lockedUntil - Date.now()) / 60000);
      throw new ConvexError(
        `Muitas tentativas incorretas. Tente novamente em ${minutes} minuto${minutes > 1 ? 's' : ''}.`
      );
    }

    let valid = false;
    let upgrade: { passwordHash: string; passwordSalt: string; passwordAlgo: string } | undefined;

    if (creds.passwordAlgo === ALGO && creds.passwordSalt) {
      valid = safeEqualHex(await hashPassword(password, creds.passwordSalt), creds.passwordHash);
    } else {
      valid = safeEqualHex(legacyHash(password), creds.passwordHash);
      if (valid) {
        const passwordSalt = randomBytes(16).toString('hex');
        upgrade = {
          passwordSalt,
          passwordHash: await hashPassword(password, passwordSalt),
          passwordAlgo: ALGO,
        };
      }
    }

    if (!valid) {
      await ctx.runMutation(internal.auth.recordLoginFailure, { clientId: creds.clientId });
      throw new ConvexError(INVALID_CREDENTIALS);
    }

    const { sessionToken, tokenHash } = newSessionToken();
    const profile: CoachProfile = await ctx.runMutation(internal.auth.completeLogin, {
      clientId: creds.clientId,
      tokenHash,
      upgrade,
    });
    return { profile, sessionToken };
  },
});
