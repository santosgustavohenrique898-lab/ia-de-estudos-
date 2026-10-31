import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { Reel } from "../schema";
import type { Narracao } from "../pipeline/voz";
import { Legenda } from "./Legenda";
import { CenaVisual } from "./templates/CenaVisual";
import { QuizCard } from "./templates/QuizCard";
import { FONTE, FUNDO, TEXTO_SUAVE, destaque } from "./tema";

export type ReelProps = {
  reel: Reel;
  narracao: Narracao;
  numero: number;
  total: number;
  marca: string;
};

export const ReelVideo = ({ reel, narracao, numero, total, marca }: ReelProps) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const cor = destaque(numero);
  const fimNarracao = Math.round(narracao.duracao * fps);
  const t = frame / fps;

  return (
    <AbsoluteFill style={{ backgroundColor: FUNDO, fontFamily: FONTE, overflow: "hidden" }}>
      <Fundo cor={cor} />
      {narracao.audio && <Audio src={staticFile(narracao.audio)} />}

      <Cabecalho numero={numero} total={total} conceito={reel.conceito} cor={cor} />
      <Progresso cenas={narracao.cenas} duracao={narracao.duracao} t={t} cor={cor} />

      {reel.cenas.map((cena, i) => {
        const de = Math.round(narracao.cenas[i].inicio * fps);
        const ate = Math.round(narracao.cenas[i].fim * fps);
        return (
          <Sequence key={i} from={de} durationInFrames={Math.max(ate - de, 1)} layout="none">
            <CenaVisual cena={cena} cor={cor} />
          </Sequence>
        );
      })}

      {frame < fimNarracao && <Legenda palavras={narracao.palavras} t={t} cor={cor} />}

      <Sequence from={fimNarracao} layout="none">
        <QuizCard quiz={reel.quiz} cor={cor} />
      </Sequence>

      <div
        style={{
          position: "absolute",
          bottom: 60,
          width: "100%",
          textAlign: "center",
          color: TEXTO_SUAVE,
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: 2,
        }}
      >
        {marca}
      </div>
    </AbsoluteFill>
  );
};

const Fundo = ({ cor }: { cor: string }) => {
  const frame = useCurrentFrame();
  const x = 50 + 20 * Math.sin(frame / 90);
  const y = 35 + 10 * Math.cos(frame / 120);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${x}% ${y}%, ${cor}55 0%, transparent 55%), radial-gradient(circle at ${100 - x}% 90%, ${cor}22 0%, transparent 50%)`,
      }}
    />
  );
};

const Cabecalho = ({ numero, total, conceito, cor }: { numero: number; total: number; conceito: string; cor: string }) => (
  <div style={{ position: "absolute", top: 150, left: 80, right: 80, display: "flex", alignItems: "center", gap: 20 }}>
    <div
      style={{
        background: cor,
        color: "#0B1020",
        fontWeight: 800,
        fontSize: 30,
        borderRadius: 999,
        padding: "8px 22px",
      }}
    >
      {numero}/{total}
    </div>
    <div style={{ color: TEXTO_SUAVE, fontSize: 34, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      {conceito}
    </div>
  </div>
);

const Progresso = ({ cenas, duracao, t, cor }: { cenas: Narracao["cenas"]; duracao: number; t: number; cor: string }) => (
  <div style={{ position: "absolute", top: 90, left: 80, right: 80, display: "flex", gap: 10 }}>
    {cenas.map((c, i) => {
      const p = interpolate(t, [c.inicio, c.fim], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      return (
        <div key={i} style={{ flex: (c.fim - c.inicio) / duracao, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.18)" }}>
          <div style={{ width: `${p}%`, height: "100%", borderRadius: 4, background: cor }} />
        </div>
      );
    })}
  </div>
);
