import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { destaque } from "../src/remotion/tema";
import type { Construcao, Desempenho } from "./main";
import type { ReelPronto } from "./api";
import { ReelAoVivo } from "./ReelAoVivo";
import { QuizAoVivo } from "./QuizAoVivo";
import { Fundo3D } from "./Efeitos3D";

type Item =
  | { tipo: "reel"; i: number; pronto: ReelPronto }
  | { tipo: "quiz"; i: number; pronto: ReelPronto }
  | { tipo: "carregando" }
  | { tipo: "fim" };

// Os reels entram no feed na ordem da aula; o feed para no primeiro que ainda está sendo produzido.
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
  if (c.terminou) itens.push({ tipo: "fim" });
  else itens.push({ tipo: "carregando" });
  return itens;
}

const VELOCIDADES = [1, 1.25, 1.5];

export const Feed = ({
  construcao,
  desempenho,
  setDesempenho,
  aoSair,
  aoTerminar,
}: {
  construcao: Construcao;
  desempenho: Desempenho;
  setDesempenho: Dispatch<SetStateAction<Desempenho>>;
  aoSair: () => void;
  aoTerminar: () => void;
}) => {
  const itens = montarItens(construcao);
  const prontos = itens.filter((x): x is Extract<Item, { tipo: "reel" }> => x.tipo === "reel").map((x) => x.pronto);
  const total = construcao.reels.filter((r) => r !== "descartado").length;
  const [ativo, setAtivo] = useState(0);
  const [mudo, setMudo] = useState(false);
  const [velocidade, setVelocidade] = useState(1);
  const [curtidos, setCurtidos] = useState<Set<number>>(new Set());
  const [salvos, setSalvos] = useState<Set<number>>(new Set());
  const [xpVoando, setXpVoando] = useState<number | null>(null);
  const lista = useRef<HTMLDivElement>(null);

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

  const responder = (i: number, acertou: boolean) => {
    setDesempenho((d) => {
      const sequencia = acertou ? d.sequencia + 1 : 0;
      const ganho = acertou ? 10 + 5 * (sequencia - 1) : 2;
      setXpVoando(ganho);
      return {
        xp: d.xp + ganho,
        acertos: d.acertos + (acertou ? 1 : 0),
        respondidas: d.respondidas + 1,
        sequencia,
        melhorSequencia: Math.max(d.melhorSequencia, sequencia),
        revisar: acertou ? d.revisar : [...d.revisar, prontos[i].reel.conceito],
      };
    });
    setTimeout(() => setXpVoando(null), 1400);
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
            <div className={desempenho.sequencia >= 2 ? "hud-pilula fogo" : "hud-pilula"}>🔥 {desempenho.sequencia}</div>
            <div className="hud-pilula">
              ⚡ {desempenho.xp} XP
              {xpVoando !== null && <span className="xp-voando">+{xpVoando}</span>}
            </div>
          </div>
        </div>

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
                  curtido={curtidos.has(item.i)}
                  salvo={salvos.has(item.i)}
                  aoCurtir={(forcar) => setCurtidos((c) => (forcar && c.has(item.i) ? c : alternar(c, item.i)))}
                  aoSalvar={() => setSalvos((s) => alternar(s, item.i))}
                  aoMudo={() => setMudo((m) => !m)}
                  aoVelocidade={() => setVelocidade((v) => VELOCIDADES[(VELOCIDADES.indexOf(v) + 1) % VELOCIDADES.length])}
                  aoTerminar={() => setTimeout(() => irPara(k + 1), 900)}
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
                  aoResponder={(acertou) => responder(item.i, acertou)}
                  aoContinuar={() => irPara(k + 1)}
                />
              )}
              {item.tipo === "carregando" && (
                <div className="carregando-card">
                  <div className="nucleo3d pequeno">
                    <div className="orbita-anel a1" />
                    <div className="orbita-anel a2" />
                    <div className="nucleo-orbe" />
                  </div>
                  <h2>Preparando o próximo reel</h2>
                  <p>Já já ele aparece aqui. Enquanto isso, você pode voltar e rever os anteriores.</p>
                </div>
              )}
              {item.tipo === "fim" && (
                <div className="fim-card">
                  <div className="fim-emoji">🎉</div>
                  <h2>Aula concluída!</h2>
                  <p>
                    Você acertou {desempenho.acertos} de {prontos.length} perguntas.
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
