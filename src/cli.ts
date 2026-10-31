import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { Aula, type Reel } from "./schema.js";
import { lerMaterial } from "./pipeline/ingestao.js";
import { checarReel, escreverReel, planejarAula } from "./pipeline/roteiro.js";
import { narrar } from "./pipeline/voz.js";
import { prepararRender } from "./pipeline/render.js";

const AJUDA = `Uso:
  npm run gerar -- <arquivo.pdf | arquivo.txt | "tema"> [--reels 3] [--saida pasta]
  npm run demo                      renderiza a aula de exemplo, sem chamar a IA

Exemplos:
  npm run gerar -- apostila-cap3.pdf
  npm run gerar -- "Revolução Francesa" --reels 4`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    demo: { type: "boolean", default: false },
    reels: { type: "string", default: "3" },
    saida: { type: "string", default: "saida" },
    ajuda: { type: "boolean", short: "h", default: false },
  },
});

const MARCA = "reels-estudo";

async function main() {
  if (values.ajuda || (!values.demo && positionals.length === 0)) {
    console.log(AJUDA);
    return;
  }

  const aula = values.demo
    ? Aula.parse(JSON.parse(await readFile("exemplos/revolucao-francesa.aula.json", "utf8")))
    : await gerarRoteiro(positionals.join(" "), Number(values.reels));

  const pasta = resolve(values.saida, slug(aula.titulo));
  const publico = join(pasta, "publico");
  await mkdir(publico, { recursive: true });
  await writeFile(join(pasta, "aula.json"), JSON.stringify(aula, null, 2));

  console.log(`\nNarrando ${aula.reels.length} reels...`);
  if (!process.env.ELEVENLABS_API_KEY) console.log("  (sem ELEVENLABS_API_KEY: vídeo sem voz, legenda no ritmo estimado)");
  const narracoes = await Promise.all(
    aula.reels.map((reel, i) => narrar(reel, join(publico, nomeAudio(i)))),
  );

  console.log("Preparando o render...");
  const renderizar = await prepararRender(publico);
  for (const [i, reel] of aula.reels.entries()) {
    const n = narracoes[i];
    const arquivo = join(pasta, `reel-${String(i + 1).padStart(2, "0")}.mp4`);
    const t0 = Date.now();
    await renderizar(
      {
        reel,
        narracao: { ...n, audio: n.audio ? nomeAudio(i) : null },
        numero: i + 1,
        total: aula.reels.length,
        marca: MARCA,
      },
      arquivo,
    );
    console.log(`  ${arquivo} (${n.duracao.toFixed(0)} s de fala, render em ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  console.log(`\nPronto: ${pasta}`);
}

async function gerarRoteiro(entrada: string, maxReels: number): Promise<Aula> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Defina ANTHROPIC_API_KEY (veja .env.example) ou rode `npm run demo`.");
  }
  const material = await lerMaterial(entrada);
  console.log(material.texto ? `Material lido: ${material.texto.length} caracteres.` : `Sem arquivo; usando o tema "${material.tema}".`);

  const plano = await planejarAula(material, maxReels);
  console.log(`Aula: ${plano.titulo}`);
  plano.conceitos.forEach((c, i) => console.log(`  ${i + 1}. ${c.nome}`));

  const resultados = await Promise.all(
    plano.conceitos.map(async (_, i): Promise<Reel | null> => {
      let reel = await escreverReel(material, plano, i);
      let checagem = await checarReel(material, plano, i, reel);
      if (!checagem.aprovado) {
        console.log(`  Reel ${i + 1} reprovado na checagem, reescrevendo: ${checagem.problemas.join(" | ")}`);
        reel = await escreverReel(material, plano, i, checagem.problemas);
        checagem = await checarReel(material, plano, i, reel);
      }
      if (!checagem.aprovado) {
        console.log(`  Reel ${i + 1} descartado: ${checagem.problemas.join(" | ")}`);
        return null;
      }
      return reel;
    }),
  );

  const reels = resultados.filter((r): r is Reel => r !== null);
  if (reels.length === 0) throw new Error("Nenhum reel passou na checagem de fonte.");
  return { titulo: plano.titulo, reels };
}

const nomeAudio = (i: number) => `reel-${i + 1}.mp3`;

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
