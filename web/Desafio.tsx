import { useEffect, useRef, useState } from "react";
import { destaque } from "../src/remotion/tema";
import { Pergunta } from "./Pergunta";
import { Confete } from "./Confete";
import type { Questao } from "./progresso";

export type ItemDoDesafio = {
  chave: string;
  tipo: "reel" | "simulado";
  numero: number;
  conceito: string;
  // A questão como aparece aqui (no "Refazer", com as alternativas em outra ordem).
  questao: Questao;
  lembrete?: string;
};

export type ModoDoDesafio = "refazer" | "faltaram";

// O que a tela de resultado devolve a cada resposta: o XP ganho e se a meta do dia foi batida agora.
export type Retorno = { xp: number; aviso: string | null };

// Uma rodada rápida por cima do resultado: refazer as que errou (alternativas embaralhadas)
// ou responder as que ficaram sem resposta. No fim, mostra quantas acertou e o XP ganho.
export const Desafio = ({
  modo,
  itens,
  nomeProva,
  totalSimulado,
  aoResponder,
  aoFechar,
}: {
  modo: ModoDoDesafio;
  itens: ItemDoDesafio[];
  nomeProva: string;
  totalSimulado: number;
  aoResponder: (item: ItemDoDesafio, acertou: boolean, escolhida: number) => Retorno;
  aoFechar: () => void;
}) => {
  // A lista é fixada quando a rodada começa: responder não tira nem põe perguntas no meio do caminho.
  const [lista] = useState(itens);
  const [atual, setAtual] = useState(0);
  const [acertos, setAcertos] = useState(0);
  const [xp, setXp] = useState(0);
  const [nota, setNota] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar.current();
    window.addEventListener("keydown", tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = antes;
    };
  }, []);

  const item = lista[atual];
  const total = lista.length;
  const acabou = atual >= total;

  const responder = (acertou: boolean, escolhida: number) => {
    const r = aoResponder(item, acertou, escolhida);
    setXp((x) => x + r.xp);
    if (acertou) setAcertos((a) => a + 1);
    if (modo === "refazer")
      setNota(
        acertou
          ? `Virou o jogo! +${r.xp} XP. Ela ainda volta amanhã na revisão, para fixar de vez.`
          : "Ainda não. Leia o porquê de cada alternativa: essa volta amanhã na sua revisão.",
      );
    else setNota(acertou ? `Mandou bem! +${r.xp} XP.` : "Essa volta amanhã na sua revisão.");
    if (r.aviso) {
      setAviso(r.aviso);
      setTimeout(() => setAviso(null), 3800);
    }
  };

  const etiqueta = (i: ItemDoDesafio) => {
    const qual = i.tipo === "simulado" ? `QUESTÃO ${i.numero} DO SIMULADO` : `PERGUNTA DO REEL ${i.numero}`;
    if (modo === "refazer") return `REFAZENDO · ${qual}`;
    return i.tipo === "simulado" ? `SIMULADO ${nomeProva.toUpperCase()} · ${i.numero} DE ${totalSimulado}` : qual;
  };

  const perfeito = acabou && total > 0 && acertos === total;

  return (
    <div className="sobreposto" role="dialog" aria-modal="true" aria-label={modo === "refazer" ? "Refazer as que errei" : "Responder as que faltaram"}>
      <div className="sobreposto-moldura">
        <div className="hud">
          <button className="hud-botao" onClick={aoFechar} aria-label="Voltar ao resultado">
            ✕
          </button>
          <div className="hud-direita">
            {!acabou && (
              <div className="hud-pilula">
                {modo === "refazer" ? "↻" : "✍️"} {atual + 1} de {total}
              </div>
            )}
            <div className="hud-pilula">⚡ +{xp} XP</div>
          </div>
        </div>
        <div className="barra-revisao">
          <div style={{ width: `${(Math.min(atual, total) / Math.max(total, 1)) * 100}%` }} />
        </div>
        {aviso && <div className="aviso-topo">{aviso}</div>}

        <section className="card">
          {item && (
            <Pergunta
              key={atual}
              questao={item.questao}
              etiqueta={etiqueta(item)}
              conceito={item.conceito}
              cor={destaque(atual + 2)}
              lembrete={item.lembrete}
              nota={nota}
              textoContinuar={atual + 1 < total ? "Próxima" : "Ver como fui"}
              aoResponder={responder}
              aoContinuar={() => {
                setNota(null);
                setAtual((a) => a + 1);
              }}
            />
          )}
          {acabou && (
            <div className="fim-card desafio-fim">
              <div className="fim-emoji">{perfeito ? "🏆" : acertos > 0 ? "💪" : "📚"}</div>
              <h2>
                {modo === "refazer"
                  ? perfeito
                    ? "Virou o jogo!"
                    : acertos > 0
                      ? "Boa! Já está melhor"
                      : "Faz parte do treino"
                  : perfeito
                    ? "Gabaritou essas!"
                    : "Pronto!"}
              </h2>
              <p>
                Você acertou {acertos} de {total}
                {xp > 0 ? ` e ganhou +${xp} XP` : ""}.{" "}
                {modo === "refazer" ? "O que você errou hoje volta amanhã na revisão: é assim que fica na memória." : "A correção completa está no seu resultado."}
              </p>
              <button className="botao-principal" onClick={aoFechar}>
                Ver meu resultado
              </button>
            </div>
          )}
        </section>
        {perfeito && <Confete />}
      </div>
    </div>
  );
};
