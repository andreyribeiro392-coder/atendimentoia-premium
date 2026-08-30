import { NextResponse } from 'next/server';
import { createSession, hashCode, secureEqual } from '../../../../lib/auth';
import { getUser, metric, normalizeEmail, redis } from '../../../../lib/redis';

export async function POST(request) {
  try {
    const { email: rawEmail, code = '' } = await request.json();
    const email = normalizeEmail(rawEmail);
    if (!/^\S+@\S+\.\S+$/.test(email) || !/^\d{6}$/.test(String(code))) {
      return NextResponse.json({ error: 'Digite o e-mail e o código de 6 números.' }, { status: 400 });
    }
    const attemptsKey = `ontop:code-attempts:${email}`;
    const attempts = Number(await redis(['INCR', attemptsKey]));
    if (attempts === 1) await redis(['EXPIRE', attemptsKey, 600]);
    if (attempts > 5) {
      await redis(['DEL', `ontop:code:${email}`]);
      return NextResponse.json({ error: 'Muitas tentativas. Solicite um novo código.' }, { status: 429 });
    }
    const [stored, user] = await Promise.all([
      redis(['GET', `ontop:code:${email}`]),
      getUser((email))
    ]);
    if (!stored || !user || user.status !== 'active' || !secureEqual(stored, hashCode(email, code))) {
      await metric('invalid_codes');
      return NextResponse.json({ error: 'Código inválido ou expirado. Solicite um novo código.' }, { status: 401 });
    }
    await redis(['DEL', `ontop:code:${email}`, attemptsKey]);
    await metric('logins');
    const response = NextResponse.json({ ok: true });
    response.cookies.set('ontop_session', createSession({ email, role: 'user' }), {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 2592000
    });
    return response;
  } catch {
    await metric('login_errors');
    return NextResponse.json({ error: 'Não foi possível validar o acesso agora. Tente novamente.' }, { status: 500 });
  }
}
