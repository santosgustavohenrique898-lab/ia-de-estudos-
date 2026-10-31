import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Aula } from "../src/schema";
import { destaque } from "../src/remotion/tema";
import type { Desempenho } from "./main";
import type { Pedido } from "./Inicio";
import { ReelAoVivo } from "./ReelAoVivo";
import { QuizAoVivo } from "./QuizAoVivo";

type Item = { tipo: "reel"; i: number } | { tipo: "quiz"; i: number } | { tipo: "fim" };

const VELOCIDADES = [1, 1.25, 1.5];

export const Feed = ({
  aula,
  pedido,
  desempenho,
  setDesempenho,
  aoSair,
  aoTerminar,
}: {
  aula: Aula;
  pedido: Pedido;
  desempenho: Desempenho;
  setDesempenho: Dispatch<SetStateAction<Desempenho>>;
  aoSair: () => void;
  aoTerminar: () => void;
}) => {
  const itens: Item[] = [...aula.reels.flatMap((_, i): Item[] => [{ tipo: "reel", i }, { tipo: "quiz", i }]), { tipo: "fim" }];
  const [ativo, setAtivo] = useState(0);
  const [mudo, setMudo] = useState(false);
  const [velocidade, setVelocidade] = useState(1);
  const [curtidos, setCurtidos] = useState<Set<number>>(new Set());
  const [salvos, setSalvos] = useState<Set<number>>(new Set());
  const [avisoDemo, setAvisoDemo] = useState(!/revolu/i.test(pedido.conteudo));
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
  }, []);

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
        revisar: acertou ? d.revisar : [...d.revisar, aula.reels[i].conceito],
      };
    });
    setTimeout(() => setXpVoando(null), 1400);
  };

  return (
    <div className="feed-pagina">
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

        {avisoDemo && (
          <div className="aviso-demo" onClick={() => setAvisoDemo(false)}>
            Versão de demonstração: por enquanto toda aula usa o conteúdo de exemplo sobre Revolução Francesa. Toque para fechar.
          </div>
        )}

        <div className="feed" ref={lista}>
          {itens.map((item, k) => (
            <section key={k} className="card" data-indice={k}>
              {item.tipo === "reel" && (
                <ReelAoVivo
                  reel={aula.reels[item.i]}
                  numero={item.i + 1}
                  total={aula.reels.length}
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
                  quiz={aula.reels[item.i].quiz}
                  conceito={aula.reels[item.i].conceito}
                  cor={destaque(item.i + 1)}
                  ativo={ativo === k}
                  mudo={mudo}
                  sequencia={desempenho.sequencia}
                  aoResponder={(acertou) => responder(item.i, acertou)}
                  aoContinuar={() => irPara(k + 1)}
                />
              )}
              {item.tipo === "fim" && (
                <div className="fim-card">
                  <div className="fim-emoji">🎉</div>
                  <h2>Aula concluída!</h2>
                  <p>
                    Você acertou {desempenho.acertos} de {aula.reels.length} perguntas.
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
