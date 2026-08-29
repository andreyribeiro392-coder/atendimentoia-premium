import { NextResponse } from 'next/server';
import { metric } from '../../../lib/redis';

export async function POST(request) {
  const { event = 'visit' } = await request.json().catch(() => ({}));
  const allowed = ['visit', 'checkout_click', 'login_view', 'admin_view'];
  await metric(allowed.includes(event) ? event : 'other_event');
  return NextResponse.json({ ok: true }, { headers: { 'Access-Control-Allow-Origin': '*' } });
}
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } }); }
