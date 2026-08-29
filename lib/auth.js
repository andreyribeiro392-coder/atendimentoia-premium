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
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
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

// O código precisa ser validável tanto pelo Premium quanto pelo Mini.
// A segurança vem do código aleatório, expiração de 10 minutos e uso único.
export const hashCode = (email, code) =>
  crypto.createHash('sha256').update(`ontop-access:${String(email).trim().toLowerCase()}:${String(code)}`).digest('hex');

export const secureEqual = (a = '', b = '') => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};
