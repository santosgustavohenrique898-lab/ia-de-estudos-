import { useEffect, useState } from "react";
import type { Reel } from "../src/schema";
import { falar } from "./voz";

const LETRAS = ["A", "B", "C", "D"];
const CORES_CONFETE = ["#8B6CFF", "#00C2A8", "#FF8A3D", "#3DA5FF", "#FF5C8A", "#2BD47D"];

type Props = {
  quiz: Reel["quiz"];
  conceito: string;
  cor: string;
  ativo: boolean;
  mudo: boolean;
  // Sem voz humana gravada para o reel, a pergunta é lida pela voz do navegador.
  falarEmVoz: boolean;
  sequencia: number;
  aoResponder: (acertou: boolean) => void;
  aoContinuar: () => void;
};

export const QuizAoVivo = ({ quiz, conceito, cor, ativo, mudo, falarEmVoz, sequencia, aoResponder, aoContinuar }: Props) => {
  const [escolha, setEscolha] = useState<number | null>(null);
  const [lida, setLida] = useState(false);
  const respondeu = escolha !== null;
  const acertou = escolha === quiz.correta;

  // Lê a pergunta em voz alta na primeira vez que o card aparece.
  useEffect(() => {
    if (!ativo || lida || respondeu || !falarEmVoz) return;
    setLida(true);
    return falar(quiz.pergunta, { velocidade: 1, mudo, aoPalavra: () => {}, aoFim: () => {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  const escolher = (i: number) => {
    if (respondeu) return;
    setEscolha(i);
    const certo = i === quiz.correta;
    aoResponder(certo);
    if (falarEmVoz) falar(`${certo ? "Mandou bem!" : "Quase!"} ${quiz.explicacao}`, { velocidade: 1.05, mudo, aoPalavra: () => {}, aoFim: () => {} });
  };

  return (
    <div className={respondeu && !acertou ? "quiz tremer" : "quiz"} style={{ ["--cor" as string]: cor }}>
      <div className="quiz-topo">
        <span className="quiz-etiqueta">PERGUNTA RÁPIDA</span>
        <span className="quiz-conceito">{conceito}</span>
      </div>
      <h2 className="quiz-pergunta">{quiz.pergunta}</h2>

      <div className="alternativas">
        {quiz.alternativas.map((alt, i) => {
          const classe = !respondeu ? "" : i === quiz.correta ? " certa" : i === escolha ? " errada" : " apagada";
          return (
            <button key={i} className={`alternativa${classe}`} onClick={() => escolher(i)} disabled={respondeu}>
              <span className="letra">{LETRAS[i]}</span>
              {alt}
            </button>
          );
        })}
      </div>

      {respondeu && (
        <div className="feedback">
          <div className={acertou ? "feedback-titulo certo" : "feedback-titulo errado"}>
            {acertou ? (sequencia >= 2 ? `Mandou bem! ${sequencia} seguidas 🔥` : "Mandou bem! ✅") : "Quase! Esse volta na sua revisão"}
          </div>
          <p>{quiz.explicacao}</p>
          <button className="botao-principal" onClick={aoContinuar}>
            Continuar ↑
          </button>
        </div>
      )}

      {respondeu && acertou && (
        <div className="confete" aria-hidden>
          {Array.from({ length: 36 }, (_, k) => (
            <i
              key={k}
              style={{
                left: `${(k * 37) % 100}%`,
                background: CORES_CONFETE[k % CORES_CONFETE.length],
                animationDelay: `${(k % 9) * 0.04}s`,
                ["--giro" as string]: `${(k % 2 ? 1 : -1) * (180 + k * 20)}deg`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
