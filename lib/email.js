export async function sendAccessEmail({ email, code, name = '' }) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !senderEmail) throw new Error('Brevo não configurada');
  const origin = process.env.APP_ORIGIN || 'https://atendimentoia-premiumm.vercel.app';
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: senderEmail, name: process.env.BREVO_SENDER_NAME || 'OnTop Premium IA' },
      to: [{ email, name: name || email.split('@')[0] }],
      subject: 'Seu acesso ao OnTop Premium IA',
      htmlContent: `<!doctype html><html><body style="margin:0;background:#070b10;font-family:Arial,sans-serif;color:#eefbf7"><div style="max-width:520px;margin:0 auto;padding:36px 20px"><div style="background:#0d171d;border:1px solid #24453f;border-radius:24px;padding:32px;text-align:center"><div style="font-size:13px;letter-spacing:2px;color:#45e6bd">ONTOP PREMIUM IA</div><h1 style="font-size:26px;margin:16px 0 8px">Seu acesso está liberado</h1><p style="color:#9fb0ad;line-height:1.6">Use o código abaixo para entrar. Ele expira em 10 minutos e só pode ser usado uma vez.</p><div style="font-size:38px;letter-spacing:9px;font-weight:bold;color:#45e6bd;background:#07100f;border-radius:16px;padding:18px;margin:24px 0">${code}</div><a href="${origin}" style="display:inline-block;background:#45e6bd;color:#04110e;text-decoration:none;font-weight:bold;padding:14px 24px;border-radius:12px">ENTRAR NO PREMIUM</a><p style="font-size:11px;color:#60706e;margin-top:24px">Se você não solicitou este código, ignore esta mensagem.</p></div></div></body></html>`
    })
  });
  if (!response.ok) throw new Error(`Brevo respondeu ${response.status}`);
  return true;
}
