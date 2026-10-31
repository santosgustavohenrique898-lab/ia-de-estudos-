// Voz do protótipo: a síntese de fala do próprio navegador (grátis, sem servidor).
// No produto final entra a voz da ElevenLabs gerada no servidor.

const temVoz = typeof window !== "undefined" && "speechSynthesis" in window;

function escolherVoz(): SpeechSynthesisVoice | null {
  if (!temVoz) return null;
  const vozes = speechSynthesis.getVoices();
  const br = vozes.filter((v) => v.lang.replace("_", "-").toLowerCase() === "pt-br");
  const preferidas = ["Francisca", "Thalita", "Google", "Luciana", "Natural"];
  for (const nome of preferidas) {
    const v = br.find((x) => x.name.includes(nome));
    if (v) return v;
  }
  return br[0] ?? vozes.find((v) => v.lang.toLowerCase().startsWith("pt")) ?? null;
}

// Navegadores só liberam áudio depois de um toque; chame isto dentro de um clique.
export function destravarVoz() {
  if (!temVoz) return;
  speechSynthesis.getVoices();
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  speechSynthesis.speak(u);
}

export type OpcoesFala = {
  velocidade: number;
  mudo: boolean;
  aoPalavra: (indice: number) => void;
  aoFim: () => void;
};

// Fala o texto e avisa qual palavra está sendo dita, para a legenda acompanhar.
// Se o navegador não informar as palavras (ou estiver no mudo), estima o ritmo.
// Devolve uma função que interrompe a fala.
export function falar(texto: string, { velocidade, mudo, aoPalavra, aoFim }: OpcoesFala): () => void {
  const palavras = texto.split(/\s+/).filter(Boolean);
  const inicios: number[] = [];
  let pos = 0;
  for (const p of palavras) {
    pos = texto.indexOf(p, pos);
    inicios.push(pos);
    pos += p.length;
  }

  // Tempo estimado de cada palavra, em segundos (~2,6 palavras por segundo).
  const tempos: number[] = [];
  let t = 0;
  for (const p of palavras) {
    tempos.push(t);
    t += (0.2 + p.length * 0.045 + (/[.!?]$/.test(p) ? 0.3 : /[,;:]$/.test(p) ? 0.12 : 0)) / velocidade;
  }
  const duracaoEstimada = t;

  let encerrado = false;
  let recebeuPalavras = false;
  const comeco = performance.now();
  const terminar = () => {
    if (encerrado) return;
    encerrado = true;
    clearInterval(relogio);
    clearTimeout(seguranca);
    aoFim();
  };

  const relogio = window.setInterval(() => {
    if (recebeuPalavras) return;
    const s = (performance.now() - comeco) / 1000;
    let i = 0;
    while (i + 1 < tempos.length && tempos[i + 1] <= s) i++;
    aoPalavra(i);
  }, 60);

  let seguranca: number;
  const voz = escolherVoz();
  if (mudo || !temVoz || !voz) {
    seguranca = window.setTimeout(terminar, (duracaoEstimada + 0.4) * 1000);
  } else {
    const u = new SpeechSynthesisUtterance(texto);
    u.voice = voz;
    u.lang = voz.lang;
    u.rate = velocidade;
    u.onboundary = (e) => {
      if (e.name && e.name !== "word") return;
      recebeuPalavras = true;
      let i = 0;
      while (i + 1 < inicios.length && inicios[i + 1] <= e.charIndex) i++;
      aoPalavra(i);
    };
    u.onend = terminar;
    u.onerror = terminar;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    // Alguns navegadores às vezes não disparam onend; não deixa o reel travar.
    seguranca = window.setTimeout(terminar, (duracaoEstimada * 2.5 + 3) * 1000);
  }

  return () => {
    encerrado = true;
    clearInterval(relogio);
    clearTimeout(seguranca);
    if (temVoz) speechSynthesis.cancel();
  };
}

export const vozDisponivel = () => temVoz && escolherVoz() !== null;
