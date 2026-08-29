import crypto from 'crypto';
import { cookies } from 'next/headers';

const secret = () => process.env.AUTH_SECRET || '';
const sign = value => crypto.createHmac('sha256', secret()).update(value).digest('base64url');

export function createSession(payload, hours = 24 * 30) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + hours * 3600000 })).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function readSession(value) {
  if (!value || !secret()) return null;
  const [body, signature] = value.split('.');
  if (!body || !signature) return null;
  const expected = sign(body);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const data = JSON.parse(Buffer.from(body, 'base64url').toString());
  return data.exp > Date.now() ? data : null;
}

export async function currentUser() {
  const jar = await cookies();
  return readSession(jar.get('ontop_session')?.value);
}

export async function currentAdmin() {
  const jar = await cookies();
  const session = readSession(jar.get('ontop_admin')?.value);
  return session?.role === 'admin' ? session : null;
}

export const hashCode = (email, code) => crypto.createHash('sha256').update(`${email}:${code}:${secret()}`).digest('hex');
export const secureEqual = (a = '', b = '') => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
