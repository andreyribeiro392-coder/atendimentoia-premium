import { NextResponse } from 'next/server';
import { currentUser } from '../../../../lib/auth';
import { getJson, normalizeEmail, redis, userKey } from '../../../../lib/redis';

const limitFor = (user) => ['pro', 'premium'].includes(String(user?.plan || '').toLowerCase()) ? 40 : 3;
const dateKey = () => new Date().toISOString().slice(0, 10);

function fallback(brief = {}) {
  const topic = String(brief.topic || '').trim() || 'seu tema';
  const audience = String(brief.audience || '').trim() || 'seu público';
  return {
    source: 'demo',
    title: `Guia prático: ${topic}`,
    subtitle: `Um método simples para ${audience.toLowerCase()} sair da intenção e entrar em ação.`,
    promise: 'Conteúdo claro, exemplos reais e um plano para aplicar hoje.',
    chapters: [
      { title: 'Boas-vindas', purpose: 'Contextualizar a transformação e preparar o leitor.' },
      { title: 'Os fundamentos', purpose: `Explicar o que ${topic.toLowerCase()} significa na prática.` },
      { title: 'O método em 7 passos', purpose: 'Organizar a jornada em ações pequenas e progressivas.' },
      { title: 'Exemplos e erros comuns', purpose: 'Mostrar aplicações e evitar os bloqueios mais frequentes.' },
      { title: 'Checklist de aplicação', purpose: 'Transformar o conteúdo em uma rotina de execução.' },
      { title: 'Próximos passos', purpose: 'Fechar com uma ação concreta e uma chamada para continuidade.' }
    ],
    note: 'Prévia local pronta. Configure GROQ_API_KEY para geração real.'
  };
}

async function reserveGeneration(email, limit) {
  const key = `ontop:ebook-usage:${email}:${dateKey()}`;
  const used = Number(await redis(['INCR', key]));
  if (used === 1) await redis(['EXPIRE', key, 172800]);
  if (used > limit) {
    await redis(['DECR', key]).catch(() => {});
    return { allowed: false, used: used - 1 };
  }
  return { allowed: true, used };
}

export async function POST(request) {
  try {
    const session = await currentUser();
    if (!session?.email) return NextResponse.json({ error: 'Faça login para criar um e-book.' }, { status: 401 });
    const email = normalizeEmail(session.email);
    const user = await getJson(userKey(email));
    if (!user || user.status !== 'active') return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 });

    const brief = await request.json().catch(() => ({}));
    const topic = String(brief.topic || '').trim();
    if (topic.length < 3) return NextResponse.json({ error: 'Informe um tema com pelo menos 3 caracteres.' }, { status: 400 });

    const dailyLimit = limitFor(user);
    const reservation = await reserveGeneration(email, dailyLimit);
    if (!reservation.allowed) {
      return NextResponse.json({ error: `Limite diário atingido (${dailyLimit} criações). Tente novamente amanhã.`, remaining: 0, limit: dailyLimit }, { status: 429 });
    }

    const key = process.env.GROQ_API_KEY;
    if (!key) {
      return NextResponse.json({ ...fallback(brief), remaining: dailyLimit - reservation.used, limit: dailyLimit });
    }

    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    const prompt = `Você é um estrategista editorial brasileiro. Crie a estrutura de um e-book vendável, sem promessas enganosas, em JSON válido com title, subtitle, promise e chapters (array de objetos title e purpose). Tema: ${topic}. Público: ${brief.audience || 'não informado'}. Objetivo: ${brief.goal || 'ensinar'}. Tom: ${brief.tone || 'prático'}. Tamanho: ${brief.pages || 18} páginas. Responda apenas JSON.`;
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, temperature: .65, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] })
    });
    if (!response.ok) {
      return NextResponse.json({ ...fallback(brief), source: 'fallback', warning: 'A IA externa respondeu com erro; a prévia local foi mantida.', remaining: dailyLimit - reservation.used, limit: dailyLimit });
    }
    const data = await response.json();
    try {
      const book = JSON.parse(data?.choices?.[0]?.message?.content || '{}');
      return NextResponse.json({ ...book, source: 'groq', remaining: dailyLimit - reservation.used, limit: dailyLimit });
    } catch {
      return NextResponse.json({ ...fallback(brief), source: 'fallback', remaining: dailyLimit - reservation.used, limit: dailyLimit });
    }
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Não foi possível gerar agora.' }, { status: 503 });
  }
}
