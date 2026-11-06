import { useEffect, useRef, useState } from "react";
import type { Questao } from "./progresso";

const LETRAS = ["A", "B", "C", "D", "E"];

type Props = {
  questao: Questao;
  etiqueta: string;
  conceito?: string;
  cor: string;
  // Frase de fixação do reel, mostrada depois da resposta (na revisão).
  lembrete?: string;
  // Na revisão: quando essa pergunta volta.
  nota?: string | null;
  textoContinuar?: string;
  aoResponder: (acertou: boolean, escolha: number) => void;
  aoContinuar: () => void;
};

// Questão completa, para o simulado e a revisão: texto-base, 4 ou 5 alternativas e, depois da resposta,
// por que cada alternativa está certa ou errada. Rola por dentro quando o texto é longo.
export const Pergunta = ({ questao, etiqueta, conceito, cor, lembrete, nota, textoContinuar = "Continuar ↑", aoResponder, aoContinuar }: Props) => {
  const [escolha, setEscolha] = useState<number | null>(null);
  const rolagem = useRef<HTMLDivElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const respondeu = escolha !== null;
  const acertou = escolha === questao.correta;

  // Depois de responder, traz a explicação para a tela.
  useEffect(() => {
    const r = rolagem.current;
    const f = feedback.current;
    if (!respondeu || !r || !f) return;
    const alvo = f.offsetTop + f.offsetHeight - r.clientHeight + 24;
    if (alvo > r.scrollTop) r.scrollTo({ top: alvo, behavior: "smooth" });
  }, [respondeu]);

  const escolher = (i: number) => {
    if (respondeu) return;
    setEscolha(i);
    aoResponder(i === questao.correta, i);
  };

  return (
    <div className={respondeu && !acertou ? "pergunta tremer" : "pergunta"} style={{ ["--cor" as string]: cor }}>
      <div className="pergunta-rolagem" ref={rolagem}>
        <div className="quiz-topo">
          <span className="quiz-etiqueta">{etiqueta}</span>
          {conceito && <span className="quiz-conceito">{conceito}</span>}
        </div>
        {questao.textoBase && <div className="texto-base">{questao.textoBase}</div>}
        <h2 className="pergunta-enunciado">{questao.pergunta}</h2>

        <div className="alternativas">
          {questao.alternativas.map((alt, i) => {
            const classe = !respondeu ? "" : i === questao.correta ? " certa" : i === escolha ? " errada" : " apagada";
            return (
              <div key={i} className="alternativa-bloco">
                <button className={`alternativa${classe}`} onClick={() => escolher(i)} disabled={respondeu}>
                  <span className="letra">{LETRAS[i]}</span>
                  {alt}
                </button>
                {respondeu && questao.porQue?.[i] && (
                  <p className={i === questao.correta ? "por-que certa" : i === escolha ? "por-que errada" : "por-que"}>{questao.porQue[i]}</p>
                )}
              </div>
            );
          })}
        </div>

        {respondeu && (
          <div className="feedback" ref={feedback}>
            <div className={acertou ? "feedback-titulo certo" : "feedback-titulo errado"}>
              {acertou ? "Mandou bem! ✅" : `Quase! A certa é a ${LETRAS[questao.correta]}.`}
            </div>
            <p className="nota-revisao">{nota ?? (acertou ? "Ponto para você no simulado." : "Essa pergunta volta amanhã na sua revisão.")}</p>
            {questao.explicacao && <p>{questao.explicacao}</p>}
            {lembrete && (
              <p className="lembrete">
                <b>Para lembrar:</b> {lembrete}
              </p>
            )}
            <button className="botao-principal" onClick={aoContinuar}>
              {textoContinuar}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
