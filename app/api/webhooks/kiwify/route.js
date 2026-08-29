import { NextResponse } from 'next/server';
import { issueCode } from '../../../../lib/codes';
import { metric, normalizeEmail, saveUser } from '../../../../lib/redis';

const pick = (obj, paths) => { for (const path of paths) { const value = path.split('.').reduce((x, key) => x?.[key], obj); if (value) return value; } return ''; };
export async function POST(request) {
  const token = new URL(request.url).searchParams.get('token') || request.headers.get('x-ontop-token');
  if (!process.env.KIWIFY_WEBHOOK_TOKEN || token !== process.env.KIWIFY_WEBHOOK_TOKEN) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });
  try {
    const body = await request.json();
    const event = String(pick(body, ['webhook_event_type', 'event', 'type', 'status', 'order_status'])).toLowerCase();
    const email = normalizeEmail(pick(body, ['Customer.email', 'customer.email', 'buyer.email', 'order.customer.email', 'email']));
    const name = pick(body, ['Customer.full_name', 'customer.name', 'buyer.name', 'order.customer.name', 'name']);
    const productId = String(pick(body, ['Product.product_id', 'product.id', 'product_id', 'order.product_id']));
    if (!email) return NextResponse.json({ error: 'Evento sem e-mail.' }, { status: 400 });
    if (process.env.KIWIFY_PRODUCT_ID && productId && productId !== process.env.KIWIFY_PRODUCT_ID) return NextResponse.json({ ignored: true });
    const isBlocked = /refund|reembols|chargeback|cancel|subscription_late|overdue/.test(event);
    const isApproved = /paid|approved|aprovad|complete|subscription_renewed|compra_aprovada/.test(event);
    if (isBlocked) { await saveUser({ email, name, status: 'blocked', source: 'kiwify', lastEvent: event }); await metric('kiwify_blocks'); }
    else if (isApproved) { await saveUser({ email, name, status: 'active', source: 'kiwify', productId, lastEvent: event, authorizedAt: new Date().toISOString() }); await issueCode(email, name); await metric('kiwify_approvals'); }
    else { await metric('kiwify_other_events'); return NextResponse.json({ received: true, ignored: true }); }
    return NextResponse.json({ received: true });
  } catch (error) {
    await metric('kiwify_errors');
    return NextResponse.json({ error: 'Falha ao processar evento.' }, { status: 500 });
  }
}
