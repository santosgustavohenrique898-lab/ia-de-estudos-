import { join } from "node:path";
import type { Reel } from "../schema.js";
import { prepararTexto, type Material } from "./ingestao.js";
import { checarReel, escreverReel, pesquisarTema, planejarAula, type Objetivo } from "./roteiro.js";
import { narrar, type Narracao } from "./voz.js";

export type Entrada = { tipo: "tema"; tema: string } | { tipo: "texto"; texto: string };

export type EventoAula =
  | { tipo: "etapa"; etapa: "pesquisando" | "lendo" | "planejando" | "escrevendo" }
  | { tipo: "plano"; titulo: string; conceitos: string[] }
  | { tipo: "reel"; indice: number; reel: Reel; narracao: Narracao }
  | { tipo: "descartado"; indice: number; motivo: string }
  | { tipo: "fim" };

type Opcoes = {
  entrada: Entrada;
  objetivo: Objetivo;
  reels: number;
  // Pasta onde os áudios são gravados; cada reel vira <prefixo>-<n>.mp3 nela.
  pastaAudio: string;
  prefixoAudio: string;
  aoEvento: (e: EventoAula) => void;
};

// A aula inteira: material → plano → cada reel em paralelo (roteiro, checagem, voz).
// Cada reel é avisado assim que fica pronto, para o aluno começar a assistir antes do fim.
export async function gerarAula({ entrada, objetivo, reels, pastaAudio, prefixoAudio, aoEvento }: Opcoes): Promise<void> {
  let material: Material;
  if (entrada.tipo === "tema") {
    aoEvento({ tipo: "etapa", etapa: "pesquisando" });
    material = await pesquisarTema(entrada.tema, objetivo);
  } else {
    aoEvento({ tipo: "etapa", etapa: "lendo" });
    material = { texto: prepararTexto(entrada.texto), origem: "aluno" };
  }

  aoEvento({ tipo: "etapa", etapa: "planejando" });
  const plano = await planejarAula(material, objetivo, reels);
  aoEvento({ tipo: "plano", titulo: plano.titulo, conceitos: plano.conceitos.map((c) => c.nome) });

  aoEvento({ tipo: "etapa", etapa: "escrevendo" });
  await Promise.all(
    plano.conceitos.map(async (_, i) => {
      try {
        let reel = await escreverReel(material, objetivo, plano, i);
        let checagem = await checarReel(material, objetivo, reel);
        if (!checagem.aprovado) {
          reel = await escreverReel(material, objetivo, plano, i, checagem.problemas);
          checagem = await checarReel(material, objetivo, reel);
        }
        if (!checagem.aprovado) {
          aoEvento({ tipo: "descartado", indice: i, motivo: checagem.problemas.join(" | ") });
          return;
        }
        const arquivo = `${prefixoAudio}-${i + 1}.mp3`;
        const narracao = await narrar(reel, join(pastaAudio, arquivo));
        aoEvento({ tipo: "reel", indice: i, reel, narracao: { ...narracao, audio: narracao.audio ? arquivo : null } });
      } catch (erro) {
        aoEvento({ tipo: "descartado", indice: i, motivo: erro instanceof Error ? erro.message : String(erro) });
      }
    }),
  );
  aoEvento({ tipo: "fim" });
}
