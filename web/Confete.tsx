import { useEffect, useMemo, useState } from "react";
import { menosMovimento } from "./animacao";

const CORES = ["#8B6CFF", "#00C2A8", "#FF8A3D", "#3DA5FF", "#FF5C8A", "#2BD47D", "#FFD84D"];

// Chuva de confete na tela inteira, uma vez. Cada `rodada` nova solta outra chuva.
export const Confete = ({ rodada = 0, pecas = 70 }: { rodada?: number; pecas?: number }) => {
  const [visivel, setVisivel] = useState(true);
  const lista = useMemo(
    () =>
      Array.from({ length: pecas }, (_, k) => ({
        esquerda: Math.random() * 100,
        atraso: Math.random() * 0.7,
        duracao: 1.9 + Math.random() * 1.4,
        giro: (Math.random() < 0.5 ? -1 : 1) * (240 + Math.random() * 520),
        deriva: (Math.random() - 0.5) * 120,
        cor: CORES[k % CORES.length],
        largura: 7 + Math.random() * 6,
        redondo: k % 5 === 0,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rodada, pecas],
  );

  useEffect(() => {
    setVisivel(true);
    const t = setTimeout(() => setVisivel(false), 4200);
    return () => clearTimeout(t);
  }, [rodada]);

  if (!visivel || menosMovimento()) return null;
  return (
    <div className="confete-tela" aria-hidden key={rodada}>
      {lista.map((p, k) => (
        <i
          key={k}
          style={{
            left: `${p.esquerda}%`,
            width: p.largura,
            height: p.redondo ? p.largura : p.largura * 1.5,
            borderRadius: p.redondo ? "50%" : 2,
            background: p.cor,
            animationDelay: `${p.atraso}s`,
            animationDuration: `${p.duracao}s`,
            ["--giro" as string]: `${p.giro}deg`,
            ["--deriva" as string]: `${p.deriva}px`,
          }}
        />
      ))}
    </div>
  );
};
