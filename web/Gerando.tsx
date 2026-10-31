import { useEffect, useState } from "react";
import type { Pedido } from "./Inicio";

const ETAPAS = [
  "Lendo seu material",
  "Separando os conceitos principais",
  "Escrevendo os roteiros",
  "Conferindo cada frase com a fonte",
  "Animando os reels e gravando a voz",
];

const MS_POR_ETAPA = 850;

export const Gerando = ({ pedido, aoTerminar }: { pedido: Pedido; aoTerminar: () => void }) => {
  const [etapa, setEtapa] = useState(0);

  useEffect(() => {
    if (etapa >= ETAPAS.length) {
      const t = setTimeout(aoTerminar, 300);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setEtapa((e) => e + 1), MS_POR_ETAPA);
    return () => clearTimeout(t);
  }, [etapa, aoTerminar]);

  const origem = pedido.tipo === "pdf" ? `o PDF ${pedido.conteudo}` : pedido.tipo === "texto" ? "o seu texto" : `"${pedido.conteudo}"`;

  return (
    <div className="gerando">
      <div className="orbita">
        <div className="orbita-centro">▶</div>
      </div>
      <h2>Montando sua aula sobre {origem}</h2>
      <p className="sub">
        {pedido.reels} reels para {pedido.objetivo}
      </p>
      <ol className="etapas">
        {ETAPAS.map((e, i) => (
          <li key={e} className={i < etapa ? "feita" : i === etapa ? "atual" : ""}>
            <span className="marca">{i < etapa ? "✓" : ""}</span>
            {e}
          </li>
        ))}
      </ol>
    </div>
  );
};
