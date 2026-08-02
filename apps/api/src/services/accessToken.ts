import { sign, verify } from 'hono/jwt';

import { env } from '../env.js';
import { parseTtlToSeconds } from './ttl.js';

export type AccessClaims = {
  sub: string;
  typ: 'access';
  exp: number;
  iat: number;
};

export async function issueAccessToken(
  userId: string,
  now = new Date(),
): Promise<{ token: string; expiresIn: number }> {
  const expiresIn = parseTtlToSeconds(env().ACCESS_TOKEN_TTL);
  const iat = Math.floor(now.getTime() / 1000);
  const payload: AccessClaims = {
    sub: userId,
    typ: 'access',
    iat,
    exp: iat + expiresIn,
  };
  const token = await sign(payload, env().SECRET_KEY, 'HS256');
  return { token, expiresIn };
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const payload = await verify(token, env().SECRET_KEY, 'HS256');
  const sub = payload['sub'];
  const typ = payload['typ'];
  const exp = payload['exp'];
  const iat = payload['iat'];
  if (
    typeof sub !== 'string' ||
    typ !== 'access' ||
    typeof exp !== 'number' ||
    typeof iat !== 'number'
  ) {
    throw new Error('invalid access token');
  }
  return { sub, typ: 'access', exp, iat };
}
