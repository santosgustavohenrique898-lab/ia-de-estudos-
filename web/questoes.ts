import type { Questao } from "./progresso";

export const LETRAS = ["A", "B", "C", "D", "E"];

export function embaralhar<T>(lista: T[]): T[] {
  const l = [...lista];
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l;
}

// Troca as alternativas de lugar, para a pessoa lembrar a resposta e não a posição dela.
export function embaralharQuestao(q: Questao): Questao {
  const ordem = embaralhar(q.alternativas.map((_, i) => i));
  return {
    ...q,
    alternativas: ordem.map((i) => q.alternativas[i]),
    porQue: q.porQue ? ordem.map((i) => q.porQue![i]) : undefined,
    correta: ordem.indexOf(q.correta),
  };
}
