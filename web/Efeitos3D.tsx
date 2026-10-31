import { useEffect, type CSSProperties } from "react";

// Objetos 3D feitos só com CSS (sem biblioteca): esferas brilhantes, anéis e um cubo de vidro.
// O ponteiro do mouse inclina a cena levemente (variáveis --mx e --my, de -1 a 1).

export function useParallax() {
  useEffect(() => {
    const raiz = document.documentElement;
    const mover = (e: PointerEvent) => {
      raiz.style.setProperty("--mx", ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
      raiz.style.setProperty("--my", ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
    };
    window.addEventListener("pointermove", mover);
    return () => window.removeEventListener("pointermove", mover);
  }, []);
}

type Posicao = { x: string; y: string; tamanho: number; profundidade?: number; atraso?: number };

const posicionar = ({ x, y, tamanho, profundidade = 1, atraso = 0 }: Posicao): CSSProperties => ({
  left: x,
  top: y,
  width: tamanho,
  height: tamanho,
  ["--prof" as string]: profundidade,
  animationDelay: `${atraso}s`,
});

export const Orbe = ({ cor, ...p }: Posicao & { cor: "roxo" | "azul" | "menta" | "pessego" | "rosa" }) => (
  <div className={`obj3d orbe orbe-${cor}`} style={posicionar(p)} />
);

export const Anel = ({ cor, ...p }: Posicao & { cor: "roxo" | "azul" | "menta" }) => (
  <div className="obj3d anel-3d" style={posicionar(p)}>
    <div className={`anel-face anel-${cor}`} />
  </div>
);

export const Cubo = (p: Posicao) => (
  <div className="obj3d cubo-cena" style={posicionar(p)}>
    <div className="cubo" style={{ ["--lado" as string]: `${p.tamanho}px` }}>
      {["frente", "tras", "dir", "esq", "topo", "base"].map((f) => (
        <div key={f} className={`cubo-face ${f}`} />
      ))}
    </div>
  </div>
);

// Fundo da página: luz suave em tons pastel + objetos flutuando em profundidades diferentes.
export const Fundo3D = ({ denso = true }: { denso?: boolean }) => (
  <div className="fundo3d" aria-hidden>
    <div className="luz luz-1" />
    <div className="luz luz-2" />
    <div className="luz luz-3" />
    <Orbe cor="roxo" x="91%" y="46%" tamanho={90} profundidade={1.6} />
    <Orbe cor="menta" x="88%" y="10%" tamanho={60} profundidade={0.8} atraso={1.2} />
    <Orbe cor="pessego" x="80%" y="78%" tamanho={110} profundidade={1.3} atraso={0.6} />
    {denso && <Orbe cor="azul" x="44%" y="88%" tamanho={46} profundidade={0.6} atraso={2} />}
    {denso && <Anel cor="roxo" x="2%" y="68%" tamanho={130} profundidade={1.1} atraso={0.4} />}
    {denso && <Cubo x="56%" y="6%" tamanho={54} profundidade={0.9} atraso={1.5} />}
  </div>
);
