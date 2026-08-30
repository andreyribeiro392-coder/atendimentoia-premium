import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { currentUser } from '../../../lib/auth';
import { getJson, metric, normalizeEmail, redis, userKey } from '../../../lib/redis';

const key = email => `ontop:contacts:${normalizeEmail(email)}`;
const allowed = new Set(['novo', 'interessado', 'orcamento', 'agendado', 'concluido']);

async function activeSession() {
  const session = await currentUser();
  if (!session?.email) return null;
  const user = await getJson(userKey(session.email));
  return user?.status === 'active' ? { session, user } : null;
}

export async function GET() {
  try {
    const auth = await activeSession();
    if (!auth) return NextResponse.json({ error: 'Entre novamente para continuar.' }, { status: 401 });
    const rows = await redis(['LRANGE', key(auth.session.email), 0, 99]);
    const contacts = (rows || []).map(row => { try { return JSON.parse(row); } catch { return null; } }).filter(Boolean);
    return NextResponse.json({ contacts });
  } catch (error) {
    console.error('[contacts:get] failed', { message: error?.message });
    return NextResponse.json({ error: 'Não foi possível carregar seus contatos agora.' }, { status: 503 });
  }
}

export async function POST(request) {
  try {
    const auth = await activeSession();
    if (!auth) return NextResponse.json({ error: 'Entre novamente para continuar.' }, { status: 401 });
    const body = await request.json();
    const name = String(body.name || '').trim().slice(0, 120);
    if (name.length < 2) return NextResponse.json({ error: 'Informe o nome do contato.' }, { status: 400 });
    const contact = {
      id: crypto.randomUUID(),
      name,
      service: String(body.service || '').trim().slice(0, 160),
      status: allowed.has(body.status) ? body.status : 'novo',
      notes: String(body.notes || '').trim().slice(0, 800),
      nextFollowUp: String(body.nextFollowUp || '').trim().slice(0, 20),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await redis(['LPUSH', key(auth.session.email), JSON.stringify(contact)]);
    await redis(['LTRIM', key(auth.session.email), 0, 99]);
    await metric('contacts_created');
    return NextResponse.json({ ok: true, contact });
  } catch (error) {
    console.error('[contacts:post] failed', { message: error?.message });
    return NextResponse.json({ error: 'Não foi possível salvar o contato agora.' }, { status: 503 });
  }
}

export async function DELETE(request) {
  try {
    const auth = await activeSession();
    if (!auth) return NextResponse.json({ error: 'Entre novamente para continuar.' }, { status: 401 });
    const { id = '' } = await request.json();
    const rows = await redis(['LRANGE', key(auth.session.email), 0, 99]);
    const match = (rows || []).find(row => { try { return JSON.parse(row)?.id === id; } catch { return false; } });
    if (match) await redis(['LREM', key(auth.session.email), 1, match]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[contacts:delete] failed', { message: error?.message });
    return NextResponse.json({ error: 'Não foi possível remover o contato agora.' }, { status: 503 });
  }
}
