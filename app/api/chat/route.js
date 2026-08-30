import { NextResponse } from 'next/server';
import { currentUser } from '../../../lib/auth';
import { getJson, metric, redis, userKey } from '../../../lib/redis';

const prompts = {
  reply: 'Analise a conversa e escreva a melhor próxima resposta para tentar conseguir o agendamento sem pressionar.',
  promo: 'Crie uma promoção curta, atraente e específica para preencher horários disponíveis.',
  recover: 'Crie uma mensagem natural para retomar o contato com um cliente que parou de responder.',
  help: 'Atue como consultor profissional: explique processos de atendimento e vendas passo a passo e, quando solicitado, crie mensagens prontas para copiar. Para cobranças, seja respeitoso, claro e nunca ameaçador.',
  analyze: 'Faça um Raio-X da conversa. Responda sempre nesta ordem: DIAGNÓSTICO (intenção e nível de interesse), ETAPA (novo contato, interessado, orçamento, agendamento ou pós-venda), OBJEÇÃO OU RISCO, PRÓXIMA AÇÃO, RESPOSTA PRONTA (3 versões: curta, natural e profissional) e FOLLOW-UP (quando e como retomar).',
  quote: 'Monte um orçamento ou cobrança profissional. Organize: RESUMO DO SERVIÇO, VALOR, PRAZO, CONDIÇÕES, MENSAGEM PRONTA PARA COPIAR e OBSERVAÇÃO. Nunca invente preços ou condições que o usuário não informou.'
};
const dayBR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const limitFor = user => ['pro', 'premium'].includes(String(user?.plan || '').toLowerCase()) ? 40 : 3;

export async function POST(request) {
  let usageKey = '';
  let reserved = false;
  try {
    const session = await currentUser();
    if (!session?.email) return NextResponse.json({ error: 'Entre novamente para continuar.' }, { status: 401 });
    const user = await getJson(userKey(session.email));
    if (!user || user.status !== 'active') return NextResponse.json({ error: 'Acesso bloqueado.' }, { status: 403 });
    const dailyLimit = limitFor(user);
    const { message = '', mode = 'reply', context = [] } = await request.json();
    if (message.trim().length < 2 || message.length > 8000) return NextResponse.json({ error: 'Escreva uma mensagem com pelo menos 2 caracteres.' }, { status: 400 });
    if (!process.env.GROQ_API_KEY) throw new Error('Groq não configurada');
    const contextMessages = Array.isArray(context) ? context.slice(-8).map(item => ({ role: item?.role === 'ai' ? 'assistant' : 'user', content: String(item?.text || '').slice(0, 1500) })).filter(item => item.content.trim()) : [];

    usageKey = `ontop:usage:${session.email}:${dayBR()}`;
    const used = Number(await redis(['INCR', usageKey]));
    reserved = true;
    if (used === 1) await redis(['EXPIRE', usageKey, 172800]);
    if (used > dailyLimit) { await redis(['DECR', usageKey]); return NextResponse.json({ error: `Você utilizou as ${dailyLimit} respostas de hoje.`, remaining: 0 }, { status: 429 }); }

    const profile = [['nome', user.businessName || user.business], ['serviços', user.services], ['faixa de preços', user.priceRange], ['horários', user.hours], ['localização', user.location], ['tom', user.tone]].filter(([, value]) => value).map(([label, value]) => `${label}: ${String(value).slice(0, 800)}`).join('; ');
    const business = profile ? `Contexto do negócio: ${profile}.` : 'O usuário trabalha como profissional de beleza e ainda não configurou o perfil do negócio.';
    const system = `Você é a assistente OnTop Premium IA, uma consultora profissional de atendimento, vendas e organização para pequenos negócios no Brasil. Você não é apenas um chat: ajuda a entender o que fazer, explica processos com clareza, cria textos prontos e orienta o próximo passo. ${business} ${prompts[mode] || prompts.help} Escreva em português brasileiro, de forma humana, profissional e direta. Quando o pedido for uma explicação, organize em passos práticos. Quando pedir uma mensagem, entregue primeiro o texto pronto para copiar e depois uma dica curta de personalização. Em cobranças, seja educado, objetivo e nunca use ameaça, constrangimento ou promessa de resultado. Nunca prometa venda garantida e não invente informações ausentes. Se faltarem dados para orçamento, liste claramente o que precisa ser informado antes de calcular.`;
    let data = null;
    let lastError = '';
    for (const model of ['openai/gpt-oss-20b', 'llama-3.3-70b-versatile']) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const groq = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST', signal: controller.signal,
          headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, temperature: 0.65, max_tokens: 700, messages: [{ role: 'system', content: system }, ...contextMessages, { role: 'user', content: message }] })
        });
        data = await groq.json();
        if (groq.ok) break;
        lastError = data?.error?.message || 'Falha na Groq';
      } finally { clearTimeout(timer); }
    }
    if (!data?.choices?.[0]?.message?.content) throw new Error(lastError || 'Falha na Groq');
    const answer = data.choices?.[0]?.message?.content?.trim();
    await Promise.all([
      redis(['LPUSH', `ontop:history:${session.email}`, JSON.stringify({ at: new Date().toISOString(), mode, message: message.slice(0, 1500), answer })]),
      metric('ai_answers')
    ]);
    await redis(['LTRIM', `ontop:history:${session.email}`, 0, 99]);
    return NextResponse.json({ answer, remaining: Math.max(0, dailyLimit - used), plan: String(user.plan || 'free').toLowerCase() });
  } catch (error) {
    if (reserved && usageKey) await redis(['DECR', usageKey]).catch(() => {});
    console.error('[premium/chat] failed', { message: error?.message, name: error?.name });
    await metric('ai_errors');
    return NextResponse.json({ error: error?.name === 'AbortError' ? 'A resposta demorou além do esperado. Tente novamente.' : 'A assistente ficou indisponível por alguns segundos. Tente novamente.' }, { status: error?.name === 'AbortError' ? 504 : 503 });
  }
}

export async function GET() {
  try {
    const session = await currentUser();
    if (!session?.email) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    const user = await getJson(userKey(session.email));
    if (!user || user.status !== 'active') return NextResponse.json({ error: 'Acesso bloqueado.' }, { status: 403 });
    const dailyLimit = limitFor(user);
    const [used, history] = await Promise.all([
      redis(['GET', `ontop:usage:${session.email}:${dayBR()}`]),
      redis(['LRANGE', `ontop:history:${session.email}`, 0, 29])
    ]);
    return NextResponse.json({ used: Number(used || 0), remaining: Math.max(0, dailyLimit - Number(used || 0)), limit: dailyLimit, plan: String(user.plan || 'free').toLowerCase(), history: (history || []).map(item => { try { return JSON.parse(item); } catch { return null; } }).filter(Boolean) });
  } catch (error) {
    console.error('[premium/chat:get] failed', { message: error?.message });
    return NextResponse.json({ error: 'Não foi possível carregar seu histórico agora.' }, { status: 503 });
  }
}
