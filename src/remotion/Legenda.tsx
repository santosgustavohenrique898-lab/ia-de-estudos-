import type { Palavra } from "../pipeline/voz";
import { TEXTO } from "./tema";

const MAX_POR_BLOCO = 4;

// Agrupa as palavras em blocos curtos, quebrando no fim de frase, como legenda de reels.
function blocos(palavras: Palavra[]): Palavra[][] {
  const saida: Palavra[][] = [];
  let atual: Palavra[] = [];
  for (const p of palavras) {
    atual.push(p);
    if (atual.length >= MAX_POR_BLOCO || /[.!?,;:]$/.test(p.texto)) {
      saida.push(atual);
      atual = [];
    }
  }
  if (atual.length) saida.push(atual);
  return saida;
}

export const Legenda = ({ palavras, t, cor }: { palavras: Palavra[]; t: number; cor: string }) => {
  const bloco = blocos(palavras).find((b) => t >= b[0].inicio - 0.05 && t < (b.at(-1)?.fim ?? 0) + 0.25);
  if (!bloco) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 1480,
        left: 70,
        right: 70,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "0 20px",
      }}
    >
      {bloco.map((p, i) => {
        const ativa = t >= p.inicio && t < p.fim + 0.05;
        return (
          <span
            key={i}
            style={{
              fontSize: 64,
              fontWeight: 900,
              color: ativa ? cor : TEXTO,
              transform: `scale(${ativa ? 1.08 : 1})`,
              textShadow: "0 0 24px #FFFFFF, 0 0 8px #FFFFFF, 0 6px 18px rgba(60,50,140,0.25)",
            }}
          >
            {p.texto}
          </span>
        );
      })}
    </div>
  );
};
