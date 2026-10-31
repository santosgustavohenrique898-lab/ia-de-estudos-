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

const PAUSA_ENTRE_CENAS = 0.35;

export async function narrar(reel: Reel, caminhoAudio: string): Promise<Narracao> {
  const falas = reel.cenas.map((c) => c.fala.trim());
  const chave = process.env.ELEVENLABS_API_KEY;
  const palavras = chave
    ? await narrarElevenLabs(falas.join(" "), chave, caminhoAudio)
    : estimarTempos(falas.join(" "));

  // Divide as palavras entre as cenas pela contagem de palavras de cada fala.
  const cenas: Narracao["cenas"] = [];
  let i = 0;
  for (const fala of falas) {
    const n = contarPalavras(fala);
    const primeira = palavras[i];
    const ultima = palavras[Math.min(i + n, palavras.length) - 1];
    cenas.push({ inicio: primeira?.inicio ?? 0, fim: (ultima?.fim ?? 0) + PAUSA_ENTRE_CENAS });
    i += n;
  }
  for (let k = 1; k < cenas.length; k++) cenas[k].inicio = cenas[k - 1].fim;
  cenas[0].inicio = 0;

  return {
    audio: chave ? caminhoAudio : null,
    duracao: cenas[cenas.length - 1].fim + 0.5,
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
  const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voz}/with-timestamps`, {
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
