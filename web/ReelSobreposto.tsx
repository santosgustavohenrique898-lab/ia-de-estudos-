import { useEffect, useRef, useState } from "react";
import { destaque } from "../src/remotion/tema";
import type { AulaAtual } from "./main";
import { MODO_ARTEFATO, type ReelPronto } from "./api";
import { ReelAoVivo } from "./ReelAoVivo";
import { cartaoDoReel } from "./Feed";
import { chaveDoReel, curtirReel, desmarcarRevisao, marcarParaRevisar, useProgresso } from "./progresso";

const VELOCIDADES = [1, 1.25, 1.5];

// Um reel da aula tocado por cima do resultado ("Rever o reel"), com curtir, revisar e "Não entendi".
// Fecha no ✕, tocando fora ou com Esc, e volta para o mesmo ponto do resultado.
export const ReelSobreposto = ({
  aula,
  tituloDaAula,
  pronto,
  indice,
  total,
  aoTerminar,
  aoFechar,
}: {
  aula: AulaAtual;
  tituloDaAula: string;
  pronto: ReelPronto;
  // Posição do reel entre os reels prontos da aula, a partir de 0.
  indice: number;
  total: number;
  aoTerminar: () => void;
  aoFechar: () => void;
}) => {
  const progresso = useProgresso();
  const [mudo, setMudo] = useState(false);
  const [velocidade, setVelocidade] = useState(1);
  const cartao = cartaoDoReel(aula, tituloDaAula, indice, pronto);
  const salvo = progresso.cartoes.some((c) => c.id === cartao.id && !c.dominado);
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar.current();
    window.addEventListener("keydown", tecla);
    // A página de trás não rola enquanto o reel está aberto.
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = antes;
    };
  }, []);

  return (
    <div className="sobreposto" role="dialog" aria-modal="true" aria-label={`Reel: ${pronto.reel.conceito}`} onClick={aoFechar}>
      <div className="sobreposto-moldura" onClick={(e) => e.stopPropagation()}>
        <ReelAoVivo
          reel={pronto.reel}
          narracao={pronto.narracao}
          numero={indice + 1}
          total={total}
          cor={destaque(indice + 1)}
          ativo
          mudo={mudo}
          velocidade={velocidade}
          curtido={progresso.curtidas.includes(chaveDoReel(aula.id, indice))}
          salvo={salvo}
          objetivo={aula.objetivo}
          podeExplicar={MODO_ARTEFATO}
          aoCurtir={(so) => curtirReel(chaveDoReel(aula.id, indice), so)}
          aoSalvar={() => (salvo ? desmarcarRevisao(cartao.id) : marcarParaRevisar(cartao))}
          aoNaoEntendi={() => marcarParaRevisar(cartao)}
          aoMudo={() => setMudo((m) => !m)}
          aoVelocidade={() => setVelocidade((v) => VELOCIDADES[(VELOCIDADES.indexOf(v) + 1) % VELOCIDADES.length])}
          aoTerminar={aoTerminar}
          textoFim="↻ toque para ver de novo"
        />
        <button className="sobreposto-fechar" onClick={aoFechar}>
          ✕ Voltar ao resultado
        </button>
      </div>
    </div>
  );
};
