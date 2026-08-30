import { NextResponse } from 'next/server';
import { currentUser } from '../../../../lib/auth';
import { getJson, userKey } from '../../../../lib/redis';

export async function GET() {
  const session = await currentUser();
  if (!session?.email) return NextResponse.json({ authenticated: false }, { status: 401 });
  const user = await getJson(userKey(session.email));
  if (!user || user.status !== 'active') return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({
    authenticated: true,
    user: {
      email: user.email,
      name: user.name || '',
      business: user.business || '',
      businessName: user.businessName || '',
      services: user.services || '',
      priceRange: user.priceRange || '',
      hours: user.hours || '',
      location: user.location || '',
      tone: user.tone || ''
    }
  });
}
