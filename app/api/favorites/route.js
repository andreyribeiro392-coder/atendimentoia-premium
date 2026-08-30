import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { currentUser } from '../../../lib/auth';
import { getJson, metric, redis, userKey } from '../../../lib/redis';

const key = email => `ontop:favorites:${String(email).trim().toLowerCase()}`;

async function activeSession() {
  const session = await currentUser();
  if (!session?.email) return null;
  const user = await getJson(userKey(session.email));
  return user?.status === 'active' ? session : null;
}

export async function GET() {
  try {
    const session = await activeSession();
    if (!session) return NextResponse.json({ error: 'Entre novamente para continuar.' }, { status: 401 });
    const rows = await redis(['LRANGE', key(session.email), 0, 49]);
    const favorites = (rows || []).map(row => { try { return JSON.parse(row); } catch { return null; } }).filter(Boolean);
    return NextResponse.json({ favorites });
  } catch (error) {
    console.error('[favorites:get] failed', { message: error?.message });
    return NextResponse.json({ error: 'Não foi possível carregar seus favoritos agora.' }, { status: 503 });
  }
}

export async function POST(request) {
  try {
    const session = await activeSession();
    if (!session) return NextResponse.json({ error: 'Entre novamente para continuar.' }, { status: 401 });
    const body = await request.json();
    const text = String(body.text || '').trim().slice(0, 5000);
    if (text.length < 2) return NextResponse.json({ error: 'Resposta inválida.' }, { status: 400 });
    const favorite = { id: crypto.randomUUID(), text, mode: String(body.mode || 'Atendimento').slice(0, 40), createdAt: new Date().toISOString() };
    await redis(['LPUSH', key(session.email), JSON.stringify(favorite)]);
    await redis(['LTRIM', key(session.email), 0, 49]);
    await metric('favorites_created');
    return NextResponse.json({ ok: true, favorite });
  } catch (error) {
    console.error('[favorites:post] failed', { message: error?.message });
    return NextResponse.json({ error: 'Não foi possível salvar o favorito agora.' }, { status: 503 });
  }
}

export async function DELETE(request) {
  try {
    const session = await activeSession();
    if (!session) return NextResponse.json({ error: 'Entre novamente para continuar.' }, { status: 401 });
    const { id = '' } = await request.json();
    const rows = await redis(['LRANGE', key(session.email), 0, 49]);
    const match = (rows || []).find(row => { try { return JSON.parse(row)?.id === id; } catch { return false; } });
    if (match) await redis(['LREM', key(session.email), 1, match]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[favorites:delete] failed', { message: error?.message });
    return NextResponse.json({ error: 'Não foi possível remover o favorito agora.' }, { status: 503 });
  }
}
