import { useState } from "react";
import { destaque } from "../src/remotion/tema";
import type { ReelPronto } from "./api";
import { lembreteDoReel } from "./Feed";
import { capaDoReel, emojiDoReel } from "./resultado";

export type CapaDoReel = {
  pronto: ReelPronto;
  // Posição do reel na aula, a partir de 0.
  indice: number;
  curtido: boolean;
  errou: boolean;
};

// A capa de cada reel da aula, como num app de vídeos: emoji, a frase de abertura e o nome do conceito.
// Toque vira o cartão e mostra o que levar para a prova (tentar lembrar antes de virar fixa mais).
// O ▶ toca o reel de novo ali mesmo.
export const CapasDosReels = ({ vistas, naoVistas, aoAssistir }: { vistas: CapaDoReel[]; naoVistas: CapaDoReel[]; aoAssistir: (indice: number) => void }) => (
  <section className="resultado-cartao capas-cartao">
    {vistas.length > 0 && (
      <div className="aprendi">
        <div className="secao-topo">
          <h3>🧠 O que você aprendeu</h3>
          <p>Tente lembrar o que cai na prova e toque no cartão para conferir.</p>
        </div>
        <div className="capas">
          {vistas.map((c) => (
            <Capa key={c.indice} capa={c} aoAssistir={() => aoAssistir(c.indice)} />
          ))}
        </div>
      </div>
    )}
    {naoVistas.length > 0 && (
      <div className="aprendi faltou">
        <div className="secao-topo">
          <h3>👀 Você ainda não viu</h3>
          <p>{naoVistas.length === 1 ? "Esse reel ficou para trás. Assista agora, leva um minuto." : "Esses reels ficaram para trás. Assista agora, cada um leva um minuto."}</p>
        </div>
        <div className="capas">
          {naoVistas.map((c) => (
            <button
              key={c.indice}
              className="capa aprendi-item nao-vista"
              style={{ ["--cor" as string]: destaque(c.indice + 1) }}
              onClick={() => aoAssistir(c.indice)}
            >
              <Frente capa={c} />
              <span className="capa-assistir">▶ Assistir agora</span>
            </button>
          ))}
        </div>
      </div>
    )}
  </section>
);

const Frente = ({ capa }: { capa: CapaDoReel }) => {
  const emoji = emojiDoReel(capa.pronto.reel);
  return (
    <>
      <span className="capa-numero">
        REEL {capa.indice + 1}
        {capa.curtido && (
          <span className="capa-curtido" aria-label="curtido">
            ❤
          </span>
        )}
      </span>
      {emoji && <span className="capa-emoji">{emoji}</span>}
      <span className={emoji ? "capa-titulo" : "capa-titulo grande"}>{capaDoReel(capa.pronto.reel)}</span>
      <b className="capa-conceito">{capa.pronto.reel.conceito}</b>
    </>
  );
};

const Capa = ({ capa, aoAssistir }: { capa: CapaDoReel; aoAssistir: () => void }) => {
  const [virada, setVirada] = useState(false);
  const frase = lembreteDoReel(capa.pronto);
  return (
    <div className={virada ? "capa aprendi-item virada" : "capa aprendi-item"} style={{ ["--cor" as string]: destaque(capa.indice + 1) }}>
      <div className="capa-giro">
        <button
          className="capa-frente"
          onClick={() => setVirada(true)}
          tabIndex={virada ? -1 : 0}
          aria-hidden={virada}
          aria-label={`${capa.pronto.reel.conceito}: virar o cartão`}
        >
          <Frente capa={capa} />
          {capa.errou && <span className="capa-selo">revisar</span>}
          <span className="capa-dica">↻ toque para virar</span>
        </button>
        <div className="capa-verso" aria-hidden={!virada}>
          <span className="capa-rotulo">Leve para a prova</span>
          <p>{frase ?? capa.pronto.reel.quiz.explicacao}</p>
          <button className="capa-rever" onClick={aoAssistir} tabIndex={virada ? 0 : -1}>
            ▶ Rever o reel
          </button>
          <button className="capa-voltar" onClick={() => setVirada(false)} tabIndex={virada ? 0 : -1}>
            ↻ Virar de volta
          </button>
        </div>
      </div>
      <button className="capa-play" onClick={aoAssistir} tabIndex={virada ? -1 : 0} aria-label={`Assistir o reel ${capa.pronto.reel.conceito}`}>
        ▶
      </button>
    </div>
  );
};
