import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";

export type Material = {
  // Texto do material enviado. Vazio quando o aluno só informou um tema.
  texto: string;
  tema: string;
};

// Limite de caracteres enviados ao LLM no protótipo (~60 páginas de texto corrido).
const LIMITE_CARACTERES = 150_000;

export async function lerMaterial(entrada: string): Promise<Material> {
  if (!existsSync(entrada)) {
    return { texto: "", tema: entrada };
  }

  const ext = extname(entrada).toLowerCase();
  let texto: string;
  if (ext === ".pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(await readFile(entrada)));
    const { text } = await extractText(pdf, { mergePages: true });
    texto = text;
  } else {
    texto = await readFile(entrada, "utf8");
  }

  texto = texto.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (texto.length < 200) {
    throw new Error(
      `Quase não há texto em ${entrada}. Se for um PDF escaneado (foto), o protótipo ainda não faz OCR.`,
    );
  }
  if (texto.length > LIMITE_CARACTERES) {
    throw new Error(
      `O material tem ${texto.length} caracteres; o protótipo aceita até ${LIMITE_CARACTERES}. Envie um capítulo por vez.`,
    );
  }
  return { texto, tema: "" };
}
