import { NextResponse } from 'next/server';
import { currentUser } from '../../../../lib/auth';
import { getUser, normalizeEmail, saveUser } from '../../../../lib/redis';

export async function POST(request) {
  if (process.env.TEST_PAYMENT_MODE !== 'true') {
    return NextResponse.json({ error: 'Modo de teste desativado.' }, { status: 404 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const suppliedKey = String(request.headers.get('x-test-payment-key') || body.key || '').trim();
    if (!suppliedKey || suppliedKey !== String(process.env.TEST_PAYMENT_KEY || '').trim()) {
      return NextResponse.json({ error: 'Chave de teste inválida.' }, { status: 401 });
    }
    const session = await currentUser();
    if (!session?.email) return NextResponse.json({ error: 'Entre na conta antes de simular o pagamento.' }, { status: 401 });
    const email = normalizeEmail(session.email);
    const user = await getUser((email));
    if (!user || user.status !== 'active') return NextResponse.json({ error: 'Conta não encontrada ou bloqueada.' }, { status: 403 });
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await saveUser({ ...user, email, plan: 'pro', planExpiresAt: expiresAt, paymentStatus: 'approved_test', source: 'test' });
    return NextResponse.json({ ok: true, plan: 'pro', limit: 25, expiresAt });
  } catch (error) {
    console.error('[test/upgrade]', error);
    return NextResponse.json({ error: 'Não foi possível ativar o modo Pro de teste.' }, { status: 503 });
  }
}
