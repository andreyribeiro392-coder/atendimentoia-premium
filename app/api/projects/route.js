import { NextResponse } from 'next/server';
import { currentUser } from '../../../lib/auth';
import { getJson, getUser, normalizeEmail, redis } from '../../../lib/redis';

const projectsKey = (email) => `ontop:projects:${normalizeEmail(email)}`;

async function activeSession() {
  const session = await currentUser();
  if (!session?.email) return null;
  const email = normalizeEmail(session.email);
  const user = await getUser((email));
  return user?.status === 'active' ? { session, email } : null;
}

export async function GET() {
  try {
    const auth = await activeSession();
    if (!auth) return NextResponse.json({ error: 'Faça login para acessar seus projetos.' }, { status: 401 });
    return NextResponse.json({ projects: (await getJson(projectsKey(auth.email))) || [] });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Não foi possível carregar os projetos.' }, { status: 503 });
  }
}

export async function POST(request) {
  try {
    const auth = await activeSession();
    if (!auth) return NextResponse.json({ error: 'Faça login para salvar seus projetos.' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    if (!Array.isArray(body.projects)) return NextResponse.json({ error: 'Formato de projetos inválido.' }, { status: 400 });
    const projects = body.projects.slice(0, 100).map((project) => ({
      title: String(project?.title || 'Projeto sem título').slice(0, 160),
      type: String(project?.type || 'E-book').slice(0, 80),
      updated: String(project?.updated || 'Agora').slice(0, 40),
      pages: Math.max(1, Math.min(500, Number(project?.pages) || 1)),
      progress: Math.max(0, Math.min(100, Number(project?.progress) || 0)),
      color: String(project?.color || '#7c5cff').slice(0, 30)
    }));
    await redis(['SET', projectsKey(auth.email), JSON.stringify(projects)]);
    return NextResponse.json({ ok: true, projects });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Não foi possível salvar os projetos.' }, { status: 503 });
  }
}
