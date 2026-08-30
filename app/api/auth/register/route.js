import { NextResponse } from 'next/server';
import { metric, normalizeEmail, getJson, saveUser, userKey } from '../../../../lib/redis';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || '').trim().replace(/\s+/g, ' ');
    const email = normalizeEmail(body.email);
    if (name.length < 2 || name.length > 80) return NextResponse.json({ error: 'Digite seu nome.' }, { status: 400 });
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'Digite um e-mail válido.' }, { status: 400 });
    const existing = await getJson(userKey(email));
    if (existing?.status === 'active') return NextResponse.json({ error: 'Este e-mail já está cadastrado. Entre para continuar.' }, { status: 409 });
    const user = await saveUser({
      email,
      name,
      status: 'active',
      plan: 'free',
      planExpiresAt: null,
      paymentStatus: 'free',
      createdAt: existing?.createdAt || new Date().toISOString()
    });
    await metric('registrations');
    return NextResponse.json({ ok: true, user: { email: user.email, name: user.name, plan: user.plan } });
  } catch (error) {
    console.error('[auth/register] failed', { message: error?.message, name: error?.name });
    await metric('registration_errors');
    return NextResponse.json({ error: 'Não foi possível criar sua conta agora. Tente novamente.' }, { status: 503 });
  }
}
