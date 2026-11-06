// As contas da tela de resultado: medalha, nível, conquistas e onde o aluno errou.
// Tudo aqui é calculado a partir das respostas da aula; nada é guardado à parte.
import type { Reel } from "../src/schema";
import type { RespostaDada } from "./main";

// ---------- Medalha ----------

export type Faixa = "trofeu" | "ouro" | "prata" | "bronze" | "treino" | "assistida";

export const FAIXAS: Record<Faixa, { titulo: string; frase: string; confete: boolean }> = {
  trofeu: { titulo: "Gabaritou!", frase: "Acertou todas. Isso é nível de prova.", confete: true },
  ouro: { titulo: "Medalha de ouro", frase: "Mandou muito bem. Falta pouco para gabaritar.", confete: true },
  prata: { titulo: "Medalha de prata", frase: "Muito bom! Veja abaixo onde dá para subir.", confete: true },
  bronze: { titulo: "Medalha de bronze", frase: "A base você já pegou. Corrija os erros e suba de medalha.", confete: false },
  treino: { titulo: "Em treino", frase: "Errar aqui é o que faz acertar na prova. Bora corrigir?", confete: false },
  assistida: { titulo: "Aula assistida!", frase: "Responda as perguntas para ganhar sua medalha.", confete: false },
};

// Da pior para a melhor.
export const ORDEM_DAS_FAIXAS: Faixa[] = ["assistida", "treino", "bronze", "prata", "ouro", "trofeu"];

// A nota conta todas as perguntas da aula, como numa prova: a que ficou sem resposta ainda não vale ponto.
// Assim, responder uma e pular o resto não dá medalha de ouro, e responder o que faltou sobe a medalha.
export function faixaDe(acertos: number, respondidas: number, total = respondidas): Faixa {
  if (respondidas === 0) return "assistida";
  const base = Math.max(total, respondidas);
  const fracao = acertos / base;
  if (fracao === 1 && base >= 3) return "trofeu";
  if (fracao >= 0.8) return "ouro";
  if (fracao >= 0.6) return "prata";
  if (fracao >= 0.4) return "bronze";
  return "treino";
}

const ATE_A_FAIXA: Partial<Record<Faixa, string>> = {
  ouro: "na medalha de ouro",
  prata: "na medalha de prata",
  bronze: "na medalha de bronze",
};

// A frase embaixo da medalha. Se ainda falta responder, diz até onde dá para chegar.
export function fraseDoResultado(acertos: number, respondidas: number, total: number): string {
  const faixa = faixaDe(acertos, respondidas, total);
  const faltam = Math.max(0, total - respondidas);
  if (respondidas === 0 || faltam === 0) return FAIXAS[faixa].frase;
  const quantas = faltam === 1 ? "a que falta" : `as ${faltam} que faltam`;
  if (acertos === respondidas) return `Nenhum erro até aqui. Responda ${quantas} e gabarite.`;
  const melhor = faixaDe(acertos + faltam, total, total);
  const ate = ATE_A_FAIXA[melhor];
  if (ate && ORDEM_DAS_FAIXAS.indexOf(melhor) > ORDEM_DAS_FAIXAS.indexOf(faixa)) return `Responda ${quantas}: ainda dá para chegar ${ate}.`;
  return `Responda ${quantas} para fechar a aula.`;
}

// ---------- Nível ----------

// O nível n começa em 50·n·(n−1) XP: 0, 100, 300, 600, 1000… Cada nível pede um pouco mais que o anterior.
export function nivelDe(xp: number) {
  let nivel = 1;
  while (50 * (nivel + 1) * nivel <= xp) nivel++;
  const inicio = 50 * nivel * (nivel - 1);
  const fim = 50 * (nivel + 1) * nivel;
  return { nivel, inicio, fim, fracao: Math.min(1, Math.max(0, (xp - inicio) / (fim - inicio))) };
}

// ---------- Conquistas ----------

export type Conquista = { id: string; emoji: string; titulo: string; detalhe: string };

export function conquistasDaAula(c: {
  faixa: Faixa;
  respostas: RespostaDada[];
  totalSimulado: number;
  melhorSequencia: number;
  reelsVistos: number;
  totalReels: number;
  nivelNovo: number | null;
  primeiraAula: boolean;
  metaBatida: boolean;
  ofensiva: number;
}): Conquista[] {
  const lista: Conquista[] = [];
  const simulado = c.respostas.filter((r) => r.tipo === "simulado");
  if (c.primeiraAula) lista.push({ id: "primeira", emoji: "🌱", titulo: "Primeira aula", detalhe: "O começo de tudo" });
  if (c.faixa === "trofeu") lista.push({ id: "gabarito", emoji: "🏆", titulo: "Gabarito", detalhe: "Acertou todas as perguntas" });
  else if (c.totalSimulado >= 3 && simulado.length === c.totalSimulado && simulado.every((r) => r.acertou))
    lista.push({ id: "simulado", emoji: "🎯", titulo: "Simulado perfeito", detalhe: `${c.totalSimulado} de ${c.totalSimulado} no simulado` });
  if (c.nivelNovo) lista.push({ id: "nivel", emoji: "🚀", titulo: `Nível ${c.nivelNovo}`, detalhe: "Subiu de nível" });
  if (c.melhorSequencia >= 3) lista.push({ id: "combo", emoji: "🔥", titulo: `Combo x${c.melhorSequencia}`, detalhe: "Acertos seguidos" });
  if (c.respostas.some((r) => r.refeita)) lista.push({ id: "virada", emoji: "💪", titulo: "Virou o jogo", detalhe: "Acertou na segunda chance" });
  if (c.totalReels >= 3 && c.reelsVistos >= c.totalReels) lista.push({ id: "maratona", emoji: "🍿", titulo: "Maratonou", detalhe: "Viu todos os reels" });
  if (c.ofensiva >= 2) lista.push({ id: "ofensiva", emoji: "📅", titulo: `${c.ofensiva} dias seguidos`, detalhe: "Ofensiva viva" });
  if (c.metaBatida) lista.push({ id: "meta", emoji: "✅", titulo: "Meta do dia", detalhe: "Batida hoje" });
  return lista;
}

// ---------- Onde errou ----------

export const simplificar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export type DesempenhoDoConceito = { conceito: string; acertos: number; total: number; respostas: RespostaDada[] };

// Acertos por assunto, do que o aluno mais errou para o que mais acertou.
export function porConceito(respostas: RespostaDada[]): DesempenhoDoConceito[] {
  const grupos = new Map<string, DesempenhoDoConceito>();
  for (const r of respostas) {
    const chave = simplificar(r.conceito) || r.conceito;
    const g = grupos.get(chave) ?? { conceito: r.conceito, acertos: 0, total: 0, respostas: [] };
    g.total++;
    if (r.acertou) g.acertos++;
    g.respostas.push(r);
    grupos.set(chave, g);
  }
  return [...grupos.values()].sort((a, b) => b.total - b.acertos - (a.total - a.acertos) || a.acertos / a.total - b.acertos / b.total);
}

// Em que reel da aula está um conceito (pelo nome); -1 se nenhum bater.
export function reelDoConceito(conceitos: string[], conceito: string): number {
  const alvo = simplificar(conceito);
  if (!alvo) return -1;
  const nomes = conceitos.map(simplificar);
  const exato = nomes.indexOf(alvo);
  if (exato >= 0) return exato;
  return nomes.findIndex((n) => n.length > 3 && alvo.length > 3 && (n.includes(alvo) || alvo.includes(n)));
}

// ---------- Capa do reel ----------

export const emojiDoReel = (reel: Reel): string | null => {
  const e = (reel as { emoji?: unknown }).emoji;
  return typeof e === "string" && e.trim() ? e.trim() : null;
};

// O título da capa é o gancho do reel, a frase que abre o vídeo.
export const capaDoReel = (reel: Reel): string => {
  const gancho = reel.cenas.find((c) => c.template === "gancho");
  return gancho?.template === "gancho" && gancho.titulo ? gancho.titulo : reel.conceito;
};
