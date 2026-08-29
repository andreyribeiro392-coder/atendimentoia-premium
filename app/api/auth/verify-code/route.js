import { NextResponse } from 'next/server';
import { createSession, hashCode, secureEqual } from '../../../../lib/auth';
import { getJson, metric, normalizeEmail, redis, userKey } from '../../../../lib/redis';

export async function POST(request) {
  const { email: rawEmail, code = '' } = await request.json();
  const email = normalizeEmail(rawEmail);
  const [stored, user] = await Promise.all([redis(['GET', `ontop:code:${email}`]), getJson(userKey(email))]);
  if (!stored || !user || user.status !== 'active' || !secureEqual(stored, hashCode(email, String(code)))) {
    await metric('invalid_codes');
    return NextResponse.json({ error: 'Código inválido ou expirado.' }, { status: 401 });
  }
  await redis(['DEL', `ontop:code:${email}`]);
  await metric('logins');
  const response = NextResponse.json({ ok: true });
  response.cookies.set('ontop_session', createSession({ email, role: 'user' }), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 2592000 });
  return response;
}
