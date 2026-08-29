const url = () => process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '');
const token = () => process.env.UPSTASH_REDIS_REST_TOKEN;

export async function redis(command) {
  if (!url() || !token()) throw new Error('Upstash não configurado');
  const response = await fetch(url(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    cache: 'no-store'
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || 'Falha no Upstash');
  return data.result;
}

export const getJson = async key => {
  const value = await redis(['GET', key]);
  return value ? JSON.parse(value) : null;
};
export const setJson = (key, value) => redis(['SET', key, JSON.stringify(value)]);
export const normalizeEmail = email => String(email || '').trim().toLowerCase();
export const userKey = email => `ontop:user:${normalizeEmail(email)}`;

export async function saveUser(user) {
  const email = normalizeEmail(user.email);
  const current = await getJson(userKey(email));
  const record = { ...current, ...user, email, updatedAt: new Date().toISOString() };
  await Promise.all([
    setJson(userKey(email), record),
    redis(['SADD', 'ontop:users', email])
  ]);
  return record;
}

export async function metric(name, amount = 1) {
  try { await redis(['HINCRBY', 'ontop:metrics', name, amount]); } catch {}
}
