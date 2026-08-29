import { NextResponse } from 'next/server';
import { currentAdmin } from '../../../../lib/auth';
import { issueCode } from '../../../../lib/codes';
import { metric, normalizeEmail, redis, saveUser } from '../../../../lib/redis';

const dayBR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
export async function POST(request) {
  if (!await currentAdmin()) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const { action, email: rawEmail, name = '', business = '' } = await request.json();
  const email = normalizeEmail(rawEmail);
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
  if (action === 'authorize') { await saveUser({ email, name, business, status: 'active', source: 'admin', authorizedAt: new Date().toISOString() }); await metric('manual_authorizations'); }
  else if (action === 'block') { await saveUser({ email, status: 'blocked', source: 'admin' }); await metric('manual_blocks'); }
  else if (action === 'reset') await redis(['DEL', `ontop:usage:${email}:${dayBR()}`]);
  else if (action === 'send') { await issueCode(email, name); await metric('codes_sent_admin'); }
  else return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
