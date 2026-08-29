import { NextResponse } from 'next/server';
import { currentUser } from '../../../lib/auth';
import { getJson, metric, redis, userKey } from '../../../lib/redis';

const prompts = {
  reply: 'Analise a conversa e escreva a melhor próxima resposta para tentar conseguir o agendamento sem pressionar.',
  promo: 'Crie uma promoção curta, atraente e específica para preencher horários disponíveis.',
  recover: 'Crie uma mensagem natural para retomar o contato com um cliente que parou de responder.'
};
const dayBR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

export async function POST(request) {
  try {
    const session = await currentUser();
    if (!session?.email) return NextResponse.json({ error: 'Entre novamente para continuar.' }, { status: 401 });
    const user = await getJson(userKey(session.email));
    if (!user || user.status !== 'active') return NextResponse.json({ error: 'Acesso bloqueado.' }, { status: 403 });
    const { message = '', mode = 'reply' } = await request.json();
    if (!message.trim() || message.length > 8000) return NextResponse.json({ error: 'Mensagem inválida.' }, { status: 400 });

    const usageKey = `ontop:usage:${session.email}:${dayBR()}`;
    const used = Number(await redis(['INCR', usageKey]));
    if (used === 1) await redis(['EXPIRE', usageKey, 172800]);
    if (used > 50) { await redis(['DECR', usageKey]); return NextResponse.json({ error: 'Você utilizou as 50 respostas de hoje.', remaining: 0 }, { status: 429 }); }

    const business = user.business ? `Negócio do usuário: ${user.business}.` : 'O usuário trabalha como profissional de beleza.';
    const system = `Você é a assistente OnTop Atendimento IA, especialista em atendimento e vendas pelo WhatsApp para profissionais de beleza no Brasil. ${business} ${prompts[mode] || prompts.reply} Escreva em português brasileiro, de forma humana, profissional e direta. Nunca prometa venda garantida. Entregue primeiro a mensagem pronta para copiar e, se necessário, uma dica curta. Não use markdown excessivo.`;
    const groq = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', temperature: 0.65, max_tokens: 700, messages: [{ role: 'system', content: system }, { role: 'user', content: message }] })
    });
    const data = await groq.json();
    if (!groq.ok) throw new Error(data?.error?.message || 'Falha na Groq');
    const answer = data.choices?.[0]?.message?.content?.trim();
    await Promise.all([
      redis(['LPUSH', `ontop:history:${session.email}`, JSON.stringify({ at: new Date().toISOString(), mode, message: message.slice(0, 1500), answer })]),
      metric('ai_answers')
    ]);
    await redis(['LTRIM', `ontop:history:${session.email}`, 0, 99]);
    return NextResponse.json({ answer, remaining: 50 - used });
  } catch (error) {
    await metric('ai_errors');
    return NextResponse.json({ error: 'A assistente ficou indisponível por alguns segundos. Tente novamente.' }, { status: 500 });
  }
}

export async function GET() {
  const session = await currentUser();
  if (!session?.email) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const [used, history] = await Promise.all([
    redis(['GET', `ontop:usage:${session.email}:${dayBR()}`]),
    redis(['LRANGE', `ontop:history:${session.email}`, 0, 29])
  ]);
  return NextResponse.json({ used: Number(used || 0), remaining: Math.max(0, 50 - Number(used || 0)), history: (history || []).map(JSON.parse) });
}
