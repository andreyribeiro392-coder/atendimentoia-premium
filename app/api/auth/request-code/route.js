import { NextResponse } from 'next/server';
import { getJson, metric, normalizeEmail, userKey } from '../../../../lib/redis';
import { issueCode } from '../../../../lib/codes';

export async function POST(request) {
  try {
    const email = normalizeEmail((await request.json()).email);
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'Digite um e-mail válido.' }, { status: 400 });
    const user = await getJson(userKey(email));
    if (!user || user.status !== 'active') {
      await metric('login_denied');
      return NextResponse.json({ error: 'Acesso não encontrado. Confira o e-mail usado na compra.' }, { status: 403 });
    }
    await issueCode(email, user.name);
    await metric('codes_sent');
    return NextResponse.json({ ok: true });
  } catch (error) {
    await metric('email_errors');
    return NextResponse.json({ error: 'Não conseguimos enviar o código agora. Tente novamente.' }, { status: 500 });
  }
}
