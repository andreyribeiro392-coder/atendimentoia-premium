const clean = value => String(value || '').trim().replace(/^["']|["']$/g, '');
const url = () => clean(process.env.UPSTASH_REDIS_REST_URL).replace(/\/$/, '');
const token = () => clean(process.env.UPSTASH_REDIS_REST_TOKEN);

export async function redis(command) {
  if (!url() || !token()) throw new Error('Upstash não configurado');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
      cache: 'no-store',
      signal: controller.signal
    });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error || 'Falha no Upstash');
    return data.result;
  } finally {
    clearTimeout(timer);
  }
}

export const getJson = async key => {
  const value = await redis(['GET', key]);
  if (!value) return null;
  const parsed = JSON.parse(value);
  if (String(key).startsWith('ontop:user:') && ['pro', 'premium'].includes(String(parsed?.plan || '').toLowerCase()) && parsed?.planExpiresAt && new Date(parsed.planExpiresAt).getTime() <= Date.now()) {
    const downgraded = { ...parsed, plan: 'free', planExpiresAt: null, paymentStatus: 'expired', updatedAt: new Date().toISOString() };
    await redis(['SET', key, JSON.stringify(downgraded)]);
    return downgraded;
  }
  return parsed;
};
export const setJson = (key, value) => redis(['SET', key, JSON.stringify(value)]);
export const normalizeEmail = email => String(email || '').trim().toLowerCase();
export const userKey = email => `ontop:user:${normalizeEmail(email)}`;

export async function getUser(email) {
  const normalized = normalizeEmail(email);
  const user = await getJson(userKey(normalized));
  if (!user) return null;
  const isPaidPlan = ['pro', 'premium'].includes(String(user.plan || '').toLowerCase());
  const expiresAt = user.planExpiresAt ? new Date(user.planExpiresAt).getTime() : 0;
  if (isPaidPlan && expiresAt && expiresAt <= Date.now()) {
    return saveUser({ ...user, email: normalized, plan: 'free', planExpiresAt: null, paymentStatus: 'expired' });
  }
  return user;
}

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
