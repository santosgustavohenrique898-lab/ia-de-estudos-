import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod/v4";
import { Checagem, PlanoAula, Reel } from "../schema.js";
import type { Material } from "./ingestao.js";
import { PUBLICO, estilo, type Objetivo } from "./estilo.js";

export type { Objetivo };

const MODELO = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";

const client = new Anthropic();

// O material vai primeiro e com cache: todas as chamadas da mesma aula reaproveitam esse prefixo.
function sistema(material: Material, objetivo: Objetivo): Anthropic.Beta.BetaTextBlockParam[] {
  const rotulo = material.origem === "aluno" ? "material_do_aluno" : "pesquisa_de_referencia";
  return [
    { type: "text", text: `<${rotulo}>\n${material.texto}\n</${rotulo}>`, cache_control: { type: "ephemeral" } },
    { type: "text", text: estilo(objetivo) },
  ];
}

async function pedir<T extends z.ZodType>(material: Material, objetivo: Objetivo, pedido: string, formato: T): Promise<z.infer<T>> {
  const resposta = await client.beta.messages.parse({
    model: MODELO,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: sistema(material, objetivo),
    output_config: { effort: "medium", format: zodOutputFormat(formato) },
    messages: [{ role: "user", content: pedido }],
  });
  if (resposta.stop_reason === "refusal") {
    throw new Error("A IA recusou este conteúdo. Tente outro assunto ou outro trecho do material.");
  }
  if (resposta.stop_reason === "max_tokens" || !resposta.parsed_output) {
    throw new Error(`Resposta incompleta da IA (stop_reason: ${resposta.stop_reason}).`);
  }
  return resposta.parsed_output as z.infer<T>;
}

// Quando o aluno só informa um tema, a IA pesquisa na internet e monta um dossiê com fontes.
// Esse dossiê vira o material de referência: o roteiro e a checagem trabalham em cima dele.
export async function pesquisarTema(tema: string, objetivo: Objetivo): Promise<Material> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: `Pesquise na internet sobre: "${tema}".
O objetivo é preparar uma aula curta para um ${PUBLICO[objetivo]}.
Use fontes confiáveis (sites educacionais, universidades, enciclopédias, órgãos oficiais).

Depois escreva, em português do Brasil, um dossiê de estudo com:
1. Os conceitos centrais do tema, em ordem de aprendizado, cada um com explicação clara.
2. Fatos, datas, números, fórmulas e nomes importantes, exatamente como aparecem nas fontes.
3. Exemplos e aplicações práticas.
4. Erros comuns e pegadinhas de prova.
5. No final, a lista das fontes usadas (título e URL).

Escreva só o dossiê, sem introdução nem comentários sobre a pesquisa.`,
    },
  ];

  // A busca roda no servidor da Anthropic; em buscas longas a resposta pode vir em partes (pause_turn).
  for (let rodada = 0; rodada < 5; rodada++) {
    const resposta = await client.beta.messages.create({
      model: MODELO,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
      output_config: { effort: "medium" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
      messages,
    });
    if (resposta.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: resposta.content });
      continue;
    }
    if (resposta.stop_reason === "refusal") {
      throw new Error("A IA recusou pesquisar este assunto. Tente descrever o tema de outro jeito.");
    }
    const texto = resposta.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (texto.length < 300) throw new Error("A pesquisa não encontrou conteúdo suficiente sobre esse tema.");
    return { texto, origem: "pesquisa" };
  }
  throw new Error("A pesquisa demorou demais. Tente um tema mais específico.");
}

export async function planejarAula(material: Material, objetivo: Objetivo, maxReels: number): Promise<PlanoAula> {
  const fonte = material.origem === "aluno" ? "o material do aluno" : "a pesquisa de referência";
  const pedido = `Leia ${fonte} e monte o plano de uma aula em reels com exatamente ${maxReels} conceitos (ou menos, se o conteúdo for curto), na ordem certa para aprender: do mais básico ao mais avançado.
O título da aula deve dizer o assunto em poucas palavras.
Para cada conceito, copie literalmente o trecho de ${fonte} que o sustenta.`;
  const plano = await pedir(material, objetivo, pedido, PlanoAula);
  return { ...plano, conceitos: plano.conceitos.slice(0, maxReels) };
}

export async function escreverReel(
  material: Material,
  objetivo: Objetivo,
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
Trecho de referência:
"""${conceito.trecho_fonte}"""
Você pode usar o restante do material de referência para dar contexto, mas não fatos de fora dele.
Inclua uma pergunta de múltipla escolha no estilo de prova sobre este conceito.`;
  if (correcoes.length > 0) {
    pedido += `\n\nUma versão anterior foi reprovada na checagem. Corrija estes problemas:\n- ${correcoes.join("\n- ")}`;
  }
  return pedir(material, objetivo, pedido, Reel);
}

export async function checarReel(material: Material, objetivo: Objetivo, reel: Reel): Promise<Checagem> {
  const fonte = material.origem === "aluno" ? "o material do aluno" : "a pesquisa de referência";
  const pedido = `Compare cada fala, texto de tela e o quiz deste reel com ${fonte}.
Reprove qualquer afirmação que não tenha base nele ou que o contradiga, e qualquer erro factual.
Confira também se a alternativa marcada como correta no quiz está mesmo certa e se as outras estão erradas.
Seja rigoroso com fatos e tolerante com simplificações didáticas e exemplos do cotidiano que não ficam errados.

Reel a checar:
${JSON.stringify(reel, null, 2)}`;
  return pedir(material, objetivo, pedido, Checagem);
}
