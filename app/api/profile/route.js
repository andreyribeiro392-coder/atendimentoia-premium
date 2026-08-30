import { NextResponse } from 'next/server';
import { currentUser } from '../../lib/auth';
import { getJson, metric, saveUser, userKey } from '../../lib/redis';

const fields = ['businessName', 'services', 'priceRange', 'hours', 'location', 'tone'];

function clean(value, max) {
  return String(value || '').trim().slice(0, max);
}

function profileOf(user) {
  return fields.reduce((profile, field) => {
    profile[field] = user?.[field] || '';
    return profile;
  }, {});
}

export async function GET() {
  try {
    const session = await currentUser();
    if (!session?.email) return NextResponse.json({ error: 'Entre novamente para continuar.' }, { status: 401 });
    const user = await getJson(userKey(session.email));
    if (!user || user.status !== 'active') return NextResponse.json({ error: 'Acesso bloqueado.' }, { status: 403 });
    return NextResponse.json({ profile: profileOf(user) });
  } catch (error) {
    console.error('[profile:get] failed', { message: error?.message });
    return NextResponse.json({ error: 'Não foi possível carregar seu perfil agora.' }, { status: 503 });
  }
}

export async function PUT(request) {
  try {
    const session = await currentUser();
    if (!session?.email) return NextResponse.json({ error: 'Entre novamente para continuar.' }, { status: 401 });
    const current = await getJson(userKey(session.email));
    if (!current || current.status !== 'active') return NextResponse.json({ error: 'Acesso bloqueado.' }, { status: 403 });
    const body = await request.json();
    const updates = {
      businessName: clean(body.businessName, 120),
      services: clean(body.services, 800),
      priceRange: clean(body.priceRange, 120),
      hours: clean(body.hours, 180),
      location: clean(body.location, 120),
      tone: clean(body.tone, 80) || 'Profissional e acolhedor',
      profileUpdatedAt: new Date().toISOString()
    };
    const user = await saveUser({ email: session.email, ...updates });
    await metric('profiles_updated');
    return NextResponse.json({ ok: true, user: { ...profileOf(user), email: user.email, name: user.name, business: user.business, status: user.status } });
  } catch (error) {
    console.error('[profile:put] failed', { message: error?.message });
    return NextResponse.json({ error: 'Não foi possível salvar seu perfil agora.' }, { status: 503 });
  }
}
