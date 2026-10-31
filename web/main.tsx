import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Inicio, type Pedido } from "./Inicio";
import { Gerando } from "./Gerando";
import { Feed } from "./Feed";
import { Resumo } from "./Resumo";
import { destravarVoz } from "./voz";
import { criarAula, ouvirAula, type EventoServidor, type ReelPronto } from "./api";

export type Desempenho = {
  xp: number;
  acertos: number;
  respondidas: number;
  sequencia: number;
  melhorSequencia: number;
  revisar: string[];
};

// A aula chega aos poucos: cada posição é um reel pronto, descartado na checagem ou ainda em produção (null).
export type Construcao = {
  etapa: string | null;
  titulo: string;
  conceitos: string[];
  reels: (ReelPronto | "descartado" | null)[];
  terminou: boolean;
  erro: string | null;
};

const DESEMPENHO_INICIAL: Desempenho = { xp: 0, acertos: 0, respondidas: 0, sequencia: 0, melhorSequencia: 0, revisar: [] };
const CONSTRUCAO_INICIAL: Construcao = { etapa: null, titulo: "", conceitos: [], reels: [], terminou: false, erro: null };

function aplicar(c: Construcao, e: EventoServidor): Construcao {
  switch (e.tipo) {
    case "etapa":
      return { ...c, etapa: e.etapa };
    case "plano":
      return { ...c, titulo: e.titulo, conceitos: e.conceitos, reels: e.conceitos.map(() => null) };
    case "reel":
      return { ...c, reels: c.reels.map((r, i) => (i === e.indice ? { reel: e.reel, narracao: e.narracao } : r)) };
    case "descartado":
      return { ...c, reels: c.reels.map((r, i) => (i === e.indice ? "descartado" : r)) };
    case "fim": {
      const algum = c.reels.some((r) => r && r !== "descartado");
      return { ...c, terminou: true, erro: algum ? null : "Não consegui montar nenhum reel com qualidade para esse conteúdo. Tente de novo ou mude o tema." };
    }
    case "erro":
      return { ...c, terminou: true, erro: e.mensagem };
  }
}

// O feed pode abrir assim que o primeiro reel da sequência estiver pronto.
const primeiroPronto = (c: Construcao) => {
  const r = c.reels.find((x) => x !== "descartado");
  return Boolean(r);
};

type Tela = "inicio" | "gerando" | "feed" | "resumo";

const App = () => {
  const [tela, setTela] = useState<Tela>("inicio");
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [construcao, setConstrucao] = useState<Construcao>(CONSTRUCAO_INICIAL);
  const [desempenho, setDesempenho] = useState<Desempenho>(DESEMPENHO_INICIAL);
  const parar = useRef<() => void>(() => {});

  const iniciar = (p: Pedido) => {
    parar.current();
    destravarVoz();
    setPedido(p);
    setDesempenho(DESEMPENHO_INICIAL);
    setConstrucao(CONSTRUCAO_INICIAL);
    setTela("gerando");
    criarAula(p)
      .then((id) => {
        parar.current = ouvirAula(id, (e) => setConstrucao((c) => aplicar(c, e)));
      })
      .catch((erro: Error) => setConstrucao((c) => ({ ...c, terminou: true, erro: erro.message })));
  };

  useEffect(() => {
    if (tela === "gerando" && !construcao.erro && primeiroPronto(construcao)) setTela("feed");
  }, [tela, construcao]);

  const voltar = () => {
    parar.current();
    setTela("inicio");
  };

  switch (tela) {
    case "inicio":
      return <Inicio aoGerar={iniciar} />;
    case "gerando":
      return <Gerando pedido={pedido!} construcao={construcao} aoTentarDeNovo={() => iniciar(pedido!)} aoVoltar={voltar} />;
    case "feed":
      return (
        <Feed
          construcao={construcao}
          desempenho={desempenho}
          setDesempenho={setDesempenho}
          aoSair={voltar}
          aoTerminar={() => setTela("resumo")}
        />
      );
    case "resumo":
      return <Resumo construcao={construcao} desempenho={desempenho} aoNovaAula={voltar} />;
  }
};

createRoot(document.getElementById("app")!).render(<App />);
