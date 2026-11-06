import { useSyncExternalStore } from "react";
import type { Reel } from "../src/schema";
import type { Objetivo } from "../src/pipeline/estilo";

// O progresso do aluno entre uma visita e outra: XP, ofensiva, meta do dia, cartões de revisão e aulas salvas.
// Onde fica guardado, nesta ordem de preferência:
// 1. Na conta do Claude de quem usa (capacidade "db", na pasta privada data/users/<id>). Acompanha a pessoa
//    em qualquer aparelho, mas só grava para quem tem nível de Contributor ou acima no link.
// 2. No próprio navegador (localStorage), para quem abre por link público ou fora do Claude.
// 3. Só na memória, quando o navegador não deixa gravar nada (o progresso some ao fechar a página).

// ---------- Tipos ----------

// Uma pergunta de múltipla escolha: a do fim de cada reel (4 alternativas) ou a do simulado (5, com texto-base).
export type Questao = {
  textoBase?: string;
  pergunta: string;
  alternativas: string[];
  correta: number;
  explicacao: string;
  // Por que cada alternativa está certa ou errada, na mesma ordem das alternativas.
  porQue?: string[];
  conceito?: string;
};

// Uma pergunta que volta na revisão. Caixa 0 volta no dia seguinte, caixa 1 em 3 dias, caixa 2 em 7 dias;
// acertar na caixa 2 marca como dominada. Errar em qualquer caixa volta para a caixa 0.
export type Cartao = {
  id: string;
  conceito: string;
  aulaId: string;
  aulaTitulo: string;
  questao: Questao;
  // A frase de fixação do reel, mostrada depois da resposta para lembrar a ideia principal.
  lembrete?: string;
  caixa: number;
  proxima: string;
  dominado: boolean;
  erros: number;
  acertos: number;
  criadoEm: number;
};

export type NovoCartao = Pick<Cartao, "id" | "conceito" | "aulaId" | "aulaTitulo" | "questao" | "lembrete">;

export type Perfil = {
  xp: number;
  // Dias seguidos batendo a meta.
  ofensiva: number;
  melhorOfensiva: number;
  ultimaMeta: string | null;
  // Perguntas respondidas por dia (reels, simulado e revisão contam).
  metaDiaria: number;
  hoje: { dia: string; respostas: number; acertos: number; xp: number };
};

export type ResumoAula = { id: string; titulo: string; objetivo: Objetivo; criadaEm: number; reels: number; questoes: number };

export type AulaSalva = {
  id: string;
  titulo: string;
  objetivo: Objetivo;
  criadaEm: number;
  conceitos: string[];
  reels: Reel[];
  simulado: Questao[];
};

export type Fonte = "carregando" | "conta" | "aparelho" | "memoria";

// curtidas: os reels curtidos, como "<id da aula>-r<posição>". Aula com reel curtido sobe em "Suas aulas".
export type Progresso = { fonte: Fonte; perfil: Perfil; cartoes: Cartao[]; aulas: ResumoAula[]; curtidas: string[] };

// ---------- Datas (sempre no fuso do aparelho) ----------

export function diaDe(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function somarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split("-").map(Number);
  return diaDe(new Date(a, m - 1, d + n, 12));
}

// "hoje", "amanhã", "em 3 dias" ou a data.
export function quando(dia: string, hoje = diaDe()): string {
  if (dia <= hoje) return "hoje";
  if (dia === somarDias(hoje, 1)) return "amanhã";
  for (let n = 2; n <= 7; n++) if (dia === somarDias(hoje, n)) return `em ${n} dias`;
  const [, m, d] = dia.split("-");
  return `em ${d}/${m}`;
}

// ---------- Revisão espaçada ----------

export const INTERVALOS = [1, 3, 7];

function agendarErro(c: Cartao, hoje: string): Cartao {
  return { ...c, caixa: 0, proxima: somarDias(hoje, INTERVALOS[0]), dominado: false, erros: c.erros + 1 };
}

function agendarAcerto(c: Cartao, hoje: string): Cartao {
  const caixa = c.caixa + 1;
  if (caixa >= INTERVALOS.length) return { ...c, caixa, dominado: true, acertos: c.acertos + 1 };
  return { ...c, caixa, proxima: somarDias(hoje, INTERVALOS[caixa]), acertos: c.acertos + 1 };
}

const cartaoNovo = (n: NovoCartao, hoje: string): Cartao => ({
  ...n,
  caixa: 0,
  proxima: somarDias(hoje, INTERVALOS[0]),
  dominado: false,
  erros: 0,
  acertos: 0,
  criadoEm: Date.now(),
});

const comCartao = (lista: Cartao[], c: Cartao) => (lista.some((x) => x.id === c.id) ? lista.map((x) => (x.id === c.id ? c : x)) : [...lista, c]);

export const pendentes = (p: Progresso, hoje = diaDe()) => p.cartoes.filter((c) => !c.dominado && c.proxima <= hoje);

// A próxima revisão marcada depois de hoje: em que dia e quantas perguntas.
export function proximaRevisao(p: Progresso, hoje = diaDe()): { dia: string; quantidade: number } | null {
  const futuras = p.cartoes.filter((c) => !c.dominado && c.proxima > hoje);
  if (!futuras.length) return null;
  const dia = futuras.reduce((menor, c) => (c.proxima < menor ? c.proxima : menor), futuras[0].proxima);
  return { dia, quantidade: futuras.filter((c) => c.proxima === dia).length };
}

// ---------- Ofensiva e meta do dia ----------

export const METAS = [5, 10, 20];
const META_PADRAO = 5;

// A ofensiva continua viva se a meta foi batida hoje ou ontem.
export function ofensivaAtual(p: Perfil, hoje = diaDe()): number {
  return p.ultimaMeta === hoje || p.ultimaMeta === somarDias(hoje, -1) ? p.ofensiva : 0;
}

export const respostasHoje = (p: Perfil, hoje = diaDe()) => (p.hoje.dia === hoje ? p.hoje.respostas : 0);

function conferirMeta(p: Perfil, hoje: string): { perfil: Perfil; bateuMeta: boolean } {
  if (p.ultimaMeta === hoje || respostasHoje(p, hoje) < p.metaDiaria) return { perfil: p, bateuMeta: false };
  const ofensiva = p.ultimaMeta === somarDias(hoje, -1) ? p.ofensiva + 1 : 1;
  return { perfil: { ...p, ofensiva, melhorOfensiva: Math.max(p.melhorOfensiva, ofensiva), ultimaMeta: hoje }, bateuMeta: true };
}

// ---------- Onde gravar ----------

type Banco = {
  ler(chave: string): Promise<Record<string, unknown> | null>;
  gravar(chave: string, valor: Record<string, unknown>): Promise<void>;
  apagar(chave: string): Promise<void>;
};

type DocDb = {
  get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
  set(valor: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
};
type Db = { collection(caminho: string): { doc(id: string): DocDb } };
type Usuario = { id(): Promise<string | null>; can?(nome: string): unknown };

function bancoDaConta(db: Db, uid: string): Banco {
  const pasta = db.collection(`data/users/${uid}`);
  return {
    async ler(chave) {
      const doc = await pasta.doc(chave).get();
      return doc.exists ? (doc.data() ?? null) : null;
    },
    gravar: (chave, valor) => pasta.doc(chave).set(valor),
    apagar: (chave) => pasta.doc(chave).delete(),
  };
}

const PREFIXO = "learningflix:";

function bancoDoAparelho(): Banco | null {
  try {
    localStorage.setItem(PREFIXO + "teste", "1");
    localStorage.removeItem(PREFIXO + "teste");
  } catch {
    return null;
  }
  return {
    async ler(chave) {
      const texto = localStorage.getItem(PREFIXO + chave);
      return texto ? (JSON.parse(texto) as Record<string, unknown>) : null;
    },
    async gravar(chave, valor) {
      localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
    },
    async apagar(chave) {
      localStorage.removeItem(PREFIXO + chave);
    },
  };
}

function bancoNaMemoria(): Banco {
  const dados = new Map<string, string>();
  return {
    async ler(chave) {
      const texto = dados.get(chave);
      return texto ? (JSON.parse(texto) as Record<string, unknown>) : null;
    },
    async gravar(chave, valor) {
      dados.set(chave, JSON.stringify(valor));
    },
    async apagar(chave) {
      dados.delete(chave);
    },
  };
}

function reserva(): { banco: Banco; fonte: Fonte } {
  const local = bancoDoAparelho();
  return local ? { banco: local, fonte: "aparelho" } : { banco: bancoNaMemoria(), fonte: "memoria" };
}

async function escolherBanco(): Promise<{ banco: Banco; fonte: Fonte }> {
  const claude = typeof window !== "undefined" ? window.claude : undefined;
  if (!claude) return reserva();
  try {
    const [db, user] = (await Promise.all([claude.use("db"), claude.use("user")])) as [Db | null, Usuario | null];
    if (!db || !user) return reserva();
    // Quem só pode ver o link (Viewer, ou quem chega de fora por link público) não grava na conta.
    if ((await user.can?.("data.write")) === false) return reserva();
    const uid = await user.id();
    if (!uid) return reserva();
    return { banco: bancoDaConta(db, uid), fonte: "conta" };
  } catch {
    return reserva();
  }
}

const comPrazo = <T,>(promessa: Promise<T>, ms: number) =>
  Promise.race([promessa, new Promise<never>((_, falha) => setTimeout(() => falha({ code: "tempo" }), ms))]);

// ---------- Leitura segura do que veio gravado ----------

type Bruto = Record<string, unknown>;
const ehObjeto = (v: unknown): v is Bruto => typeof v === "object" && v !== null && !Array.isArray(v);
const numero = (v: unknown, padrao = 0) => (typeof v === "number" && Number.isFinite(v) ? v : padrao);
const OBJETIVOS: Objetivo[] = ["ENEM", "Vestibular", "Concurso", "Faculdade"];
const ehQuestao = (q: unknown) => ehObjeto(q) && typeof q.pergunta === "string" && Array.isArray(q.alternativas) && typeof q.correta === "number";

const PERFIL_INICIAL: Perfil = {
  xp: 0,
  ofensiva: 0,
  melhorOfensiva: 0,
  ultimaMeta: null,
  metaDiaria: META_PADRAO,
  hoje: { dia: "", respostas: 0, acertos: 0, xp: 0 },
};

function lerPerfil(v: unknown): Perfil {
  if (!ehObjeto(v)) return PERFIL_INICIAL;
  const h = ehObjeto(v.hoje) ? v.hoje : {};
  const meta = numero(v.metaDiaria, META_PADRAO);
  return {
    xp: numero(v.xp),
    ofensiva: numero(v.ofensiva),
    melhorOfensiva: numero(v.melhorOfensiva),
    ultimaMeta: typeof v.ultimaMeta === "string" ? v.ultimaMeta : null,
    metaDiaria: METAS.includes(meta) ? meta : META_PADRAO,
    hoje: { dia: typeof h.dia === "string" ? h.dia : "", respostas: numero(h.respostas), acertos: numero(h.acertos), xp: numero(h.xp) },
  };
}

const lerCartoes = (v: unknown): Cartao[] =>
  Array.isArray(v) ? (v.filter((c) => ehObjeto(c) && typeof c.id === "string" && typeof c.proxima === "string" && ehQuestao(c.questao)) as Cartao[]) : [];

const lerAulas = (v: unknown): ResumoAula[] =>
  Array.isArray(v) ? (v.filter((a) => ehObjeto(a) && typeof a.id === "string" && typeof a.titulo === "string") as ResumoAula[]) : [];

// ---------- O estado e quem acompanha ----------

let estado: Progresso = { fonte: "carregando", perfil: PERFIL_INICIAL, cartoes: [], aulas: [], curtidas: [] };
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

let banco: Banco = bancoNaMemoria();
let iniciou = false;
let carregou: () => void = () => {};
const pronto = new Promise<void>((ok) => (carregou = ok));

type Mudanca = (p: Progresso) => Progresso;
// O que o aluno fez antes de o progresso salvo terminar de carregar: é refeito em cima do que veio salvo.
let antesDeCarregar: Mudanca[] = [];

function mudar(f: Mudanca) {
  estado = f(estado);
  if (estado.fonte === "carregando") antesDeCarregar.push(f);
  else agendarGravacao();
  avisar();
}

export function iniciarProgresso() {
  if (iniciou) return;
  iniciou = true;
  (async () => {
    let escolhido = await escolherBanco();
    let salvo: Record<string, unknown> | null = null;
    try {
      salvo = await comPrazo(escolhido.banco.ler("progresso"), 10_000);
    } catch (e) {
      console.warn("Não deu para ler o progresso salvo", e);
      if (escolhido.fonte === "conta") {
        escolhido = reserva();
        salvo = await escolhido.banco.ler("progresso").catch(() => null);
      }
    }
    banco = escolhido.banco;
    let p: Progresso = {
      fonte: escolhido.fonte,
      perfil: lerPerfil(salvo?.perfil),
      cartoes: lerCartoes(salvo?.cartoes),
      aulas: lerAulas(salvo?.aulas),
      curtidas: Array.isArray(salvo?.curtidas) ? (salvo.curtidas as unknown[]).filter((c): c is string => typeof c === "string") : [],
    };
    for (const f of antesDeCarregar) p = { ...f(p), fonte: escolhido.fonte };
    const mudouAntes = antesDeCarregar.length > 0;
    antesDeCarregar = [];
    estado = p;
    carregou();
    if (mudouAntes) agendarGravacao();
    avisar();
  })();
  // Grava o que estiver pendente quando a pessoa sai da página ou troca de aba.
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && gravarAgora());
  }
}

function assinar(f: () => void) {
  ouvintes.add(f);
  iniciarProgresso();
  return () => {
    ouvintes.delete(f);
  };
}
const fotografia = () => estado;

export function useProgresso(): Progresso {
  return useSyncExternalStore(assinar, fotografia);
}

// ---------- Gravação ----------

// Um documento tem no máximo 256 KiB; texto em português pode ter 2 bytes por letra.
const LIMITE_CARACTERES = 110_000;
const MAX_AULAS = 20;

function corpoDoProgresso(p: Progresso): Record<string, unknown> {
  let cartoes = p.cartoes;
  const corpo = () => ({ tipo: "progresso", versao: 1, perfil: p.perfil, cartoes, aulas: p.aulas, curtidas: p.curtidas });
  // Grande demais: saem primeiro os cartões já dominados, depois os mais antigos.
  while (cartoes.length > 0 && JSON.stringify(corpo()).length > LIMITE_CARACTERES) {
    const i = cartoes.findIndex((c) => c.dominado);
    cartoes = i >= 0 ? cartoes.filter((_, k) => k !== i) : cartoes.slice(1);
  }
  return corpo();
}

let relogio = 0;
let gravando = false;
let sujo = false;

function agendarGravacao() {
  sujo = true;
  clearTimeout(relogio);
  relogio = window.setTimeout(gravarAgora, 800);
}

async function gravarAgora() {
  clearTimeout(relogio);
  if (gravando || !sujo || estado.fonte === "carregando") return;
  gravando = true;
  sujo = false;
  try {
    await gravarComRepeticao("progresso", () => corpoDoProgresso(estado));
  } catch (e) {
    // Fica pendente: tenta de novo na próxima mudança ou quando a pessoa sair da página, nunca em loop.
    console.warn("Não deu para salvar o progresso", e);
    sujo = true;
    return;
  } finally {
    gravando = false;
  }
  // Mudou de novo enquanto gravava: grava a versão mais nova.
  if (sujo) agendarGravacao();
}

const CODIGOS_SEM_PERMISSAO = new Set(["invalid_argument", "revoked", "not_granted", "capability_disabled", "capability_removed"]);
const codigo = (e: unknown) => (ehObjeto(e) && typeof e.code === "string" ? e.code : ehObjeto(e) && typeof e.name === "string" ? e.name : "");

// Uma falha passageira é repetida uma vez. Se a conta recusar a gravação (quem só pode ver o link),
// o progresso passa a ser guardado no aparelho pelo resto da visita.
async function gravarComRepeticao(chave: string, corpo: () => Record<string, unknown>) {
  try {
    await banco.gravar(chave, corpo());
  } catch (e) {
    const c = codigo(e);
    if (estado.fonte === "conta" && CODIGOS_SEM_PERMISSAO.has(c)) {
      await mudarParaOAparelho();
      return;
    }
    if (c === "QuotaExceededError" || c === "NS_ERROR_DOM_QUOTA_REACHED") {
      // Navegador cheio: abre espaço apagando as aulas salvas mais antigas e tenta mais uma vez.
      await liberarEspaco(chave);
      await banco.gravar(chave, corpo());
      return;
    }
    if (c === "invalid_argument" || c === "quota_exceeded") throw e;
    await new Promise((ok) => setTimeout(ok, 600 + Math.random() * 900));
    await banco.gravar(chave, corpo());
  }
}

const aulasDaVisita = new Map<string, AulaSalva>();

async function mudarParaOAparelho() {
  const r = reserva();
  banco = r.banco;
  estado = { ...estado, fonte: r.fonte };
  avisar();
  await banco.gravar("progresso", corpoDoProgresso(estado));
  for (const a of aulasDaVisita.values()) await banco.gravar(`aula-${a.id}`, { tipo: "aula", ...a }).catch(() => {});
}

async function liberarEspaco(exceto: string) {
  const outras = estado.aulas.filter((a) => `aula-${a.id}` !== exceto);
  const antigas = [...outras].sort((a, b) => a.criadaEm - b.criadaEm).slice(0, Math.ceil(outras.length / 2));
  for (const a of antigas) await banco.apagar(`aula-${a.id}`).catch(() => {});
  const fora = new Set(antigas.map((a) => a.id));
  estado = { ...estado, aulas: estado.aulas.filter((a) => !fora.has(a.id)) };
  avisar();
}

// Uma gravação por vez em cada documento.
const filas = new Map<string, Promise<void>>();
function naFila(chave: string, tarefa: () => Promise<void>) {
  const anterior = filas.get(chave) ?? pronto;
  const proxima = anterior.then(tarefa).catch((e) => console.warn(`Não deu para salvar ${chave}`, e));
  filas.set(chave, proxima);
}

// ---------- O que o app faz ----------

// Conta uma resposta (de reel, simulado ou revisão) para o XP e a meta do dia.
export function registrarResposta(acertou: boolean, xp: number): { bateuMeta: boolean; ofensiva: number } {
  const hoje = diaDe();
  let resultado = { bateuMeta: false, ofensiva: 0 };
  mudar((p) => {
    const dia = p.perfil.hoje.dia === hoje ? p.perfil.hoje : { dia: hoje, respostas: 0, acertos: 0, xp: 0 };
    const perfil: Perfil = {
      ...p.perfil,
      xp: p.perfil.xp + xp,
      hoje: { dia: hoje, respostas: dia.respostas + 1, acertos: dia.acertos + (acertou ? 1 : 0), xp: dia.xp + xp },
    };
    const meta = conferirMeta(perfil, hoje);
    resultado = { bateuMeta: meta.bateuMeta, ofensiva: meta.perfil.ofensiva };
    return { ...p, perfil: meta.perfil };
  });
  return resultado;
}

// Errou: a pergunta volta amanhã (e de novo em 3 e 7 dias, se acertar).
export function registrarErro(n: NovoCartao) {
  const hoje = diaDe();
  mudar((p) => {
    const atual = p.cartoes.find((c) => c.id === n.id);
    const base = atual ? { ...atual, questao: n.questao, lembrete: n.lembrete ?? atual.lembrete } : cartaoNovo(n, hoje);
    return { ...p, cartoes: comCartao(p.cartoes, agendarErro(base, hoje)) };
  });
}

// "Revisar" ou "Não entendi" no reel: a pergunta do reel entra na revisão de amanhã.
export function marcarParaRevisar(n: NovoCartao) {
  const hoje = diaDe();
  mudar((p) => (p.cartoes.some((c) => c.id === n.id && !c.dominado) ? p : { ...p, cartoes: comCartao(p.cartoes, cartaoNovo(n, hoje)) }));
}

// Tirou o "Revisar": sai da revisão, a não ser que a pessoa já tenha errado essa pergunta.
export function desmarcarRevisao(id: string) {
  mudar((p) => ({ ...p, cartoes: p.cartoes.filter((c) => c.id !== id || c.erros > 0) }));
}

export function responderRevisao(id: string, acertou: boolean) {
  const hoje = diaDe();
  mudar((p) => ({ ...p, cartoes: p.cartoes.map((c) => (c.id !== id ? c : acertou ? agendarAcerto(c, hoje) : agendarErro(c, hoje))) }));
}

export function trocarMeta() {
  mudar((p) => {
    const metaDiaria = METAS[(METAS.indexOf(p.perfil.metaDiaria) + 1) % METAS.length];
    return { ...p, perfil: conferirMeta({ ...p.perfil, metaDiaria }, diaDe()).perfil };
  });
}

// Guarda a aula inteira para rever sem gerar de novo. Ficam as 20 mais recentes.
export function salvarAula(a: AulaSalva) {
  aulasDaVisita.set(a.id, a);
  const resumo: ResumoAula = { id: a.id, titulo: a.titulo, objetivo: a.objetivo, criadaEm: a.criadaEm, reels: a.reels.length, questoes: a.simulado.length };
  mudar((p) => {
    const todas = [resumo, ...p.aulas.filter((x) => x.id !== a.id)].sort((x, y) => y.criadaEm - x.criadaEm);
    for (const velha of todas.slice(MAX_AULAS)) naFila(`aula-${velha.id}`, () => banco.apagar(`aula-${velha.id}`));
    const ficam = todas.slice(0, MAX_AULAS);
    const ids = new Set(ficam.map((x) => x.id));
    return { ...p, aulas: ficam, curtidas: p.curtidas.filter((c) => ids.has(c.slice(0, c.lastIndexOf("-r")))) };
  });
  naFila(`aula-${a.id}`, () => gravarComRepeticao(`aula-${a.id}`, () => ({ tipo: "aula", ...a })));
}

export async function abrirAula(id: string): Promise<AulaSalva | null> {
  const daVisita = aulasDaVisita.get(id);
  if (daVisita) return daVisita;
  await pronto;
  await filas.get(`aula-${id}`);
  const dados = await banco.ler(`aula-${id}`).catch(() => null);
  if (!dados || !Array.isArray(dados.reels) || dados.reels.length === 0) return null;
  const aula: AulaSalva = {
    id,
    titulo: typeof dados.titulo === "string" ? dados.titulo : "Sua aula",
    objetivo: OBJETIVOS.includes(dados.objetivo as Objetivo) ? (dados.objetivo as Objetivo) : "ENEM",
    criadaEm: numero(dados.criadaEm, Date.now()),
    conceitos: Array.isArray(dados.conceitos) ? (dados.conceitos as string[]) : [],
    reels: dados.reels as Reel[],
    simulado: Array.isArray(dados.simulado) ? (dados.simulado.filter(ehQuestao) as Questao[]) : [],
  };
  aulasDaVisita.set(id, aula);
  return aula;
}

export function apagarAula(id: string) {
  aulasDaVisita.delete(id);
  mudar((p) => ({ ...p, aulas: p.aulas.filter((a) => a.id !== id), curtidas: p.curtidas.filter((c) => !c.startsWith(`${id}-`)) }));
  naFila(`aula-${id}`, () => banco.apagar(`aula-${id}`));
}

// ---------- Curtidas ----------

export const chaveDoReel = (aulaId: string, posicao: number) => `${aulaId}-r${posicao}`;

// Curte ou descurte um reel. Com "so" = true (dois toques no reel), só curte: nunca descurte.
export function curtirReel(chave: string, so = false) {
  mudar((p) => {
    const tem = p.curtidas.includes(chave);
    if (tem && so) return p;
    return { ...p, curtidas: tem ? p.curtidas.filter((c) => c !== chave) : [...p.curtidas, chave] };
  });
}

export const aulaCurtida = (p: Progresso, aulaId: string) => p.curtidas.some((c) => c.startsWith(`${aulaId}-r`));
