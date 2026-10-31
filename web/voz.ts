// Voz do navegador (grátis, sem servidor). É a voz usada dentro do Claude (Artifact) e
// quando o servidor não tem a chave da ElevenLabs; com a chave, os reels vêm com voz humana gravada.

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
  let seguranca = 0;
  let espera = 0;
  const comeco = performance.now();
  const terminar = () => {
    if (encerrado) return;
    encerrado = true;
    clearInterval(relogio);
    clearTimeout(seguranca);
    clearTimeout(espera);
    aoFim();
  };

  const relogio = window.setInterval(() => {
    if (recebeuPalavras) return;
    const s = (performance.now() - comeco) / 1000;
    let i = 0;
    while (i + 1 < tempos.length && tempos[i + 1] <= s) i++;
    aoPalavra(i);
  }, 60);

  // Sem fala de verdade (bloqueada, com defeito ou que nunca começou): a legenda e a troca de cena
  // seguem o tempo estimado das palavras, em vez de pular a cena.
  let estimando = false;
  const seguirNoRitmoEstimado = () => {
    if (encerrado || estimando) return;
    estimando = true;
    recebeuPalavras = false;
    clearTimeout(seguranca);
    const passou = (performance.now() - comeco) / 1000;
    seguranca = window.setTimeout(terminar, Math.max(0, duracaoEstimada + 0.4 - passou) * 1000);
  };

  const voz = escolherVoz();
  if (mudo || !temVoz || !voz) {
    seguranca = window.setTimeout(terminar, (duracaoEstimada + 0.4) * 1000);
  } else {
    const u = new SpeechSynthesisUtterance(texto);
    u.voice = voz;
    u.lang = voz.lang;
    u.rate = velocidade;
    let comecouAFalar = false;
    u.onstart = () => {
      comecouAFalar = true;
      clearTimeout(espera);
      if (estimando && !encerrado) {
        // Começou atrasada: volta a deixar a voz mandar no tempo.
        estimando = false;
        clearTimeout(seguranca);
        seguranca = window.setTimeout(terminar, (duracaoEstimada * 2.5 + 3) * 1000);
      }
    };
    u.onboundary = (e) => {
      if (e.name && e.name !== "word") return;
      recebeuPalavras = true;
      let i = 0;
      while (i + 1 < inicios.length && inicios[i + 1] <= e.charIndex) i++;
      aoPalavra(i);
    };
    u.onend = terminar;
    u.onerror = seguirNoRitmoEstimado;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    // Alguns navegadores às vezes não disparam onend; não deixa o reel travar.
    seguranca = window.setTimeout(terminar, (duracaoEstimada * 2.5 + 3) * 1000);
    // Se a fala não começar em 3 segundos, segue no ritmo estimado.
    espera = window.setTimeout(() => {
      if (!comecouAFalar) seguirNoRitmoEstimado();
    }, 3000);
  }

  return () => {
    encerrado = true;
    clearInterval(relogio);
    clearTimeout(seguranca);
    clearTimeout(espera);
    if (temVoz) speechSynthesis.cancel();
  };
}

export const vozDisponivel = () => temVoz && escolherVoz() !== null;
