import { writeFile } from "node:fs/promises";
import type { Reel } from "../schema.js";

export type Palavra = { texto: string; inicio: number; fim: number };

// Tempos em segundos. As cenas seguem o ritmo da voz: cada cena dura o tempo da sua fala.
export type Narracao = {
  audio: string | null;
  duracao: number;
  palavras: Palavra[];
  cenas: { inicio: number; fim: number }[];
};

// A cena troca um instante antes de a voz começar a fala dela, para a animação entrar junto com a voz.
const ANTECIPACAO = 0.15;

export async function narrar(reel: Reel, caminhoAudio: string): Promise<Narracao> {
  const falas = reel.cenas.map((c) => c.fala.trim());
  const texto = falas.join(" ");
  const chave = process.env.ELEVENLABS_API_KEY;
  let gravadas: Palavra[] | null = null;
  if (chave) {
    try {
      gravadas = await narrarElevenLabs(texto, chave, caminhoAudio);
    } catch (erro) {
      // Sem voz humana neste reel (créditos acabaram, chave ou voz errada): o reel não se perde,
      // segue com a voz do navegador.
      console.error("Voz humana falhou neste reel; usando a voz do navegador.", erro instanceof Error ? erro.message : erro);
    }
  }
  const palavras = gravadas ?? estimarTempos(texto);

  // Em que palavra começa e termina cada cena (pela contagem de palavras de cada fala).
  const faixas: { primeira: number; ultima: number }[] = [];
  let i = 0;
  for (const fala of falas) {
    const n = contarPalavras(fala);
    faixas.push({ primeira: Math.min(i, palavras.length - 1), ultima: Math.max(0, Math.min(i + n, palavras.length) - 1) });
    i += n;
  }
  const inicios = faixas.map((f, k) => {
    if (k === 0) return 0;
    const fimAnterior = palavras[faixas[k - 1].ultima]?.fim ?? 0;
    const comecoDaFala = palavras[f.primeira]?.inicio ?? fimAnterior;
    return Math.max(fimAnterior, comecoDaFala - ANTECIPACAO);
  });
  const fimDaFala = palavras[palavras.length - 1]?.fim ?? 0;
  const cenas = inicios.map((inicio, k) => ({ inicio, fim: k + 1 < inicios.length ? inicios[k + 1] : fimDaFala + 0.5 }));

  return {
    audio: gravadas ? caminhoAudio : null,
    duracao: fimDaFala + 0.5,
    palavras,
    cenas,
  };
}

function contarPalavras(texto: string): number {
  return texto.split(/\s+/).filter(Boolean).length;
}

// Sem chave de voz: estima o ritmo de fala (~2,6 palavras/s) para a legenda e as cenas.
function estimarTempos(texto: string): Palavra[] {
  const palavras: Palavra[] = [];
  let t = 0.2;
  for (const p of texto.split(/\s+/).filter(Boolean)) {
    const dur = 0.18 + p.length * 0.045;
    palavras.push({ texto: p, inicio: t, fim: t + dur });
    t += dur + (/[.!?]$/.test(p) ? 0.35 : /[,;:]$/.test(p) ? 0.15 : 0.03);
  }
  return palavras;
}

async function narrarElevenLabs(texto: string, chave: string, caminhoAudio: string): Promise<Palavra[]> {
  const voz = process.env.ELEVENLABS_VOICE_ID;
  if (!voz) throw new Error("Defina ELEVENLABS_VOICE_ID junto com ELEVENLABS_API_KEY.");
  const resp = await fetch(`${process.env.ELEVENLABS_API_URL ?? "https://api.elevenlabs.io"}/v1/text-to-speech/${voz}/with-timestamps`, {
    method: "POST",
    headers: { "xi-api-key": chave, "Content-Type": "application/json" },
    body: JSON.stringify({ text: texto, model_id: "eleven_multilingual_v2" }),
  });
  if (!resp.ok) throw new Error(`ElevenLabs respondeu ${resp.status}: ${await resp.text()}`);
  const dados = (await resp.json()) as {
    audio_base64: string;
    alignment: {
      characters: string[];
      character_start_times_seconds: number[];
      character_end_times_seconds: number[];
    };
  };
  await writeFile(caminhoAudio, Buffer.from(dados.audio_base64, "base64"));

  // Junta os tempos por caractere em tempos por palavra.
  const { characters, character_start_times_seconds: ini, character_end_times_seconds: fim } = dados.alignment;
  const palavras: Palavra[] = [];
  let atual: Palavra | null = null;
  characters.forEach((ch, k) => {
    if (/\s/.test(ch)) {
      if (atual) palavras.push(atual);
      atual = null;
    } else if (atual) {
      atual.texto += ch;
      atual.fim = fim[k];
    } else {
      atual = { texto: ch, inicio: ini[k], fim: fim[k] };
    }
  });
  if (atual) palavras.push(atual);
  return palavras;
}
