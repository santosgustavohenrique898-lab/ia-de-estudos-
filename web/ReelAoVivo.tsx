import { useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { CenaVisual } from "../src/remotion/templates/CenaVisual";
import type { Reel } from "../src/schema";
import type { Narracao } from "../src/pipeline/voz";
import { falar, vozDisponivel } from "./voz";
import { urlAudio } from "./api";

const MAX_POR_BLOCO = 4;

// O aviso de "sem voz" aparece uma vez só por visita.
let avisouSemVoz = false;

type Props = {
  reel: Reel;
  narracao: Narracao;
  numero: number;
  total: number;
  cor: string;
  ativo: boolean;
  mudo: boolean;
  velocidade: number;
  curtido: boolean;
  salvo: boolean;
  aoCurtir: (forcar: boolean) => void;
  aoSalvar: () => void;
  aoMudo: () => void;
  aoVelocidade: () => void;
  aoTerminar: () => void;
};

// Reel tocado ao vivo no navegador: a animação vem dos mesmos templates do vídeo exportado
// e a legenda acompanha a palavra dita. A voz é a gravação humana feita no servidor (ElevenLabs);
// sem ela (dentro do Claude ou sem a chave), o navegador fala cena a cena.
export const ReelAoVivo = (p: Props) => {
  const { reel, narracao, cor, ativo } = p;
  const audio = useMemo(() => (narracao.audio ? new Audio(urlAudio(narracao.audio)) : null), [narracao.audio]);
  // Em que palavra da fala completa começa cada cena (a gravação é uma só para o reel inteiro).
  const inicioPalavras = useMemo(() => {
    let n = 0;
    return reel.cenas.map((c) => {
      const inicio = n;
      n += c.fala.split(/\s+/).filter(Boolean).length;
      return inicio;
    });
  }, [reel]);
  const [cena, setCena] = useState(0);
  const [palavra, setPalavra] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [terminou, setTerminou] = useState(false);
  const [devagar, setDevagar] = useState(false);
  const [rodada, setRodada] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const [coracao, setCoracao] = useState(0);
  const player = useRef<PlayerRef>(null);
  const ultimoToque = useRef(0);
  const toqueSimples = useRef<number>(0);

  // Sempre que o reel volta para a tela, começa do início.
  useEffect(() => {
    if (ativo) {
      if (audio) audio.currentTime = 0;
      setCena(0);
      setPalavra(0);
      setTerminou(false);
      setPausado(false);
      setRodada((r) => r + 1);
    }
  }, [ativo]);

  // Modo voz humana: o áudio manda, e cena e palavra são lidas do tempo atual da gravação.
  useEffect(() => {
    if (!audio) return;
    audio.muted = p.mudo;
    audio.playbackRate = p.velocidade * (devagar ? 0.85 : 1);
    if (!ativo || pausado || terminou) {
      audio.pause();
      return;
    }
    // Navegador bloqueou o som sem toque: mostra o botão de play. Interrupções por pause() são normais.
    audio.play().catch((e: DOMException) => e.name === "NotAllowedError" && setPausado(true));
    let quadro = 0;
    const acompanhar = () => {
      const t = audio.currentTime;
      let c = 0;
      while (c + 1 < narracao.cenas.length && narracao.cenas[c + 1].inicio <= t) c++;
      let w = 0;
      while (w + 1 < narracao.palavras.length && narracao.palavras[w + 1].inicio <= t) w++;
      setCena(c);
      setPalavra(Math.max(0, w - inicioPalavras[c]));
      quadro = requestAnimationFrame(acompanhar);
    };
    quadro = requestAnimationFrame(acompanhar);
    const fim = () => {
      setTerminou(true);
      p.aoTerminar();
    };
    audio.addEventListener("ended", fim);
    return () => {
      cancelAnimationFrame(quadro);
      audio.removeEventListener("ended", fim);
      audio.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio, ativo, pausado, terminou, p.mudo, p.velocidade, devagar, rodada]);

  // Modo voz do navegador: fala cena por cena.
  useEffect(() => {
    if (audio || !ativo || pausado || terminou) return;
    setPalavra(0);
    return falar(reel.cenas[cena].fala, {
      velocidade: p.velocidade * (devagar ? 0.85 : 1),
      mudo: p.mudo,
      aoPalavra: setPalavra,
      aoFim: () => {
        if (cena + 1 < reel.cenas.length) setCena(cena + 1);
        else {
          setTerminou(true);
          p.aoTerminar();
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, cena, pausado, terminou, p.mudo, p.velocidade, devagar, rodada]);

  useEffect(() => {
    if (pausado) player.current?.pause();
    else player.current?.play();
  }, [pausado]);

  const mostrarAviso = (texto: string) => {
    setAviso(texto);
    setTimeout(() => setAviso(null), 2600);
  };

  // Alguns navegadores (como o de dentro de certos apps) não têm voz em português: avisa em vez de ficar mudo sem explicação.
  useEffect(() => {
    if (!ativo || audio || p.mudo || avisouSemVoz || vozDisponivel()) return;
    avisouSemVoz = true;
    setAviso("Este navegador não tem voz em português. Abra o link no Chrome ou no Safari para ouvir a narração.");
    setTimeout(() => setAviso(null), 6000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  // Um toque pausa; dois toques rápidos curtem, como nos apps de vídeo.
  const tocar = () => {
    const agora = Date.now();
    if (agora - ultimoToque.current < 280) {
      clearTimeout(toqueSimples.current);
      p.aoCurtir(true);
      setCoracao((c) => c + 1);
    } else {
      toqueSimples.current = window.setTimeout(() => {
        if (terminou) {
          if (audio) audio.currentTime = 0;
          setTerminou(false);
          setCena(0);
          setRodada((r) => r + 1);
        } else setPausado((x) => !x);
      }, 280);
    }
    ultimoToque.current = agora;
  };

  const naoEntendi = () => {
    if (audio) audio.currentTime = narracao.cenas[cena].inicio;
    setDevagar(true);
    setTerminou(false);
    setPausado(false);
    setRodada((r) => r + 1);
    mostrarAviso("Beleza, vou repetir essa parte mais devagar.");
  };

  const fala = reel.cenas[cena].fala.split(/\s+/).filter(Boolean);
  const blocoInicio = blocoDe(fala, palavra);
  const bloco = fala.slice(blocoInicio, blocoFim(fala, blocoInicio));

  return (
    <div className="reel" style={{ ["--cor" as string]: cor }}>
      <div className="reel-fundo" />
      <div className="reel-palco" onClick={tocar}>
        <Player
          key={`${cena}-${rodada}`}
          ref={player}
          component={CenaVisual}
          inputProps={{ cena: reel.cenas[cena], cor }}
          durationInFrames={900}
          fps={30}
          compositionWidth={1080}
          compositionHeight={1920}
          style={{ width: "100%", height: "100%" }}
          autoPlay={ativo}
          controls={false}
          acknowledgeRemotionLicense
        />
      </div>

      <div className="reel-topo">
        <div className="segmentos">
          {reel.cenas.map((c, i) => {
            const total = c.fala.split(/\s+/).filter(Boolean).length;
            const pct = i < cena || terminou ? 100 : i === cena ? ((palavra + 1) / total) * 100 : 0;
            return (
              <div key={i} className="segmento">
                <div style={{ width: `${pct}%` }} />
              </div>
            );
          })}
        </div>
        <div className="reel-titulo">
          <span className="reel-num">
            {p.numero}/{p.total}
          </span>
          {reel.conceito}
        </div>
      </div>

      {ativo && !terminou && (
        <div className="legenda" key={`${cena}-${blocoInicio}`}>
          {bloco.map((w, k) => (
            <span key={k} className={blocoInicio + k === palavra ? "palavra ativa" : "palavra"}>
              {w}
            </span>
          ))}
        </div>
      )}

      {pausado && <div className="icone-pausa">▶</div>}
      {terminou && <div className="repetir">↻ toque para ver de novo · role para a pergunta ↑</div>}
      {coracao > 0 && (
        <div key={coracao} className="coracao-explode">
          ❤
        </div>
      )}
      {aviso && <div className="aviso">{aviso}</div>}

      <div className="trilho">
        <BotaoTrilho icone={p.curtido ? "❤️" : "🤍"} rotulo={p.curtido ? "Curtido" : "Curtir"} ativo={p.curtido} aoClicar={() => p.aoCurtir(false)} />
        <BotaoTrilho icone="🤔" rotulo="Não entendi" aoClicar={naoEntendi} />
        <BotaoTrilho
          icone={p.salvo ? "📌" : "🔖"}
          rotulo={p.salvo ? "Salvo" : "Revisar"}
          ativo={p.salvo}
          aoClicar={() => {
            if (!p.salvo) mostrarAviso("Salvo! Esse reel volta na sua revisão.");
            p.aoSalvar();
          }}
        />
        <BotaoTrilho icone={p.mudo ? "🔇" : "🔊"} rotulo={p.mudo ? "Mudo" : "Som"} aoClicar={p.aoMudo} />
        <BotaoTrilho icone={`${p.velocidade}x`} rotulo="Velocidade" texto aoClicar={p.aoVelocidade} />
      </div>
    </div>
  );
};

const BotaoTrilho = ({ icone, rotulo, ativo, texto, aoClicar }: { icone: string; rotulo: string; ativo?: boolean; texto?: boolean; aoClicar: () => void }) => (
  <button
    className={ativo ? "trilho-botao ativo" : "trilho-botao"}
    onClick={(e) => {
      e.stopPropagation();
      aoClicar();
    }}
  >
    <span className={texto ? "trilho-icone texto" : "trilho-icone"}>{icone}</span>
    <span className="trilho-rotulo">{rotulo}</span>
  </button>
);

// Blocos de legenda: até 4 palavras, quebrando no fim de frase.
function blocoDe(palavras: string[], indice: number): number {
  let inicio = 0;
  while (true) {
    const fim = blocoFim(palavras, inicio);
    if (indice < fim || fim >= palavras.length) return inicio;
    inicio = fim;
  }
}

function blocoFim(palavras: string[], inicio: number): number {
  let i = inicio;
  while (i < palavras.length) {
    i++;
    if (i - inicio >= MAX_POR_BLOCO || /[.!?,;:]$/.test(palavras[i - 1])) break;
  }
  return i;
}
