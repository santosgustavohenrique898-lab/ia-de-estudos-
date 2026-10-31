import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";

export type Material = {
  // Texto que sustenta a aula: o material do aluno ou a pesquisa feita na internet.
  texto: string;
  // De onde veio o texto, para o roteiro e a checagem saberem o que estão conferindo.
  origem: "aluno" | "pesquisa";
};

// Limite de caracteres enviados ao LLM (~60 páginas de texto corrido).
export const LIMITE_CARACTERES = 150_000;

export async function textoDoPdf(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

// Limpa e valida o texto enviado pelo aluno (colado ou extraído de PDF).
export function prepararTexto(texto: string): string {
  const limpo = texto.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (limpo.length < 200) {
    throw new Error("Quase não há texto aqui. Se for um PDF escaneado (foto), ainda não conseguimos ler; tente colar o texto.");
  }
  if (limpo.length > LIMITE_CARACTERES) {
    throw new Error(`O material tem ${limpo.length} caracteres; o limite é ${LIMITE_CARACTERES}. Envie um capítulo por vez.`);
  }
  return limpo;
}

// Para a linha de comando: um caminho de arquivo vira texto; qualquer outra coisa é um tema.
export async function lerEntrada(entrada: string): Promise<{ texto: string } | { tema: string }> {
  if (!existsSync(entrada)) return { tema: entrada };
  const texto =
    extname(entrada).toLowerCase() === ".pdf" ? await textoDoPdf(new Uint8Array(await readFile(entrada))) : await readFile(entrada, "utf8");
  return { texto: prepararTexto(texto) };
}
