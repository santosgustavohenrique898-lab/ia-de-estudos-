import aulaExemplo from "../exemplos/fotossintese.aula.json";
import type { Aula } from "../src/schema";
import type { EventoServidor } from "./api";

// Só para a prévia visual publicada sem servidor (build com VITE_PREVIA=1):
// simula a geração com a aula de exemplo e a voz do navegador.
export function simularAula(tipo: string, aoEvento: (e: EventoServidor) => void): () => void {
  const aula = aulaExemplo as Aula;
  const passos: [number, EventoServidor][] = [
    [300, { tipo: "etapa", etapa: tipo === "tema" ? "pesquisando" : "lendo" }],
    [1600, { tipo: "etapa", etapa: "planejando" }],
    [1300, { tipo: "plano", titulo: aula.titulo, conceitos: aula.reels.map((r) => r.conceito) }],
    [300, { tipo: "etapa", etapa: "escrevendo" }],
    ...aula.reels.map(
      (reel, indice): [number, EventoServidor] => [
        indice === 0 ? 1800 : 2500,
        { tipo: "reel", indice, reel, narracao: { audio: null, duracao: 0, palavras: [], cenas: reel.cenas.map(() => ({ inicio: 0, fim: 0 })) } },
      ],
    ),
    [100, { tipo: "fim" }],
  ];
  const timers: number[] = [];
  let t = 0;
  for (const [espera, evento] of passos) {
    t += espera;
    timers.push(window.setTimeout(() => aoEvento(evento), t));
  }
  return () => timers.forEach(clearTimeout);
}
