import { z } from "zod/v4";

// Cada cena usa um template visual fixo. O LLM só escolhe o template e preenche o texto;
// quem desenha é o nosso código, por isso texto e números saem sempre corretos.

export const CenaGancho = z.object({
  template: z.literal("gancho"),
  fala: z.string().describe("O que a voz diz nesta cena. Frase curta e provocativa."),
  titulo: z.string().describe("Texto grande na tela, no máximo 8 palavras."),
  subtitulo: z.string().describe("Linha menor de apoio, no máximo 10 palavras. Pode ser vazia."),
});

export const CenaLista = z.object({
  template: z.literal("lista"),
  fala: z.string(),
  titulo: z.string(),
  itens: z.array(z.string()).describe("2 a 4 itens curtos, no máximo 6 palavras cada."),
});

export const CenaComparacao = z.object({
  template: z.literal("comparacao"),
  fala: z.string(),
  titulo: z.string(),
  esquerda: z.object({ nome: z.string(), pontos: z.array(z.string()) }),
  direita: z.object({ nome: z.string(), pontos: z.array(z.string()) }),
});

export const CenaLinhaDoTempo = z.object({
  template: z.literal("linha_do_tempo"),
  fala: z.string(),
  titulo: z.string(),
  eventos: z
    .array(z.object({ data: z.string(), texto: z.string() }))
    .describe("2 a 4 eventos em ordem cronológica."),
});

export const CenaFixacao = z.object({
  template: z.literal("fixacao"),
  fala: z.string(),
  frase: z.string().describe("A frase que o aluno deve levar para a prova, no máximo 14 palavras."),
});

export const Cena = z.discriminatedUnion("template", [
  CenaGancho,
  CenaLista,
  CenaComparacao,
  CenaLinhaDoTempo,
  CenaFixacao,
]);

export const Quiz = z.object({
  pergunta: z.string(),
  alternativas: z.array(z.string()).describe("Exatamente 4 alternativas curtas."),
  correta: z.number().int().describe("Índice da alternativa correta, de 0 a 3."),
  explicacao: z.string().describe("Uma frase dizendo por que a correta está certa."),
});

export const Reel = z.object({
  conceito: z.string(),
  cenas: z.array(Cena).describe("3 a 5 cenas. A primeira é sempre gancho e a última sempre fixacao."),
  quiz: Quiz,
});

export const PlanoAula = z.object({
  titulo: z.string(),
  conceitos: z
    .array(
      z.object({
        nome: z.string(),
        objetivo: z.string().describe("O que o aluno deve saber explicar depois do reel."),
        trecho_fonte: z
          .string()
          .describe("Trecho copiado literalmente do material que sustenta este conceito. Vazio se não houver material."),
      }),
    )
    .describe("De 3 a 8 conceitos, na ordem em que devem ser ensinados."),
});

export const Checagem = z.object({
  aprovado: z.boolean(),
  problemas: z.array(z.string()).describe("Cada frase sem base na fonte ou incorreta, com o motivo. Vazio se aprovado."),
});

export const Aula = z.object({
  titulo: z.string(),
  reels: z.array(Reel),
});

export type Cena = z.infer<typeof Cena>;
export type Reel = z.infer<typeof Reel>;
export type PlanoAula = z.infer<typeof PlanoAula>;
export type Checagem = z.infer<typeof Checagem>;
export type Aula = z.infer<typeof Aula>;
