import { NextResponse } from 'next/server';
import { getUser, metric, normalizeEmail, redis } from '../../../../lib/redis';
import { issueCode } from '../../../../lib/codes';

export async function POST(request) {
  try {
    const email = normalizeEmail((await request.json()).email);
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'Digite um e-mail válido.' }, { status: 400 });
    const user = await getUser((email));
    if (!user || user.status !== 'active') {
      await metric('login_denied');
      return NextResponse.json({ error: 'Acesso não encontrado. Confira o e-mail usado na compra.' }, { status: 403 });
    }
    const cooldownKey = `ontop:code-cooldown:${email}`;
    const cooldown = await redis(['GET', cooldownKey]);
    if (cooldown) return NextResponse.json({ error: 'Aguarde um minuto antes de solicitar outro código.' }, { status: 429 });
    await redis(['SET', cooldownKey, '1', 'EX', 60]);
    await issueCode(email, user.name);
    await metric('codes_sent');
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[auth/request-code] failed', { message: error?.message, name: error?.name });
    await metric('email_errors');
    return NextResponse.json({ error: 'Não conseguimos enviar o código agora. Tente novamente.' }, { status: 500 });
  }
}
