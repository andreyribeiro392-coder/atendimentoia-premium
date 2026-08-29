import { NextResponse } from 'next/server';
import { currentAdmin } from '../../../../lib/auth';
import { getJson, redis, userKey } from '../../../../lib/redis';

const dayBR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
export async function GET() {
  if (!await currentAdmin()) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const emails = await redis(['SMEMBERS', 'ontop:users']) || [];
  const users = (await Promise.all(emails.map(email => getJson(userKey(email))))).filter(Boolean);
  const usage = await Promise.all(users.map(u => redis(['GET', `ontop:usage:${u.email}:${dayBR()}`])));
  const rawMetrics = await redis(['HGETALL', 'ontop:metrics']) || [];
  const metrics = {};
  for (let i = 0; i < rawMetrics.length; i += 2) metrics[rawMetrics[i]] = Number(rawMetrics[i + 1]);
  return NextResponse.json({
    summary: { total: users.length, active: users.filter(u => u.status === 'active').length, blocked: users.filter(u => u.status !== 'active').length, usedToday: usage.reduce((n, x) => n + Number(x || 0), 0) },
    metrics,
    users: users.map((u, i) => ({ ...u, usedToday: Number(usage[i] || 0) })).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  });
}
