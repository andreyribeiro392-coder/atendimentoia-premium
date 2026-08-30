import { NextResponse } from 'next/server';

function fallback(brief={}){
  const topic=brief.topic?.trim()||'seu tema';
  const audience=brief.audience?.trim()||'seu público';
  return {source:'demo',title:`Guia prático: ${topic}`,subtitle:`Um método simples para ${audience.toLowerCase()} sair da intenção e entrar em ação.`,promise:'Conteúdo claro, exemplos reais e um plano para aplicar hoje.',chapters:[{title:'Boas-vindas',purpose:'Contextualizar a transformação e preparar o leitor.'},{title:'Os fundamentos',purpose:`Explicar o que ${topic.toLowerCase()} significa na prática.`},{title:'O método em 7 passos',purpose:'Organizar a jornada em ações pequenas e progressivas.'},{title:'Exemplos e erros comuns',purpose:'Mostrar aplicações e evitar os bloqueios mais frequentes.'},{title:'Checklist de aplicação',purpose:'Transformar o conteúdo em uma rotina de execução.'},{title:'Próximos passos',purpose:'Fechar com uma ação concreta e uma chamada para continuidade.'}],note:'Prévia local pronta. Configure GROQ_API_KEY para geração real.'};
}

export async function POST(request){
  const brief=await request.json().catch(()=>({}));
  const key=process.env.GROQ_API_KEY;
  if(!key)return NextResponse.json(fallback(brief));
  const model=process.env.GROQ_MODEL||'llama-3.3-70b-versatile';
  const prompt=`Você é um estrategista editorial brasileiro. Crie a estrutura de um e-book vendável, sem promessas enganosas, em JSON válido com title, subtitle, promise e chapters (array de objetos title e purpose). Tema: ${brief.topic}. Público: ${brief.audience||'não informado'}. Objetivo: ${brief.goal||'ensinar'}. Tom: ${brief.tone||'prático'}. Tamanho: ${brief.pages||18} páginas. Responda apenas JSON.`;
  const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,temperature:.65,response_format:{type:'json_object'},messages:[{role:'user',content:prompt}]})});
  if(!response.ok)return NextResponse.json({...fallback(brief),source:'fallback',warning:'A IA externa respondeu com erro; a prévia local foi mantida.'});
  const data=await response.json();
  try{return NextResponse.json({...JSON.parse(data?.choices?.[0]?.message?.content),source:'groq'});}catch{return NextResponse.json({...fallback(brief),source:'fallback'});}
}
