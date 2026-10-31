import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Reel } from "../../schema";
import { BORDA, CERTO, SOMBRA, SUPERFICIE, TEXTO, TEXTO_SUAVE } from "../tema";

const LETRAS = ["A", "B", "C", "D"];

// No vídeo exportado o quiz aparece e a resposta é revelada sozinha.
// No app, este mesmo quiz vira um card interativo entre os reels.
export const QuizCard = ({ quiz, cor }: { quiz: Reel["quiz"]; cor: string }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrada = spring({ frame, fps, config: { damping: 15 } });
  const revelar = frame >= fps * 3;

  return (
    <div
      style={{
        position: "absolute",
        top: 300,
        left: 80,
        right: 80,
        color: TEXTO,
        opacity: entrada,
        transform: `scale(${0.92 + 0.08 * entrada})`,
      }}
    >
      <div style={{ fontSize: 40, fontWeight: 800, color: cor, letterSpacing: 4, marginBottom: 28 }}>PERGUNTA RÁPIDA</div>
      <div style={{ fontSize: 58, fontWeight: 900, lineHeight: 1.15, marginBottom: 48 }}>{quiz.pergunta}</div>
      {quiz.alternativas.map((alt, i) => {
        const certa = revelar && i === quiz.correta;
        const apagada = revelar && i !== quiz.correta;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 26,
              padding: "26px 30px",
              marginBottom: 22,
              borderRadius: 26,
              border: `4px solid ${certa ? CERTO : BORDA}`,
              background: certa ? `${CERTO}1A` : SUPERFICIE,
              boxShadow: SOMBRA,
              opacity: apagada ? 0.4 : 1,
            }}
          >
            <div style={{ fontSize: 40, fontWeight: 900, color: certa ? CERTO : cor }}>{LETRAS[i]}</div>
            <div style={{ fontSize: 42, fontWeight: 600, lineHeight: 1.2 }}>{alt}</div>
          </div>
        );
      })}
      {revelar && <div style={{ fontSize: 38, color: TEXTO_SUAVE, lineHeight: 1.3, marginTop: 24 }}>{quiz.explicacao}</div>}
    </div>
  );
};
