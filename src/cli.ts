import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { Aula, type Reel } from "./schema.js";
import { lerEntrada } from "./pipeline/ingestao.js";
import { gerarAula } from "./pipeline/gerarAula.js";
import type { Objetivo } from "./pipeline/roteiro.js";
import { narrar, type Narracao } from "./pipeline/voz.js";
import { prepararRender } from "./pipeline/render.js";

const AJUDA = `Uso:
  npm run gerar -- <arquivo.pdf | arquivo.txt | "tema"> [--reels 3] [--objetivo ENEM] [--saida pasta]
  npm run demo                      renderiza a aula de exemplo, sem chamar a IA

Exemplos:
  npm run gerar -- apostila-cap3.pdf
  npm run gerar -- "Fotossíntese" --reels 4 --objetivo Vestibular`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    demo: { type: "boolean", default: false },
    reels: { type: "string", default: "3" },
    objetivo: { type: "string", default: "ENEM" },
    saida: { type: "string", default: "saida" },
    ajuda: { type: "boolean", short: "h", default: false },
  },
});

const MARCA = "IA de Estudos";

async function main() {
  if (values.ajuda || (!values.demo && positionals.length === 0)) {
    console.log(AJUDA);
    return;
  }

  const pastaTemp = resolve(values.saida, "_audio");
  await mkdir(pastaTemp, { recursive: true });

  let titulo: string;
  const prontos: { reel: Reel; narracao: Narracao }[] = [];

  if (values.demo) {
    const aula = Aula.parse(JSON.parse(await readFile("exemplos/revolucao-francesa.aula.json", "utf8")));
    titulo = aula.titulo;
    for (const [i, reel] of aula.reels.entries()) {
      const n = await narrar(reel, join(pastaTemp, `demo-${i + 1}.mp3`));
      prontos.push({ reel, narracao: { ...n, audio: n.audio ? `demo-${i + 1}.mp3` : null } });
    }
  } else {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("Defina ANTHROPIC_API_KEY (veja .env.example) ou rode `npm run demo`.");
    const entrada = await lerEntrada(positionals.join(" "));
    titulo = "aula";
    const porIndice = new Map<number, { reel: Reel; narracao: Narracao }>();
    await gerarAula({
      entrada: "tema" in entrada ? { tipo: "tema", tema: entrada.tema } : { tipo: "texto", texto: entrada.texto },
      objetivo: values.objetivo as Objetivo,
      reels: Number(values.reels),
      pastaAudio: pastaTemp,
      prefixoAudio: "cli",
      aoEvento: (e) => {
        if (e.tipo === "etapa") console.log(`… ${e.etapa}`);
        if (e.tipo === "plano") {
          titulo = e.titulo;
          console.log(`Aula: ${e.titulo}`);
          e.conceitos.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
        }
        if (e.tipo === "reel") porIndice.set(e.indice, { reel: e.reel, narracao: e.narracao });
        if (e.tipo === "descartado") console.log(`  Reel ${e.indice + 1} descartado: ${e.motivo}`);
      },
    });
    prontos.push(...[...porIndice.entries()].sort(([a], [b]) => a - b).map(([, v]) => v));
    if (prontos.length === 0) throw new Error("Nenhum reel passou na checagem.");
  }

  const pasta = resolve(values.saida, slug(titulo));
  await mkdir(pasta, { recursive: true });
  await writeFile(join(pasta, "aula.json"), JSON.stringify({ titulo, reels: prontos.map((p) => p.reel) }, null, 2));

  console.log("Preparando o render...");
  const renderizar = await prepararRender(pastaTemp);
  for (const [i, { reel, narracao }] of prontos.entries()) {
    const arquivo = join(pasta, `reel-${String(i + 1).padStart(2, "0")}.mp4`);
    const t0 = Date.now();
    await renderizar({ reel, narracao, numero: i + 1, total: prontos.length, marca: MARCA }, arquivo);
    console.log(`  ${arquivo} (${narracao.duracao.toFixed(0)} s, render em ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  console.log(`\nPronto: ${pasta}`);
}

function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

main().catch((erro) => {
  console.error(`\nErro: ${erro instanceof Error ? erro.message : erro}`);
  process.exit(1);
});
