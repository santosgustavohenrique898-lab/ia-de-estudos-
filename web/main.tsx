import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Objetivo } from "../src/pipeline/estilo";
import { Inicio, type Pedido } from "./Inicio";
import { Gerando } from "./Gerando";
import { Feed } from "./Feed";
import { Resumo } from "./Resumo";
import { Revisao } from "./Revisao";
import { destravarVoz } from "./voz";
import { criarAula, ouvirAula, type EventoServidor, type ReelPronto } from "./api";
import { narracaoDoNavegador } from "./artefato";
import { abrirAula, iniciarProgresso, salvarAula, type Questao } from "./progresso";

// Uma resposta da aula: o que o aluno marcou e qual era a certa, para a correção no resultado.
export type RespostaDada = {
  // "r0" é a pergunta do 1º reel; "s2" é a 3ª questão do simulado.
  chave: string;
  tipo: "reel" | "simulado";
  // Posição dentro do tipo, a partir de 1.
  numero: number;
  conceito: string;
  questao: Questao;
  // A alternativa marcada, na ordem em que a questão aparece na correção.
  escolhida: number;
  acertou: boolean;
  // Acertou depois, em "Refazer as que errei". Não muda a nota da aula.
  refeita?: boolean;
};

export type Desempenho = {
  xp: number;
  acertos: number;
  respondidas: number;
  sequencia: number;
  melhorSequencia: number;
  revisar: string[];
  // Conceitos dos reels que o aluno assistiu até o fim ou cuja pergunta respondeu.
  vistos: string[];
  respostas: RespostaDada[];
};

// A aula chega aos poucos: cada posição é um reel pronto, descartado na checagem ou ainda em produção (null).
export type Construcao = {
  etapa: string | null;
  titulo: string;
  conceitos: string[];
  reels: (ReelPronto | "descartado" | null)[];
  terminou: boolean;
  erro: string | null;
  // O simulado do fim da aula: as questões entram conforme ficam prontas.
  simulado: Questao[];
  simuladoEstado: "nenhum" | "gerando" | "pronto";
  simuladoTotal: number;
};

// A aula aberta agora. O id liga a aula salva e os cartões de revisão que saem dela.
export type AulaAtual = { id: string; objetivo: Objetivo; criadaEm: number; salva: boolean };

const DESEMPENHO_INICIAL: Desempenho = {
  xp: 0,
  acertos: 0,
  respondidas: 0,
  sequencia: 0,
  melhorSequencia: 0,
  revisar: [],
  vistos: [],
  respostas: [],
};
const CONSTRUCAO_INICIAL: Construcao = {
  etapa: null,
  titulo: "",
  conceitos: [],
  reels: [],
  terminou: false,
  erro: null,
  simulado: [],
  simuladoEstado: "nenhum",
  simuladoTotal: 0,
};

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
    case "simulado-gerando":
      return { ...c, simuladoEstado: "gerando", simuladoTotal: e.total };
    case "questao":
      return { ...c, simulado: [...c.simulado, e.questao] };
    case "simulado-fim":
      return { ...c, simuladoEstado: c.simulado.length > 0 ? "pronto" : "nenhum", simuladoTotal: c.simulado.length };
  }
}

// O feed pode abrir assim que o primeiro reel da sequência estiver pronto.
const primeiroPronto = (c: Construcao) => {
  const r = c.reels.find((x) => x !== "descartado");
  return Boolean(r);
};

const novoId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

type Tela = "inicio" | "gerando" | "feed" | "resumo" | "revisao";

const App = () => {
  const [tela, setTela] = useState<Tela>("inicio");
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [aula, setAula] = useState<AulaAtual | null>(null);
  const [construcao, setConstrucao] = useState<Construcao>(CONSTRUCAO_INICIAL);
  const [desempenho, setDesempenho] = useState<Desempenho>(DESEMPENHO_INICIAL);
  const [aviso, setAviso] = useState<string | null>(null);
  const parar = useRef<() => void>(() => {});
  // Cada aula pedida ganha um número; respostas de uma aula abandonada são ignoradas.
  const geracao = useRef(0);
  const salvaComo = useRef("");

  useEffect(iniciarProgresso, []);

  const iniciar = (p: Pedido) => {
    parar.current();
    parar.current = () => {};
    const minha = ++geracao.current;
    destravarVoz();
    setAviso(null);
    setPedido(p);
    setAula({ id: novoId(), objetivo: p.objetivo, criadaEm: Date.now(), salva: false });
    setDesempenho(DESEMPENHO_INICIAL);
    setConstrucao(CONSTRUCAO_INICIAL);
    setTela("gerando");
    criarAula(p)
      .then((id) => {
        if (geracao.current !== minha) return;
        parar.current = ouvirAula(id, (e) => setConstrucao((c) => aplicar(c, e)));
      })
      .catch((erro: Error) => {
        if (geracao.current === minha) setConstrucao((c) => ({ ...c, terminou: true, erro: erro.message }));
      });
  };

  // Rever uma aula salva: abre direto no feed, sem gastar um pedido novo ao Claude.
  const abrirSalva = async (id: string) => {
    destravarVoz();
    parar.current();
    parar.current = () => {};
    const minha = ++geracao.current;
    setAviso(null);
    const salva = await abrirAula(id);
    if (geracao.current !== minha) return;
    if (!salva) {
      setAviso("Não consegui abrir essa aula salva. Gere de novo pelo tema.");
      return;
    }
    setPedido({ tipo: "tema", conteudo: salva.titulo, objetivo: salva.objetivo, reels: salva.reels.length });
    setAula({ id: salva.id, objetivo: salva.objetivo, criadaEm: salva.criadaEm, salva: true });
    setDesempenho(DESEMPENHO_INICIAL);
    setConstrucao({
      ...CONSTRUCAO_INICIAL,
      titulo: salva.titulo,
      conceitos: salva.conceitos,
      reels: salva.reels.map((reel) => ({ reel, narracao: narracaoDoNavegador(reel) })),
      terminou: true,
      simulado: salva.simulado,
      simuladoEstado: salva.simulado.length > 0 ? "pronto" : "nenhum",
      simuladoTotal: salva.simulado.length,
    });
    setTela("feed");
  };

  useEffect(() => {
    if (tela === "gerando" && !construcao.erro && primeiroPronto(construcao)) setTela("feed");
    // Um erro que chega com o feed aberto (por exemplo, o Claude recusou no meio) vai para a tela de erro.
    if (tela === "feed" && construcao.erro) setTela("gerando");
  }, [tela, construcao]);

  // Guarda a aula quando os reels ficam prontos, e de novo quando o simulado termina.
  useEffect(() => {
    if (!aula || aula.salva || !construcao.terminou || construcao.erro) return;
    if (construcao.simuladoEstado === "gerando" && construcao.simulado.length > 0) return;
    const assinatura = `${aula.id}|${construcao.simuladoEstado}|${construcao.simulado.length}`;
    if (salvaComo.current === assinatura) return;
    const reels = construcao.reels.filter((r): r is ReelPronto => Boolean(r) && r !== "descartado").map((r) => r.reel);
    if (reels.length === 0) return;
    salvaComo.current = assinatura;
    salvarAula({
      id: aula.id,
      titulo: construcao.titulo || pedido?.conteudo || "Sua aula",
      objetivo: aula.objetivo,
      criadaEm: aula.criadaEm,
      conceitos: construcao.conceitos,
      reels,
      simulado: construcao.simulado,
    });
  }, [aula, pedido, construcao]);

  const voltar = () => {
    parar.current();
    parar.current = () => {};
    geracao.current++;
    setTela("inicio");
  };

  switch (tela) {
    case "inicio":
      return <Inicio aoGerar={iniciar} aoAbrirAula={abrirSalva} aoRevisar={() => setTela("revisao")} aviso={aviso} />;
    case "gerando":
      return <Gerando pedido={pedido!} construcao={construcao} aoTentarDeNovo={() => iniciar(pedido!)} aoVoltar={voltar} />;
    case "feed":
      return (
        <Feed
          aula={aula!}
          construcao={construcao}
          desempenho={desempenho}
          setDesempenho={setDesempenho}
          aoSair={voltar}
          aoTerminar={() => setTela("resumo")}
        />
      );
    case "resumo":
      return <Resumo aula={aula!} construcao={construcao} desempenho={desempenho} setDesempenho={setDesempenho} aoNovaAula={voltar} />;
    case "revisao":
      return <Revisao aoSair={() => setTela("inicio")} />;
  }
};

createRoot(document.getElementById("app")!).render(<App />);
