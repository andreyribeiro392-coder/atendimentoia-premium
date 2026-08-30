"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, Check, ChevronRight, Crown, Download, FileText, FolderOpen, Layers3, LayoutDashboard, Library, Lightbulb, Mail, Menu, MoreHorizontal, PenLine, Plus, RefreshCw, Sparkles, Target, WandSparkles, X } from "lucide-react";

const templates = [
  { id: "guia", title: "Guia prático", description: "Passo a passo para ensinar uma transformação", color: "#7c5cff", pages: "18–32 páginas" },
  { id: "checklist", title: "Checklist premium", description: "Material objetivo para aplicar e consultar", color: "#00bfa6", pages: "8–16 páginas" },
  { id: "workbook", title: "Workbook", description: "Exercícios, espaços de reflexão e planos", color: "#ff9d5c", pages: "20–40 páginas" },
  { id: "mini", title: "Mini e-book", description: "Isca digital curta para captar contatos", color: "#ec6e9f", pages: "6–12 páginas" },
];
const stages = ["Briefing", "Estrutura", "Conteúdo", "Design", "Revisão"];
const seedProjects = [
  { title: "Plano de conteúdo para Instagram", type: "Guia prático", updated: "Hoje, 10:42", pages: 24, progress: 100, color: "#7c5cff" },
  { title: "21 refeições simples", type: "Mini e-book", updated: "Ontem, 18:20", pages: 12, progress: 72, color: "#ff9d5c" },
  { title: "Checklist da primeira venda", type: "Checklist premium", updated: "28 ago", pages: 9, progress: 100, color: "#00bfa6" },
];
const defaultChapters = [
  { id: "capa", title: "Capa e promessa", meta: "Página 1", icon: "✦" }, { id: "intro", title: "Boas-vindas", meta: "Página 2", icon: "01" },
  { id: "fundamentos", title: "Os fundamentos", meta: "Páginas 3–6", icon: "02" }, { id: "passo", title: "O método em 7 passos", meta: "Páginas 7–14", icon: "03" },
  { id: "check", title: "Checklist de aplicação", meta: "Páginas 15–17", icon: "04" }, { id: "final", title: "Próximos passos", meta: "Página 18", icon: "05" },
];
function Logo() { return <div className="brand-mark"><Sparkles size={18} strokeWidth={2.5} /><span>OnTop</span><small>STUDIO</small></div>; }

function StudioHome({ user, onRequireAuth }) {
  const [view, setView] = useState("dashboard"), [mobileMenu, setMobileMenu] = useState(false), [selectedTemplate, setSelectedTemplate] = useState("guia");
  const [topic, setTopic] = useState(""), [audience, setAudience] = useState(""), [goal, setGoal] = useState("Ensinar e gerar autoridade"), [tone, setTone] = useState("Prático e acolhedor"), [pages, setPages] = useState("18");
  const [generating, setGenerating] = useState(false), [generated, setGenerated] = useState(false), [activeChapter, setActiveChapter] = useState("fundamentos"), [toast, setToast] = useState("");
  const [projects, setProjects] = useState(seedProjects);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [usage, setUsage] = useState(null);
  const [generatedBook, setGeneratedBook] = useState(null);
  const [draftText, setDraftText] = useState("");
  const [theme, setTheme] = useState("light");
  async function handleLogout() { await fetch("/api/auth/logout", { method: "POST" }).catch(() => {}); window.location.reload(); }
  async function simulatePayment() {
    const key = window.prompt("Digite a chave temporária de teste:");
    if (!key) return;
    const response = await fetch("/api/test/upgrade", { method: "POST", headers: { "Content-Type": "application/json", "x-test-payment-key": key }, body: "{}" });
    const data = await response.json().catch(() => ({}));
    notify(response.ok ? "Modo Pro ativado por 30 dias para teste." : (data.error || "Não foi possível simular o pagamento."));
  }
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("ontop-studio-projects");
      if (saved) setProjects(JSON.parse(saved));
      const savedTheme = window.localStorage.getItem("ontop-studio-theme");
      if (savedTheme === "dim") setTheme("dim");
    } catch { /* storage is optional */ }
  }, []);
  useEffect(() => {
    if (!user) { setProjectsLoaded(false); setUsage(null); return; }
    fetch("/api/projects", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (Array.isArray(data?.projects) && data.projects.length) setProjects(data.projects); setProjectsLoaded(true); })
      .catch(() => setProjectsLoaded(true));
    fetch("/api/chat", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (data?.limit != null) setUsage({ remaining: data.remaining, limit: data.limit, plan: data.plan }); })
      .catch(() => {});
  }, [user]);
  useEffect(() => {
    try { window.localStorage.setItem("ontop-studio-projects", JSON.stringify(projects)); } catch { /* storage is optional */ }
    if (user && projectsLoaded) {
      fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projects }) }).catch(() => {});
    }
  }, [projects, user, projectsLoaded]);
  useEffect(() => { try { window.localStorage.setItem("ontop-studio-theme", theme); } catch { /* storage is optional */ } }, [theme]);
  const selected = useMemo(() => templates.find((item) => item.id === selectedTemplate) ?? templates[0], [selectedTemplate]);
  function notify(message) { setToast(message); window.setTimeout(() => setToast(""), 2600); }
  function startCreate() { if (!user) return onRequireAuth(); setGenerated(false); setGenerating(false); setView("create"); }
  function openProject(project) { if (!user) return onRequireAuth(); setTopic(project.title); setSelectedTemplate(templates.find((t) => t.title === project.type)?.id || "guia"); setView("editor"); }
  async function generateBook() {
    if (!user) return onRequireAuth();
    if (!topic.trim()) return notify("Digite um tema para começar o seu e-book.");
    setGenerating(true);
    try {
      const response = await fetch("/api/ebook/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, audience, goal, tone, pages: Number(pages), template: selected.id })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify(data.error || "Não foi possível gerar agora.");
        return;
      }
      const firstPurpose = Array.isArray(data.chapters) ? data.chapters[0]?.purpose : "";
      setDraftText(data.promise || firstPurpose || "");
      setGeneratedBook(data);
      setGenerated(true);
      setView("editor");
      setProjects((current) => [{ title: data.title || topic.trim(), type: selected.title, updated: "Agora", pages: Number(pages) || 18, progress: 38, color: selected.color }, ...current]);
      notify(data.source === "fallback" || data.source === "demo" ? "Prévia criada. Conecte a chave Groq para conteúdo completo." : "Estrutura criada com IA.");
    } catch {
      notify("Não foi possível conectar ao gerador. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  }
  function downloadPreview() { if (!user) return onRequireAuth(); const title = topic || "Meu novo e-book"; const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;max-width:760px;margin:60px auto;padding:0 28px;color:#182035;line-height:1.7}h1{font-size:42px;line-height:1.1;color:#3d2ca5}h2{margin-top:44px;color:#3d2ca5}small{color:#65708a}</style></head><body><small>OnTop E-book Studio · prévia exportável</small><h1>${title}</h1><p>Um material criado para ${audience || "o seu público"}, com linguagem ${tone.toLowerCase()}.</p><h2>Você vai aprender</h2><p>Uma estrutura clara, exemplos práticos e um plano de aplicação para transformar conhecimento em ação.</p><h2>O método em 7 passos</h2><p>Comece pelo cenário atual, escolha uma prioridade, aplique o primeiro passo e acompanhe a evolução com o checklist final.</p><h2>Próximos passos</h2><p>Salve este material, aplique uma ideia hoje e volte para revisar os resultados.</p></body></html>`; const blob = new Blob([html], { type: "text/html;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${title.toLowerCase().replace(/[^a-z0-9]+/gi, "-") || "ebook"}.html`; anchor.click(); URL.revokeObjectURL(url); notify("Prévia exportada. O motor PDF real será ligado quando a chave estiver configurada."); }
  return <main className={`studio-shell ${theme === "dim" ? "dim-mode" : ""}`}><aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}><div className="sidebar-top"><Logo /><button className="icon-button mobile-close" onClick={() => setMobileMenu(false)} aria-label="Fechar menu"><X size={18} /></button></div><div className="workspace-switch"><div className="workspace-avatar">A</div><div><b>Meu estúdio</b><span>Plano Premium</span></div><ChevronRight size={15} /></div><nav className="nav-list" aria-label="Navegação principal"><button className={view === "dashboard" ? "nav-item active" : "nav-item"} onClick={() => { setView("dashboard"); setMobileMenu(false); }}><LayoutDashboard size={17} />Visão geral</button><button className={view === "create" ? "nav-item active" : "nav-item"} onClick={() => { startCreate(); setMobileMenu(false); }}><WandSparkles size={17} />Criar e-book <span className="nav-pill">IA</span></button><button className={view === "library" ? "nav-item active" : "nav-item"} onClick={() => { setView("library"); setMobileMenu(false); }}><Library size={17} />Meus projetos</button></nav><div className="sidebar-label">RECURSOS</div><nav className="nav-list"><button className="nav-item" onClick={() => { startCreate(); setMobileMenu(false); }}><Layers3 size={17} />Modelos</button><button className="nav-item" onClick={() => notify("A biblioteca de marca será conectada na próxima etapa")}><FolderOpen size={17} />Biblioteca</button></nav><div className="sidebar-bottom"><div className="usage-card"><div className="usage-head"><span>Seu uso hoje</span><b>{usage ? `${usage.remaining} / ${usage.limit}` : `${String(user?.plan || "free").toLowerCase() === "pro" ? "40" : "3"} / dia`}</b></div><div className="usage-bar"><i style={{ width: usage?.limit ? `${Math.max(0, Math.min(100, (usage.remaining / usage.limit) * 100))}%` : "100%" }} /></div><p>Criações disponíveis neste plano</p><button onClick={() => !user ? onRequireAuth() : process.env.NEXT_PUBLIC_TEST_PAYMENT_MODE === "true" ? simulatePayment() : notify("O pagamento real será conectado ao Mercado Pago.")}>Gerenciar plano <ArrowRight size={14} /></button></div><button className="account-row" onClick={() => setTheme(theme === "light" ? "dim" : "light")}><div className="account-avatar">AR</div><div><b>André Ribeiro</b><span>{theme === "light" ? "Modo claro" : "Modo suave"}</span></div><MoreHorizontal size={16} /></button><button className="logout-link" onClick={handleLogout}>Sair da conta</button></div></aside><section className="main-area"><header className="topbar"><button className="icon-button menu-trigger" onClick={() => setMobileMenu(true)} aria-label="Abrir menu"><Menu size={20} /></button><div className="crumb"><span>Meu estúdio</span><ChevronRight size={14} /><b>{view === "dashboard" ? "Visão geral" : view === "create" ? "Criar e-book" : view === "library" ? "Meus projetos" : "Editor"}</b></div><div className="top-actions">{!user && <button className="login-button" onClick={onRequireAuth}>Entrar para usar <ArrowRight size={14} /></button>}<button className="help-button" onClick={() => notify("Dica: comece por um tema que você domina")}><Lightbulb size={16} /> Dica rápida</button><button className="avatar-small" onClick={() => setTheme(theme === "light" ? "dim" : "light")} aria-label="Alternar tema">AR</button></div></header>{view === "dashboard" && <Dashboard onCreate={startCreate} projects={projects} onOpen={openProject} />}{view === "create" && <CreateBook selectedTemplate={selectedTemplate} setSelectedTemplate={setSelectedTemplate} topic={topic} setTopic={setTopic} audience={audience} setAudience={setAudience} goal={goal} setGoal={setGoal} tone={tone} setTone={setTone} pages={pages} setPages={setPages} selected={selected} generating={generating} generated={generated} onGenerate={generateBook} onBack={() => setView("dashboard")} />}{view === "editor" && <Editor topic={topic || "Meu novo e-book"} audience={audience} tone={tone} selected={selected} book={generatedBook} activeChapter={activeChapter} setActiveChapter={setActiveChapter} draftText={draftText} setDraftText={setDraftText} onDownload={downloadPreview} onCreate={startCreate} onNotify={notify} onRequireAuth={onRequireAuth} locked={!user} />}{view === "library" && <LibraryView projects={projects} onCreate={startCreate} onOpen={openProject} />}</section>{toast && <div className="toast"><Check size={16} />{toast}</div>}</main>;
}

function Dashboard({ onCreate, projects, onOpen }) { return <div className="page-content dashboard-page"><div className="welcome-row"><div><p className="eyebrow">DOMINGO, 30 DE AGOSTO <span className="live-dot" /> ESTÚDIO ONLINE</p><h1>Transforme uma ideia<br /><em>em um produto.</em></h1><p className="lead">Crie e-books, guias e materiais digitais prontos para entregar — com estrutura, texto e design em um só lugar.</p><button className="primary-button" onClick={onCreate}><WandSparkles size={18} />Criar meu primeiro e-book<ArrowRight size={17} /></button></div><div className="hero-orbit"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="hero-card"><BookOpen size={26} /><span>IDEIA → PRODUTO</span><b>sem página<br />em branco</b></div></div></div><div className="section-heading"><div><span className="section-kicker">COMECE AGORA</span><h2>O que você quer criar?</h2></div><button className="text-button" onClick={() => onOpen(projects[0])}>Ver projetos <ArrowRight size={15} /></button></div><div className="quick-grid"><button className="quick-card quick-main" onClick={onCreate}><div className="quick-icon purple"><PenLine size={20} /></div><div><b>Um e-book completo</b><span>Conteúdo, capítulos e capa com uma única ideia</span></div><ArrowRight size={17} /></button><button className="quick-card" onClick={onCreate}><div className="quick-icon orange"><Target size={20} /></div><div><b>Uma isca digital</b><span>Checklist ou mini-guia para capturar leads</span></div><ArrowRight size={17} /></button><button className="quick-card" onClick={onCreate}><div className="quick-icon teal"><FileText size={20} /></div><div><b>Um material de apoio</b><span>Workbook, roteiro ou plano de ação</span></div><ArrowRight size={17} /></button></div><div className="section-heading projects-heading"><div><span className="section-kicker">SEUS PROJETOS</span><h2>Continue de onde parou</h2></div><span className="muted-count">{projects.length} materiais</span></div><div className="projects-grid">{projects.map((project) => <button className="project-card" key={`${project.title}-${project.updated}`} onClick={() => onOpen(project)}><div className="project-cover" style={{ background: `linear-gradient(145deg, ${project.color}, #17152b)` }}><span>OnTop<br />Studio</span><b>{project.title}</b><i>{project.pages} PÁGINAS</i></div><div className="project-info"><div><b>{project.title}</b><span>{project.type} · atualizado {project.updated}</span></div><MoreHorizontal size={17} /></div><div className="project-progress"><div><span>Progresso</span><b>{project.progress}%</b></div><div className="progress-track"><i style={{ width: `${project.progress}%`, background: project.color }} /></div></div></button>)}</div></div>; }

function CreateBook({ selectedTemplate, setSelectedTemplate, topic, setTopic, audience, setAudience, goal, setGoal, tone, setTone, pages, setPages, selected, generating, generated, onGenerate, onBack }) { return <div className="page-content create-page"><div className="create-header"><div><span className="section-kicker">NOVO PROJETO</span><h1>Vamos criar algo <em>incrível.</em></h1><p>Conte o essencial. O Studio organiza o resto.</p></div><button className="text-button" onClick={onBack}>Cancelar</button></div><div className="stepper">{stages.map((stage, index) => <div className={index === 0 ? "step active" : "step"} key={stage}><span>{index + 1}</span>{stage}{index < stages.length - 1 && <i />}</div>)}</div><div className="create-layout"><div className="brief-panel"><div className="panel-heading"><div><span className="section-kicker">01 / BRIEFING</span><h2>Qual é a sua ideia?</h2></div><span className="required">* obrigatório</span></div><label>Sobre o que será o seu material?<textarea value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Ex.: Como organizar as finanças pessoais mesmo ganhando pouco" rows={3} /></label><div className="field-row"><label>Para quem é?<input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Ex.: mulheres autônomas" /></label><label>Objetivo principal<select value={goal} onChange={(event) => setGoal(event.target.value)}><option>Ensinar e gerar autoridade</option><option>Capturar leads</option><option>Vender um produto</option><option>Apoiar uma consultoria</option></select></label></div><div className="field-row"><label>Tom de voz<select value={tone} onChange={(event) => setTone(event.target.value)}><option>Prático e acolhedor</option><option>Direto e confiante</option><option>Leve e inspirador</option><option>Didático e técnico</option></select></label><label>Número de páginas<select value={pages} onChange={(event) => setPages(event.target.value)}><option value="12">12 páginas</option><option value="18">18 páginas</option><option value="24">24 páginas</option><option value="32">32 páginas</option></select></label></div><div className="panel-divider" /><div className="panel-heading template-heading"><div><span className="section-kicker">02 / DIREÇÃO VISUAL</span><h2>Escolha um formato</h2></div><span className="template-count">{templates.length} modelos</span></div><div className="template-grid">{templates.map((template) => <button key={template.id} className={`template-card ${selectedTemplate === template.id ? "selected" : ""}`} onClick={() => setSelectedTemplate(template.id)}><div className="template-preview" style={{ background: `linear-gradient(135deg, ${template.color}, #14121f)` }}><span>OnTop</span><b>{template.title.split(" ")[0]}</b><i>{template.pages}</i></div><div className="template-copy"><b>{template.title}</b><span>{template.description}</span></div>{selectedTemplate === template.id && <div className="selected-check"><Check size={13} /></div>}</button>)}</div><button className="generate-button" onClick={onGenerate} disabled={generating}>{generating ? <><span className="loader" />Montando sua estrutura...</> : <><Sparkles size={18} />Gerar estrutura com IA<ArrowRight size={17} /></>}</button></div><aside className="brief-preview"><div className="preview-label"><span>PRÉVIA</span><span className="preview-status"><span className="green-dot" /> Em tempo real</span></div><div className="paper-preview" style={{ "--accent": selected.color }}><div className="paper-top"><span>OnTop<br />Studio</span><i>01</i></div><div className="paper-hero"><small>{selected.title}</small><h3>{topic || "Seu tema\nvai aparecer aqui"}</h3><p>{audience || "Para quem você quer ensinar"}</p></div><div className="paper-line" /><div className="paper-fake-lines"><i /><i /><i /><i /></div><div className="paper-foot"><span>CRIADO COM IA</span><span>{pages || "18"} PÁGINAS</span></div></div><div className="preview-note"><Lightbulb size={15} /><p><b>Uma boa promessa faz diferença.</b> Seja específico sobre a transformação que o leitor terá.</p></div>{generated && <div className="success-note"><Check size={15} /><span>Estrutura criada. Você já pode editar o conteúdo.</span></div>}</aside></div></div>; }

function Editor({ topic, audience, tone, selected, book, activeChapter, setActiveChapter, draftText, setDraftText, onDownload, onCreate, onNotify, onRequireAuth, locked }) { const active = defaultChapters.find((chapter) => chapter.id === activeChapter) ?? defaultChapters[2]; const initial = active.id === "capa" ? (book?.subtitle || "Uma promessa clara transforma curiosidade em leitura.") : (book?.promise || `Este capítulo foi estruturado para explicar ${topic.toLowerCase()} de forma simples, prática e aplicável. Comece pelo cenário real do leitor, apresente uma ideia por vez e feche cada bloco com uma ação pequena.`); return <div className="editor-page"><div className="editor-toolbar"><div><button className="back-link" onClick={onCreate}>← Novo projeto</button><h1>{topic}</h1><span><span className="green-dot" /> Salvamento automático ativo</span></div><div className="editor-actions"><button className="secondary-button" onClick={() => locked ? onRequireAuth() : onNotify("Compartilhamento estará disponível na próxima etapa")}><span className="share-dot" />Compartilhar</button><button className="export-button" onClick={onDownload}><Download size={16} />Exportar prévia</button></div></div><div className="editor-workspace"><aside className="outline-panel"><div className="outline-head"><div><span className="section-kicker">ESTRUTURA</span><h2>Seu e-book</h2></div><button className="icon-button" onClick={() => locked ? onRequireAuth() : onNotify("Capítulo adicionado ao roteiro")} aria-label="Adicionar capítulo"><Plus size={16} /></button></div><div className="completion"><div><span>Conteúdo</span><b>38%</b></div><div className="progress-track"><i /></div></div><div className="chapter-list">{defaultChapters.map((chapter) => <button key={chapter.id} className={activeChapter === chapter.id ? "chapter active" : "chapter"} onClick={() => setActiveChapter(chapter.id)}><span className="chapter-index">{chapter.icon}</span><span><b>{chapter.title}</b><small>{chapter.meta}</small></span><ChevronRight size={15} /></button>)}</div><button className="add-chapter" onClick={() => onNotify("Novo capítulo pronto para personalizar")}><Plus size={15} />Adicionar seção</button></aside><section className="writing-panel"><div className="writing-head"><div><span className="section-kicker">{active.id === "fundamentos" ? "CAPÍTULO 02" : "SEÇÃO"}</span><h2>{active.title}</h2><p>Escreva com clareza para {audience || "o seu público"}.</p></div><button className="ai-action" onClick={() => { if (locked) return onRequireAuth(); setDraftText(`${initial} Este complemento foi revisado para ficar mais claro, objetivo e acionável.`); onNotify("Sugestão da IA adicionada ao rascunho"); }}><Sparkles size={16} />Melhorar com IA</button></div><div className="editor-paper"><div className="paper-meta"><span>RASCUNHO · {tone}</span><span>⌘ ↵ para gerar</span></div><h3>{active.id === "capa" ? topic : `O que você precisa saber sobre ${topic.toLowerCase()}`}</h3><textarea className="editable-copy" value={draftText || initial} onChange={(event) => setDraftText(event.target.value)} readOnly={locked} aria-label="Conteúdo do capítulo" /><p><strong>O ponto de partida</strong></p><p>Quando o leitor entende por que isso importa, ele consegue enxergar o próximo passo. Use exemplos, checklists e perguntas para tirar o conteúdo do campo das ideias e levar para a rotina.</p><div className="callout"><Lightbulb size={17} /><div><b>Insight do Studio</b><span>Inclua um exemplo concreto e uma ação de 10 minutos nesta seção.</span></div></div><button className="add-block" onClick={() => locked ? onRequireAuth() : onNotify("Bloco de conteúdo adicionado")}><Plus size={16} />Adicionar bloco de conteúdo</button></div></section><aside className="right-panel"><div className="right-tabs"><button className="selected">Prévia</button><button onClick={() => onNotify("Opções de estilo disponíveis no próximo passo")}>Estilo</button></div><div className="mini-book"><div className="mini-cover" style={{ background: `linear-gradient(145deg, ${selected.color}, #17152b)` }}><span>OnTop<br />Studio</span><b>{topic}</b><small>GUIA PRÁTICO</small></div><div className="mini-page"><div className="mini-page-head"><span>02</span><i /><i /></div><h4>{active.title}</h4><div className="mini-lines"><i /><i /><i /><i /><i /><i /></div><div className="mini-box" /></div></div><div className="page-count"><FileText size={15} /> Página {active.meta.replace("Página ", "")} <ChevronRight size={14} /></div><div className="quality-card"><div><span className="quality-score">8.6</span><span>/ 10</span></div><b>Qualidade do material</b><p>Continue adicionando exemplos para deixar o conteúdo ainda mais útil.</p></div></aside></div></div>; }

function LibraryView({ projects, onCreate, onOpen }) { return <div className="page-content library-page"><div className="library-header"><div><span className="section-kicker">BIBLIOTECA</span><h1>Meus projetos</h1><p>Todos os produtos que você está construindo.</p></div><button className="primary-button compact" onClick={onCreate}><Plus size={17} />Novo projeto</button></div><div className="library-filter"><div className="fake-search">⌕ <span>Buscar projeto</span></div><button className="filter-button">Todos os formatos <ChevronRight size={14} /></button></div><div className="library-table"><div className="table-head"><span>PROJETO</span><span>FORMATO</span><span>ATUALIZADO</span><span>STATUS</span></div>{projects.map((project) => <button className="table-row" key={project.title} onClick={() => onOpen(project)}><div className="table-project"><div className="tiny-cover" style={{ background: project.color }}><BookOpen size={14} /></div><b>{project.title}</b></div><span>{project.type}</span><span>{project.updated}</span><span className={project.progress === 100 ? "status done" : "status draft"}>{project.progress === 100 ? "Publicado" : "Em criação"}</span><ChevronRight size={15} /></button>)}</div></div>; }


function Access({ onLogin, onClose }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => { fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "login_view" }) }).catch(() => {}); }, []);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (step === "email" && mode === "register") {
        const registerResponse = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email }) });
        const registerData = await registerResponse.json().catch(() => ({}));
        if (!registerResponse.ok) { setError(registerData.error || "Não foi possível criar a conta."); return; }
      }
      const endpoint = step === "email" ? "/api/auth/request-code" : "/api/auth/verify-code";
      const body = step === "email" ? { email } : { email, code };
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(data.error || "Não foi possível continuar agora."); return; }
      if (step === "email") { setStep("code"); setNotice("Código enviado. Confira sua caixa de entrada e a pasta de spam."); } else onLogin();
    } catch { setError("Não foi possível conectar ao servidor. Tente novamente em alguns segundos."); }
    finally { setBusy(false); }
  }
  function switchMode() { setMode(mode === "login" ? "register" : "login"); setStep("email"); setCode(""); setError(""); setNotice(""); }
  return <main className="access-page"><div className="access-orbit" /><section className="access-card">{onClose && <button type="button" className="access-close" onClick={onClose} aria-label="Fechar">×</button>}<div className="access-brand"><span><Sparkles size={18} /></span><div><b>OnTop</b><small>E-BOOK STUDIO</small></div></div><div className="access-kicker"><Crown size={14} /> {mode === "register" ? "CRIAR CONTA" : "ENTRAR NO STUDIO"}</div><h1>{step === "email" ? (mode === "register" ? "Comece gratuitamente." : "Seu estúdio está pronto.") : "Confira seu e-mail."}</h1><p>{step === "email" ? (mode === "register" ? "Crie sua conta e receba 3 criações gratuitas por dia." : "Digite seu e-mail para receber um código de acesso.") : <>Enviamos um código de 6 números para <b>{email}</b>.</>}</p><form onSubmit={submit}>{step === "email" ? <>{mode === "register" && <label><PenLine size={18} /><input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome" autoComplete="name" autoFocus required /></label>}<label><Mail size={18} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seuemail@exemplo.com" autoComplete="email" autoFocus={mode !== "register"} required /></label></> : <label className="access-code"><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" autoFocus required /></label>}{error && <div className="access-error" role="alert">{error}</div>}{notice && <div className="access-notice" role="status">{notice}</div>}<button disabled={busy}>{busy ? <RefreshCw className="access-spin" size={18} /> : <>{step === "email" ? (mode === "register" ? "CRIAR CONTA" : "RECEBER CÓDIGO") : "ENTRAR NO STUDIO"}<ArrowRight size={17} /></>}</button></form>{step === "code" && <button type="button" className="access-back" onClick={() => { setStep("email"); setCode(""); setError(""); setNotice(""); }}>Usar outro e-mail</button>}<button type="button" className="access-switch" onClick={switchMode}>{mode === "login" ? "Ainda não tenho conta — criar cadastro" : "Já tenho conta — entrar"}</button><div className="access-safe"><Check size={13} /> Acesso individual e protegido</div></section></main>;
}

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [showAccess, setShowAccess] = useState(false);
  async function check() { try { const response = await fetch("/api/auth/me", { cache: "no-store" }); if (response.ok) { const data = await response.json(); setUser(data.user); } } catch {} finally { setLoading(false); } }
  useEffect(() => { check(); }, []);
  if (loading) return <main className="access-loading"><Sparkles className="access-spin" size={22} /><span>Carregando o Studio...</span></main>;
  return <><StudioHome user={user} onRequireAuth={() => setShowAccess(true)} />{showAccess && <div className="access-modal"><Access onLogin={async () => { await check(); setShowAccess(false); }} onClose={() => setShowAccess(false)} /></div>}</>;
}
