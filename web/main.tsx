import { useState } from "react";
import { createRoot } from "react-dom/client";
import type { Aula } from "../src/schema";
import aulaExemplo from "../exemplos/revolucao-francesa.aula.json";
import { Inicio, type Pedido } from "./Inicio";
import { Gerando } from "./Gerando";
import { Feed } from "./Feed";
import { Resumo } from "./Resumo";
import { destravarVoz } from "./voz";

export type Desempenho = {
  xp: number;
  acertos: number;
  respondidas: number;
  sequencia: number;
  melhorSequencia: number;
  revisar: string[];
};

const DESEMPENHO_INICIAL: Desempenho = { xp: 0, acertos: 0, respondidas: 0, sequencia: 0, melhorSequencia: 0, revisar: [] };

type Tela =
  | { nome: "inicio" }
  | { nome: "gerando"; pedido: Pedido }
  | { nome: "feed"; pedido: Pedido; aula: Aula }
  | { nome: "resumo"; aula: Aula };

const App = () => {
  const [tela, setTela] = useState<Tela>({ nome: "inicio" });
  const [desempenho, setDesempenho] = useState<Desempenho>(DESEMPENHO_INICIAL);

  switch (tela.nome) {
    case "inicio":
      return (
        <Inicio
          aoGerar={(pedido) => {
            destravarVoz();
            setDesempenho(DESEMPENHO_INICIAL);
            setTela({ nome: "gerando", pedido });
          }}
        />
      );
    case "gerando":
      // Versão de demonstração: ainda não há servidor; toda aula usa o conteúdo de exemplo.
      return <Gerando pedido={tela.pedido} aoTerminar={() => setTela({ nome: "feed", pedido: tela.pedido, aula: aulaExemplo as Aula })} />;
    case "feed":
      return (
        <Feed
          aula={tela.aula}
          pedido={tela.pedido}
          desempenho={desempenho}
          setDesempenho={setDesempenho}
          aoSair={() => setTela({ nome: "inicio" })}
          aoTerminar={() => setTela({ nome: "resumo", aula: tela.aula })}
        />
      );
    case "resumo":
      return <Resumo aula={tela.aula} desempenho={desempenho} aoNovaAula={() => setTela({ nome: "inicio" })} />;
  }
};

createRoot(document.getElementById("app")!).render(<App />);
