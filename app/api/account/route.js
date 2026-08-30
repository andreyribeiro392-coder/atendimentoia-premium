import { NextResponse } from 'next/server';
import { currentUser } from '../../../lib/auth';
import { getJson, redis, userKey } from '../../../lib/redis';

const emailKey = email => String(email).trim().toLowerCase();

async function auth() {
  const session = await currentUser();
  if (!session?.email) return null;
  const user = await getJson(userKey(session.email));
  return user?.status === 'active' ? { session, user } : null;
}

export async function GET() {
  try {
    const logged = await auth();
    if (!logged) return NextResponse.json({ error: 'Entre novamente para continuar.' }, { status: 401 });
    const email = emailKey(logged.session.email);
    const [history, contacts, favorites] = await Promise.all([
      redis(['LRANGE', `ontop:history:${email}`, 0, 99]),
      redis(['LRANGE', `ontop:contacts:${email}`, 0, 99]),
      redis(['LRANGE', `ontop:favorites:${email}`, 0, 49])
    ]);
    return NextResponse.json({ exportedAt: new Date().toISOString(), user: logged.user, history, contacts, favorites });
  } catch (error) {
    console.error('[account:get] failed', { message: error?.message });
    return NextResponse.json({ error: 'Não foi possível exportar seus dados agora.' }, { status: 503 });
  }
}

export async function DELETE() {
  try {
    const logged = await auth();
    if (!logged) return NextResponse.json({ error: 'Entre novamente para continuar.' }, { status: 401 });
    const email = emailKey(logged.session.email);
    await Promise.all([
      redis(['DEL', userKey(email)]),
      redis(['DEL', `ontop:history:${email}`]),
      redis(['DEL', `ontop:contacts:${email}`]),
      redis(['DEL', `ontop:favorites:${email}`]),
      redis(['SREM', 'ontop:users', email])
    ]);
    const response = NextResponse.json({ ok: true });
    response.cookies.delete('ontop_session');
    return response;
  } catch (error) {
    console.error('[account:delete] failed', { message: error?.message });
    return NextResponse.json({ error: 'Não foi possível excluir seus dados agora.' }, { status: 503 });
  }
}
