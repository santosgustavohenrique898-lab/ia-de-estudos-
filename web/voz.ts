// Voz do navegador (grátis, sem servidor). É a voz usada dentro do Claude (Artifact) e
// quando o servidor não tem a chave da ElevenLabs; com a chave, os reels vêm com voz humana gravada.

const temVoz = typeof window !== "undefined" && "speechSynthesis" in window;

// Nota de cada voz: as neurais do Edge ("Online (Natural)") e as baixadas da Apple ("Premium",
// "Enhanced", "Melhorada") soam quase humanas; a do Google vem logo depois; as compactas por último.
function nota(v: SpeechSynthesisVoice): number {
  const nome = v.name.toLowerCase();
  let n = 0;
  if (/natural|neural|online/.test(nome)) n += 40;
  if (/premium|enhanced|melhorad|aprimorad|alta qualidade/.test(nome)) n += 30;
  if (/google/.test(nome)) n += 20;
  if (/francisca|thalita|antonio|luciana|felipe|fernanda/.test(nome)) n += 5;
  return n;
}

function escolherVoz(): SpeechSynthesisVoice | null {
  if (!temVoz) return null;
  const vozes = speechSynthesis.getVoices();
  const br = vozes.filter((v) => v.lang.replace("_", "-").toLowerCase() === "pt-br").sort((a, b) => nota(b) - nota(a));
  return br[0] ?? vozes.find((v) => v.lang.toLowerCase().startsWith("pt")) ?? null;
}

// Quanto a voz escolhida demora de verdade em relação à nossa estimativa. Serve para as vozes que
// não avisam qual palavra estão dizendo (como a do Google no Chrome): depois da primeira cena,
// a legenda passa a andar no ritmo real daquela voz.
const ritmoDaVoz = new Map<string, number>();

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
  const voz = escolherVoz();
  const ritmo = (voz && !mudo && ritmoDaVoz.get(voz.name)) || 1;
  for (let k = 0; k < tempos.length; k++) tempos[k] *= ritmo;
  const duracaoEstimada = t * ritmo;

  let encerrado = false;
  let recebeuPalavras = false;
  let seguranca = 0;
  let espera = 0;
  // Relógio da legenda: começa quando a voz começa de fato (ou já, se não houver voz).
  let comeco = performance.now();
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

  if (mudo || !temVoz || !voz) {
    seguranca = window.setTimeout(terminar, (duracaoEstimada + 0.4) * 1000);
  } else {
    const u = new SpeechSynthesisUtterance(texto);
    u.voice = voz;
    u.lang = voz.lang;
    u.rate = velocidade;
    let comecouAFalar = false;
    let inicioDaFala = 0;
    u.onstart = () => {
      comecouAFalar = true;
      inicioDaFala = performance.now();
      comeco = inicioDaFala;
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
    u.onend = () => {
      // Aprende o ritmo real desta voz para as próximas cenas (só quando a fala correu inteira).
      if (comecouAFalar && !recebeuPalavras && !estimando && !encerrado && duracaoEstimada > 1.5) {
        const real = (performance.now() - inicioDaFala) / 1000;
        const novo = Math.min(2, Math.max(0.5, (real / duracaoEstimada) * ritmo));
        const antigo = ritmoDaVoz.get(voz.name);
        ritmoDaVoz.set(voz.name, antigo ? antigo * 0.5 + novo * 0.5 : novo);
      }
      terminar();
    };
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
