import { NextResponse } from 'next/server';
import { createSession, secureEqual } from '../../../../lib/auth';
import { metric } from '../../../../lib/redis';

export async function POST(request) {
  const { password = '' } = await request.json();
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected || !secureEqual(String(password), expected)) {
    await metric('admin_login_failed');
    return NextResponse.json({ error: 'Senha incorreta.' }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set('ontop_admin', createSession({ role: 'admin' }, 12), { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 43200 });
  return response;
}
