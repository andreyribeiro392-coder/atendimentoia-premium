import { NextResponse } from 'next/server';
import { currentUser } from '../../../../lib/auth';
import { getUser, normalizeEmail, redis } from '../../../../lib/redis';

const limitFor = (user) => ['pro', 'premium'].includes(String(user?.plan || '').toLowerCase()) ? 25 : 3;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

function fallback(input) {
  const name = input.service || 'seu serviço';
  const audience = input.audience || 'seu cliente ideal';
  return {
    source: 'fallback',
    title: `Oferta ${name}`,
    subtitle: `Uma proposta clara para ${audience}.`,
    promise: `Tenha acesso a ${name.toLowerCase()} com uma experiência simples, profissional e pensada para o resultado que você busca.`,
    benefits: 'Benefícios, diferenciais e condições organizados para facilitar a decisão do cliente.',
    message: `Olá! Preparei uma condição especial de ${name.toLowerCase()} para você. Posso te explicar como funciona e verificar o melhor horário?`,
    nextStep: 'Confirme preço, prazo e disponibilidade antes de enviar.',
    note: 'Configure GROQ_API_KEY para gerar versões personalizadas com IA.'
  };
}

export async function POST(request) {
  let usageKey = '';
  let reserved = false;
  try {
    const session = await currentUser();
    if (!session?.email) return NextResponse.json({ error: 'Faça login para criar uma oferta.' }, { status: 401 });
    const email = normalizeEmail(session.email);
    const user = await getUser(email);
    if (!user || user.status !== 'active') return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 });
    const input = await request.json().catch(() => ({}));
    const service = String(input.service || '').trim();
    if (service.length < 3 || service.length > 180) return NextResponse.json({ error: 'Informe o que você vende.' }, { status: 400 });
    const dailyLimit = limitFor(user);
    usageKey = `ontop:offer-usage:${email}:${today()}`;
    const used = Number(await redis(['INCR', usageKey]));
    reserved = true;
    if (used === 1) await redis(['EXPIRE', usageKey, 172800]);
    if (used > dailyLimit) {
      await redis(['DECR', usageKey]);
      reserved = false;
      return NextResponse.json({ error: `Limite diário atingido (${dailyLimit} ofertas). Tente novamente amanhã.`, remaining: 0, limit: dailyLimit }, { status: 429 });
    }

    const brief = {
      service,
      audience: String(input.audience || '').trim().slice(0, 240),
      price: String(input.price || '').trim().slice(0, 120),
      result: String(input.result || '').trim().slice(0, 600),
      difference: String(input.difference || '').trim().slice(0, 600),
      type: String(input.type || 'servico').slice(0, 40)
    };
    const key = process.env.GROQ_API_KEY;
    if (!key) return NextResponse.json({ ...fallback(brief), remaining: dailyLimit - used, limit: dailyLimit });

    const prompt = `Crie uma oferta comercial profissional para este negócio. Responda somente JSON válido com title, subtitle, promise, benefits, message e nextStep. Serviço/produto: ${brief.service}. Público: ${brief.audience || 'não informado'}. Preço: ${brief.price || 'não informado'}. Resultado desejado: ${brief.result || 'não informado'}. Diferencial: ${brief.difference || 'não informado'}. Tipo: ${brief.type}. Não invente preço. Escreva em português brasileiro, sem prometer resultado garantido.`;
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', temperature: .65, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] })
    });
    if (!response.ok) return NextResponse.json({ ...fallback(brief), remaining: dailyLimit - used, limit: dailyLimit, warning: 'A IA externa respondeu com erro; uma versão inicial foi criada.' });
    const data = await response.json();
    try {
      return NextResponse.json({ ...JSON.parse(data?.choices?.[0]?.message?.content || '{}'), source: 'groq', remaining: dailyLimit - used, limit: dailyLimit });
    } catch {
      return NextResponse.json({ ...fallback(brief), remaining: dailyLimit - used, limit: dailyLimit });
    }
  } catch (error) {
    if (reserved && usageKey) await redis(['DECR', usageKey]).catch(() => {});
    console.error('[offer/generate] failed', { message: error?.message, name: error?.name });
    return NextResponse.json({ error: 'Não foi possível gerar a oferta agora.' }, { status: 503 });
  }
}
