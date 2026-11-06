import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { destaque } from "../src/remotion/tema";
import type { Objetivo } from "../src/pipeline/estilo";
import type { AulaAtual, Construcao, Desempenho, RespostaDada } from "./main";
import { MODO_ARTEFATO, type ReelPronto } from "./api";
import { ReelAoVivo } from "./ReelAoVivo";
import { QuizAoVivo } from "./QuizAoVivo";
import { Pergunta } from "./Pergunta";
import { Fundo3D, Nucleo } from "./Efeitos3D";
import {
  chaveDoReel,
  curtirReel,
  desmarcarRevisao,
  marcarParaRevisar,
  registrarErro,
  registrarResposta,
  respostasHoje,
  useProgresso,
  type NovoCartao,
  type Questao,
} from "./progresso";

type Item =
  | { tipo: "reel"; i: number; pronto: ReelPronto }
  | { tipo: "quiz"; i: number; pronto: ReelPronto }
  | { tipo: "carregando" }
  | { tipo: "questao"; k: number; questao: Questao }
  | { tipo: "carregando-simulado" }
  | { tipo: "fim" };

// Os reels entram no feed na ordem da aula; o feed para no primeiro que ainda está sendo produzido.
// Depois do último reel vem o simulado, questão por questão, e por fim o card de conclusão.
function montarItens(c: Construcao): Item[] {
  const itens: Item[] = [];
  let n = 0;
  for (const r of c.reels) {
    if (r === "descartado") continue;
    if (r === null) {
      itens.push({ tipo: "carregando" });
      return itens;
    }
    itens.push({ tipo: "reel", i: n, pronto: r }, { tipo: "quiz", i: n, pronto: r });
    n++;
  }
  if (!c.terminou) {
    itens.push({ tipo: "carregando" });
    return itens;
  }
  c.simulado.forEach((questao, k) => itens.push({ tipo: "questao", k, questao }));
  itens.push(c.simuladoEstado === "gerando" ? { tipo: "carregando-simulado" } : { tipo: "fim" });
  return itens;
}

export const NOME_PROVA: Record<Objetivo, string> = {
  ENEM: "estilo ENEM",
  Vestibular: "estilo vestibular",
  Concurso: "estilo concurso",
  Faculdade: "da faculdade",
};

const VELOCIDADES = [1, 1.25, 1.5];

export const lembreteDoReel = (p: ReelPronto) => {
  const f = p.reel.cenas.find((c) => c.template === "fixacao");
  return f?.template === "fixacao" ? f.frase : undefined;
};

// O cartão de revisão da pergunta de um reel (o mesmo id liga o erro, o "Revisar" e o "Não entendi").
export const cartaoDoReel = (aula: AulaAtual, tituloDaAula: string, i: number, p: ReelPronto): NovoCartao => ({
  id: `${aula.id}-r${i}`,
  conceito: p.reel.conceito,
  aulaId: aula.id,
  aulaTitulo: tituloDaAula,
  questao: { ...p.reel.quiz },
  lembrete: lembreteDoReel(p),
});

// O cartão de revisão de uma questão do simulado.
export const cartaoDaQuestao = (aula: AulaAtual, tituloDaAula: string, k: number, q: Questao): NovoCartao => ({
  id: `${aula.id}-s${k}`,
  conceito: q.conceito || tituloDaAula,
  aulaId: aula.id,
  aulaTitulo: tituloDaAula,
  questao: q,
});

export const textoDaMeta = (ofensiva: number) =>
  ofensiva <= 1 ? "🎯 Meta do dia batida! Sua ofensiva começou: 🔥 1 dia" : `🎯 Meta do dia batida! 🔥 ${ofensiva} dias seguidos`;

export const Feed = ({
  aula,
  construcao,
  desempenho,
  setDesempenho,
  aoSair,
  aoTerminar,
}: {
  aula: AulaAtual;
  construcao: Construcao;
  desempenho: Desempenho;
  setDesempenho: Dispatch<SetStateAction<Desempenho>>;
  aoSair: () => void;
  aoTerminar: () => void;
}) => {
  const itens = montarItens(construcao);
  const prontos = itens.filter((x): x is Extract<Item, { tipo: "reel" }> => x.tipo === "reel").map((x) => x.pronto);
  const total = construcao.reels.filter((r) => r !== "descartado").length;
  const totalSimulado = Math.max(construcao.simuladoTotal, construcao.simulado.length);
  const [ativo, setAtivo] = useState(0);
  const [mudo, setMudo] = useState(false);
  const [velocidade, setVelocidade] = useState(1);
  const [salvos, setSalvos] = useState<Set<number>>(new Set());
  const [xpVoando, setXpVoando] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const lista = useRef<HTMLDivElement>(null);
  const progresso = useProgresso();
  const feitasHoje = respostasHoje(progresso.perfil);
  const meta = progresso.perfil.metaDiaria;

  // Descobre qual card está na tela.
  useEffect(() => {
    const raiz = lista.current;
    if (!raiz) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) if (e.isIntersecting) setAtivo(Number((e.target as HTMLElement).dataset.indice));
      },
      { root: raiz, threshold: 0.6 },
    );
    raiz.querySelectorAll("[data-indice]").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [itens.length]);

  const irPara = (indice: number) => {
    lista.current?.querySelector(`[data-indice="${indice}"]`)?.scrollIntoView({ behavior: "smooth" });
  };

  const alternar = (conjunto: Set<number>, i: number) => {
    const novo = new Set(conjunto);
    if (novo.has(i)) novo.delete(i);
    else novo.add(i);
    return novo;
  };

  const marcarVisto = (conceito: string) =>
    setDesempenho((d) => (d.vistos.includes(conceito) ? d : { ...d, vistos: [...d.vistos, conceito] }));

  const mostrarAviso = (texto: string) => {
    setAviso(texto);
    setTimeout(() => setAviso((a) => (a === texto ? null : a)), 3800);
  };

  const cartaoDoReelDaAula = (i: number, p: ReelPronto) => cartaoDoReel(aula, construcao.titulo, i, p);

  // Cada resposta conta para a aula (XP com bônus de sequência) e para o dia (meta e ofensiva),
  // e fica guardada (o que marcou e o que era certo) para a correção no resultado.
  const contar = (resposta: RespostaDada) => {
    const { acertou, conceito } = resposta;
    const sequencia = acertou ? desempenho.sequencia + 1 : 0;
    const ganho = acertou ? 10 + 5 * (sequencia - 1) : 2;
    setXpVoando(ganho);
    setTimeout(() => setXpVoando(null), 1400);
    setDesempenho((d) => ({
      ...d,
      xp: d.xp + ganho,
      acertos: d.acertos + (acertou ? 1 : 0),
      respondidas: d.respondidas + 1,
      sequencia,
      melhorSequencia: Math.max(d.melhorSequencia, sequencia),
      revisar: acertou || d.revisar.includes(conceito) ? d.revisar : [...d.revisar, conceito],
      respostas: [...d.respostas.filter((r) => r.chave !== resposta.chave), resposta],
    }));
    const dia = registrarResposta(acertou, ganho);
    if (dia.bateuMeta) mostrarAviso(textoDaMeta(dia.ofensiva));
  };

  return (
    <div className="feed-pagina">
      <Fundo3D denso={false} />
      <div className="feed-moldura">
        <div className="hud">
          <button className="hud-botao" onClick={aoSair} aria-label="Sair da aula">
            ✕
          </button>
          <div className="hud-direita">
            {progresso.fonte !== "carregando" && (
              <div className={feitasHoje >= meta ? "hud-pilula meta feita" : "hud-pilula meta"} title="Meta de perguntas do dia">
                🎯 {Math.min(feitasHoje, meta)}/{meta}
              </div>
            )}
            <div className={desempenho.sequencia >= 2 ? "hud-pilula fogo" : "hud-pilula"} title="Acertos seguidos nesta aula">
              ✓ {desempenho.sequencia}
            </div>
            <div className="hud-pilula">
              ⚡ {desempenho.xp} XP
              {xpVoando !== null && <span className="xp-voando">+{xpVoando}</span>}
            </div>
          </div>
        </div>
        {aviso && <div className="aviso-topo">{aviso}</div>}

        <div className="feed" ref={lista}>
          {itens.map((item, k) => (
            <section key={k} className="card" data-indice={k}>
              {item.tipo === "reel" && (
                <ReelAoVivo
                  reel={item.pronto.reel}
                  narracao={item.pronto.narracao}
                  numero={item.i + 1}
                  total={total}
                  cor={destaque(item.i + 1)}
                  ativo={ativo === k}
                  mudo={mudo}
                  velocidade={velocidade}
                  curtido={progresso.curtidas.includes(chaveDoReel(aula.id, item.i))}
                  salvo={salvos.has(item.i)}
                  objetivo={aula.objetivo}
                  podeExplicar={MODO_ARTEFATO}
                  aoCurtir={(so) => curtirReel(chaveDoReel(aula.id, item.i), so)}
                  aoSalvar={() => {
                    if (salvos.has(item.i)) desmarcarRevisao(`${aula.id}-r${item.i}`);
                    else marcarParaRevisar(cartaoDoReelDaAula(item.i, item.pronto));
                    setSalvos((s) => alternar(s, item.i));
                  }}
                  aoNaoEntendi={() => {
                    marcarParaRevisar(cartaoDoReelDaAula(item.i, item.pronto));
                    setSalvos((s) => new Set(s).add(item.i));
                  }}
                  aoMudo={() => setMudo((m) => !m)}
                  aoVelocidade={() => setVelocidade((v) => VELOCIDADES[(VELOCIDADES.indexOf(v) + 1) % VELOCIDADES.length])}
                  aoTerminar={() => {
                    marcarVisto(item.pronto.reel.conceito);
                    setTimeout(() => irPara(k + 1), 900);
                  }}
                />
              )}
              {item.tipo === "quiz" && (
                <QuizAoVivo
                  quiz={item.pronto.reel.quiz}
                  conceito={item.pronto.reel.conceito}
                  falarEmVoz={!item.pronto.narracao.audio}
                  cor={destaque(item.i + 1)}
                  ativo={ativo === k}
                  mudo={mudo}
                  sequencia={desempenho.sequencia}
                  aoResponder={(acertou, escolhida) => {
                    const conceito = item.pronto.reel.conceito;
                    contar({
                      chave: `r${item.i}`,
                      tipo: "reel",
                      numero: item.i + 1,
                      conceito,
                      questao: { ...item.pronto.reel.quiz, conceito },
                      escolhida,
                      acertou,
                    });
                    marcarVisto(conceito);
                    if (!acertou) registrarErro(cartaoDoReelDaAula(item.i, item.pronto));
                  }}
                  aoContinuar={() => irPara(k + 1)}
                />
              )}
              {item.tipo === "questao" && (
                <Pergunta
                  questao={item.questao}
                  etiqueta={`SIMULADO ${NOME_PROVA[aula.objetivo].toUpperCase()} · ${item.k + 1} DE ${totalSimulado}`}
                  conceito={item.questao.conceito}
                  cor={destaque(item.k + 2)}
                  aoResponder={(acertou, escolhida) => {
                    contar({
                      chave: `s${item.k}`,
                      tipo: "simulado",
                      numero: item.k + 1,
                      conceito: item.questao.conceito || construcao.titulo,
                      questao: item.questao,
                      escolhida,
                      acertou,
                    });
                    if (!acertou) registrarErro(cartaoDaQuestao(aula, construcao.titulo, item.k, item.questao));
                  }}
                  aoContinuar={() => irPara(k + 1)}
                />
              )}
              {item.tipo === "carregando" && (
                <div className="carregando-card">
                  <Nucleo />
                  <h2>Preparando o próximo reel</h2>
                  <p>Já já ele aparece aqui. Enquanto isso, você pode voltar e rever os anteriores.</p>
                </div>
              )}
              {item.tipo === "carregando-simulado" && (
                <div className="carregando-card">
                  <Nucleo />
                  <h2>Montando seu simulado {NOME_PROVA[aula.objetivo]}</h2>
                  <p>
                    {totalSimulado} questões sobre o que você acabou de ver, com a explicação de cada alternativa. As que você errar
                    voltam na sua revisão.
                  </p>
                  <button className="botao-secundario" onClick={aoTerminar}>
                    Pular e ver meu resultado
                  </button>
                </div>
              )}
              {item.tipo === "fim" && (
                <div className="fim-card">
                  <div className="fim-emoji">🎉</div>
                  <h2>Aula concluída!</h2>
                  <p>
                    {desempenho.respondidas > 0
                      ? `Você acertou ${desempenho.acertos} de ${desempenho.respondidas} perguntas.`
                      : `Você viu os ${prontos.length} reels da aula.`}
                  </p>
                  <button className="botao-principal" onClick={aoTerminar}>
                    Ver meu resultado
                  </button>
                </div>
              )}
            </section>
          ))}
        </div>

        {ativo === 0 && <div className="dica-rolar">role para cima ↑ para continuar</div>}
      </div>
    </div>
  );
};
