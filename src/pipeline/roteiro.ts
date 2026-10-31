import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod/v4";
import { Checagem, PlanoAula, Reel } from "../schema.js";
import type { Material } from "./ingestao.js";

const MODELO = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";

const client = new Anthropic();

const ESTILO = `Você escreve roteiros de reels educativos em português do Brasil para estudantes de ENEM, vestibular e concurso.
Regras de estilo:
- Cada reel ensina UM conceito em 30 a 60 segundos de fala (cerca de 80 a 150 palavras somando todas as falas).
- A primeira cena é um gancho que prende nos 3 primeiros segundos: uma pergunta, um fato curioso ou uma pegadinha de prova.
- Use um exemplo concreto do dia a dia. Fale como um professor jovem e direto, sem gírias forçadas.
- A última cena é a frase de fixação, a ideia que o aluno leva para a prova.
- O texto na tela é curto e complementa a fala; nunca repete a fala inteira.
- Não invente datas, números, nomes ou leis que não estejam no material.`;

// O material vai primeiro e com cache: todas as chamadas da mesma aula reaproveitam esse prefixo.
function sistema(material: Material): Anthropic.Beta.BetaTextBlockParam[] {
  const blocos: Anthropic.Beta.BetaTextBlockParam[] = [];
  if (material.texto) {
    blocos.push({
      type: "text",
      text: `<material_do_aluno>\n${material.texto}\n</material_do_aluno>`,
      cache_control: { type: "ephemeral" },
    });
  }
  blocos.push({ type: "text", text: ESTILO });
  return blocos;
}

async function pedir<T extends z.ZodType>(
  material: Material,
  pedido: string,
  formato: T,
  esforco: "low" | "medium" | "high",
): Promise<z.infer<T>> {
  const resposta = await client.beta.messages.parse({
    model: MODELO,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: sistema(material),
    output_config: { effort: esforco, format: zodOutputFormat(formato) },
    messages: [{ role: "user", content: pedido }],
  });
  if (resposta.stop_reason === "refusal") {
    throw new Error("O modelo recusou este pedido. Tente outro trecho do material.");
  }
  if (resposta.stop_reason === "max_tokens" || !resposta.parsed_output) {
    throw new Error(`Resposta incompleta do modelo (stop_reason: ${resposta.stop_reason}).`);
  }
  return resposta.parsed_output as z.infer<T>;
}

export async function planejarAula(material: Material, maxReels: number): Promise<PlanoAula> {
  const pedido = material.texto
    ? `Leia o material do aluno e monte o plano de uma aula em reels com no máximo ${maxReels} conceitos, na ordem certa para aprender. Para cada conceito copie literalmente o trecho do material que o sustenta.`
    : `O aluno quer aprender sobre: "${material.tema}". Monte o plano de uma aula em reels com no máximo ${maxReels} conceitos, na ordem certa para aprender. Não há material enviado, então deixe trecho_fonte vazio e fique no conteúdo consolidado de livros didáticos.`;
  const plano = await pedir(material, pedido, PlanoAula, "medium");
  return { ...plano, conceitos: plano.conceitos.slice(0, maxReels) };
}

export async function escreverReel(
  material: Material,
  plano: PlanoAula,
  indice: number,
  correcoes: string[] = [],
): Promise<Reel> {
  const conceito = plano.conceitos[indice];
  const contexto = plano.conceitos.map((c, i) => `${i + 1}. ${c.nome}`).join("\n");
  let pedido = `Aula: ${plano.titulo}
Sequência de conceitos:
${contexto}

Escreva o reel ${indice + 1}: "${conceito.nome}".
Objetivo: ${conceito.objetivo}
${conceito.trecho_fonte ? `Trecho do material que sustenta este reel:\n"""${conceito.trecho_fonte}"""\nUse apenas o que está no material.` : ""}
Inclua uma pergunta de múltipla escolha no estilo de prova sobre este conceito.`;
  if (correcoes.length > 0) {
    pedido += `\n\nUma versão anterior foi reprovada na checagem. Corrija estes problemas:\n- ${correcoes.join("\n- ")}`;
  }
  return pedir(material, pedido, Reel, "medium");
}

export async function checarReel(material: Material, plano: PlanoAula, indice: number, reel: Reel): Promise<Checagem> {
  const conceito = plano.conceitos[indice];
  const base = conceito.trecho_fonte
    ? `Compare cada fala, texto de tela e o quiz com o material do aluno. Reprove qualquer afirmação que não tenha base no material ou que o contradiga.`
    : `Não há material do aluno. Reprove qualquer afirmação factualmente incorreta ou duvidosa (datas, números, nomes, causas).`;
  const pedido = `${base}
Confira também se a alternativa marcada como correta no quiz está mesmo certa e se as outras estão erradas.
Seja rigoroso com fatos e tolerante com simplificações didáticas que não ficam erradas.

Reel a checar:
${JSON.stringify(reel, null, 2)}`;
  return pedir(material, pedido, Checagem, "medium");
}
