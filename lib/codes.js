import crypto from 'crypto';
import { hashCode } from './auth';
import { normalizeEmail, redis } from './redis';
import { sendAccessEmail } from './email';

export async function issueCode(email, name = '') {
  email = normalizeEmail(email);
  const code = String(crypto.randomInt(100000, 1000000));
  await redis(['SET', `ontop:code:${email}`, hashCode(email, code), 'EX', 600]);
  await sendAccessEmail({ email, code, name });
  return true;
}
