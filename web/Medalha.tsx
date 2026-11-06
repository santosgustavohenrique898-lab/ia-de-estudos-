import { useId } from "react";
import type { Faixa } from "./resultado";

// A medalha (ou o troféu) do resultado, desenhada em vetor: entra quicando, tem um brilho que passa
// e faíscas em volta nas faixas mais altas. As cores mudam com a faixa.

const METAIS = {
  ouro: { claro: "#FFF4B8", medio: "#FFC93C", escuro: "#E09A00", borda: "#B87800", icone: "#FFF8D6" },
  prata: { claro: "#FFFFFF", medio: "#D5DCE6", escuro: "#9EAABB", borda: "#7A8699", icone: "#F7F9FC" },
  bronze: { claro: "#FFE0C2", medio: "#E8A06A", escuro: "#B9682F", borda: "#8E4B1C", icone: "#FFEBD8" },
  roxo: { claro: "#E6DEFF", medio: "#9C80FF", escuro: "#6C4CF5", borda: "#4B33C4", icone: "#F1ECFF" },
};

const estrela = (cx: number, cy: number, fora: number, dentro: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? fora : dentro;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");

// Faísca de 4 pontas.
const Faisca = ({ x, y, r, atraso }: { x: number; y: number; r: number; atraso: number }) => (
  <path
    className="faisca"
    style={{ animationDelay: `${atraso}s`, transformOrigin: `${x}px ${y}px` }}
    d={`M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r} Z`}
    fill="#FFD84D"
  />
);

export const Medalha = ({ faixa }: { faixa: Faixa }) => {
  const id = useId().replace(/:/g, "");
  const metal = faixa === "ouro" || faixa === "trofeu" ? METAIS.ouro : faixa === "prata" ? METAIS.prata : faixa === "bronze" ? METAIS.bronze : METAIS.roxo;
  const brilha = faixa === "trofeu" || faixa === "ouro" || faixa === "prata";
  const grad = (
    <defs>
      <linearGradient id={`${id}-borda`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={metal.claro} />
        <stop offset="0.45" stopColor={metal.medio} />
        <stop offset="1" stopColor={metal.borda} />
      </linearGradient>
      <radialGradient id={`${id}-disco`} cx="0.38" cy="0.32" r="0.8">
        <stop offset="0" stopColor={metal.claro} />
        <stop offset="0.5" stopColor={metal.medio} />
        <stop offset="1" stopColor={metal.escuro} />
      </radialGradient>
      <linearGradient id={`${id}-icone`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={metal.icone} />
        <stop offset="1" stopColor={metal.medio} />
      </linearGradient>
      <linearGradient id={`${id}-fita1`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#8B6CFF" />
        <stop offset="1" stopColor="#4B33C4" />
      </linearGradient>
      <linearGradient id={`${id}-fita2`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4F86F7" />
        <stop offset="1" stopColor="#2A55C9" />
      </linearGradient>
      <clipPath id={`${id}-corte`}>
        {faixa === "trofeu" ? (
          <path d="M56 50 H144 V84 C144 120 124 142 100 144 C76 142 56 120 56 84 Z" />
        ) : (
          <circle cx="100" cy="150" r="58" />
        )}
      </clipPath>
    </defs>
  );

  const brilho = (
    <g clipPath={`url(#${id}-corte)`}>
      <polygon className="medalha-brilho" points="40,40 70,40 30,230 0,230" fill="#fff" opacity="0.55" />
    </g>
  );

  const faiscas = brilha && (
    <g>
      <Faisca x={30} y={72} r={9} atraso={0} />
      <Faisca x={174} y={92} r={7} atraso={0.5} />
      <Faisca x={168} y={190} r={10} atraso={1} />
      <Faisca x={34} y={176} r={6} atraso={1.4} />
    </g>
  );

  if (faixa === "trofeu") {
    return (
      <svg className="medalha" viewBox="0 0 200 230" role="img" aria-label="Troféu de gabarito">
        {grad}
        {faiscas}
        <path d="M60 64 C24 64 24 122 72 124" fill="none" stroke={metal.borda} strokeWidth="11" strokeLinecap="round" />
        <path d="M140 64 C176 64 176 122 128 124" fill="none" stroke={metal.borda} strokeWidth="11" strokeLinecap="round" />
        <path d="M60 64 C30 64 30 116 72 118" fill="none" stroke={metal.medio} strokeWidth="5" strokeLinecap="round" />
        <path d="M140 64 C170 64 170 116 128 118" fill="none" stroke={metal.medio} strokeWidth="5" strokeLinecap="round" />
        <path d="M56 50 H144 V84 C144 120 124 142 100 144 C76 142 56 120 56 84 Z" fill={`url(#${id}-disco)`} stroke={metal.borda} strokeWidth="3" />
        <ellipse cx="100" cy="50" rx="44" ry="8" fill={metal.claro} stroke={metal.borda} strokeWidth="3" />
        <polygon points={estrela(100, 92, 22, 9)} fill={`url(#${id}-icone)`} stroke={metal.borda} strokeWidth="2.5" strokeLinejoin="round" />
        {brilho}
        <rect x="92" y="142" width="16" height="24" fill={`url(#${id}-borda)`} />
        <ellipse cx="100" cy="150" rx="15" ry="5" fill={metal.medio} stroke={metal.borda} strokeWidth="2" />
        <path d="M70 166 H130 L138 188 H62 Z" fill={`url(#${id}-borda)`} stroke={metal.borda} strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="52" y="188" width="96" height="18" rx="5" fill="#2a2252" />
        <rect x="82" y="192" width="36" height="10" rx="2.5" fill={metal.medio} />
      </svg>
    );
  }

  const icone =
    faixa === "assistida" ? (
      <path d="M90 130 L118 150 L90 170 Z" fill={`url(#${id}-icone)`} stroke={metal.borda} strokeWidth="4" strokeLinejoin="round" />
    ) : faixa === "treino" ? (
      <path
        d="M104 122 L84 154 H99 L95 178 L117 144 H102 Z"
        fill={`url(#${id}-icone)`}
        stroke={metal.borda}
        strokeWidth="3"
        strokeLinejoin="round"
      />
    ) : (
      <polygon points={estrela(100, 151, 25, 10.5)} fill={`url(#${id}-icone)`} stroke={metal.borda} strokeWidth="2.5" strokeLinejoin="round" />
    );

  const rotulo = faixa === "assistida" ? "Aula assistida" : faixa === "treino" ? "Medalha de treino" : `Medalha de ${faixa}`;
  return (
    <svg className="medalha" viewBox="0 0 200 230" role="img" aria-label={rotulo}>
      {grad}
      {faiscas}
      <polygon points="118,0 154,0 116,112 88,104" fill={`url(#${id}-fita2)`} />
      <polygon points="131,0 141,0 106,106 99,104" fill="#fff" opacity="0.25" />
      <polygon points="46,0 82,0 112,104 84,112" fill={`url(#${id}-fita1)`} />
      <polygon points="59,0 69,0 101,106 94,108" fill="#fff" opacity="0.25" />
      <circle cx="100" cy="150" r="58" fill={`url(#${id}-borda)`} />
      <circle cx="100" cy="150" r="46" fill={`url(#${id}-disco)`} stroke="rgba(0,0,0,0.12)" strokeWidth="2" />
      <circle cx="100" cy="150" r="42" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
      {icone}
      <ellipse cx="80" cy="122" rx="18" ry="8" fill="#fff" opacity="0.35" transform="rotate(-30 80 122)" />
      {brilho}
    </svg>
  );
};
