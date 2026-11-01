import { useEffect, useState } from "react";
import { Player } from "@remotion/player";
import { CenaVisual } from "../src/remotion/templates/CenaVisual";
import type { Cena, Reel } from "../src/schema";
import type { Objetivo } from "../src/pipeline/estilo";
import { explicarDeOutroJeito, mensagemDaExplicacao } from "./artefato";
import { falar } from "./voz";
import { blocoDe, blocoFim } from "./legenda";
import { Nucleo } from "./Efeitos3D";

type Props = {
  reel: Reel;
  cena: number;
  objetivo: Objetivo;
  cor: string;
  mudo: boolean;
  velocidade: number;
  aoFechar: () => void;
};

// "Não entendi": o Claude escreve na hora uma explicação nova, mais simples e com uma analogia,
// e ela toca como um mini-reel por cima do reel original. A primeira cena começa assim que fica pronta.
export const Explicacao = ({ reel, cena, objetivo, cor, mudo, velocidade, aoFechar }: Props) => {
  const [rodada, setRodada] = useState(0);
  const [cenas, setCenas] = useState<Cena[]>([]);
  const [escrita, setEscrita] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [atual, setAtual] = useState(0);
  const [palavra, setPalavra] = useState(0);

  useEffect(() => {
    const controle = new AbortController();
    setCenas([]);
    setEscrita(false);
    setErro(null);
    setAtual(0);
    setPalavra(0);
    explicarDeOutroJeito({ reel, cena, objetivo, deNovo: rodada > 0 }, (c) => setCenas((cs) => (cs.length < 4 ? [...cs, c] : cs)), controle.signal)
      .then(() => setEscrita(true))
      .catch((e) => {
        if (!controle.signal.aborted) setErro(mensagemDaExplicacao(e));
      });
    return () => controle.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodada]);

  // Fala a cena atual; quando acaba, passa para a próxima (ou espera ela chegar).
  const disponivel = atual < cenas.length;
  useEffect(() => {
    if (!disponivel) return;
    setPalavra(0);
    return falar(cenas[atual].fala, { velocidade, mudo, aoPalavra: setPalavra, aoFim: () => setAtual((a) => a + 1) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual, disponivel, rodada]);

  const acabou = escrita && atual >= cenas.length;
  const falhou = erro !== null || (escrita && cenas.length === 0);
  const visivel = cenas[Math.min(atual, cenas.length - 1)];
  const fala = disponivel ? cenas[atual].fala.split(/\s+/).filter(Boolean) : [];
  const blocoInicio = blocoDe(fala, palavra);
  const bloco = fala.slice(blocoInicio, blocoFim(fala, blocoInicio));

  return (
    <div className="explicacao" style={{ ["--cor" as string]: cor }} onClick={(e) => e.stopPropagation()}>
      <div className="explicacao-topo">
        <span>🤔 Explicando de outro jeito</span>
        <button className="explicacao-voltar" onClick={aoFechar}>
          ↩ Voltar ao reel
        </button>
      </div>

      {visivel && !falhou && (
        <div className="reel-palco">
          <Player
            key={`${rodada}-${Math.min(atual, cenas.length - 1)}`}
            component={CenaVisual}
            inputProps={{ cena: visivel, cor }}
            durationInFrames={900}
            fps={30}
            compositionWidth={1080}
            compositionHeight={1920}
            style={{ width: "100%", height: "100%" }}
            autoPlay
            controls={false}
            acknowledgeRemotionLicense
          />
        </div>
      )}

      {cenas.length === 0 && !falhou && (
        <div className="explicacao-centro">
          <Nucleo />
          <h2>Pensando num jeito mais simples de explicar</h2>
          <p>Leva só alguns segundos. Essa parte também entrou na sua revisão de amanhã.</p>
        </div>
      )}

      {disponivel && (
        <div className="legenda" key={`${atual}-${blocoInicio}`}>
          {bloco.map((w, k) => (
            <span key={k} className={blocoInicio + k === palavra ? "palavra ativa" : "palavra"}>
              {w}
            </span>
          ))}
        </div>
      )}

      {!disponivel && !acabou && cenas.length > 0 && !falhou && <div className="explicacao-esperando">escrevendo a próxima parte…</div>}

      {(acabou || falhou) && (
        <div className="explicacao-fim">
          {falhou ? <p>{erro ?? "Não consegui explicar agora. Tente de novo."}</p> : <p>Fez sentido agora?</p>}
          <button className="botao-principal" onClick={aoFechar}>
            {falhou ? "Voltar ao reel" : "Entendi! Voltar ao reel"}
          </button>
          <button className="botao-secundario" onClick={() => setRodada((r) => r + 1)}>
            {falhou ? "Tentar de novo" : "Explicar de outro jeito"}
          </button>
        </div>
      )}
    </div>
  );
};
