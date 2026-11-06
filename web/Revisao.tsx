import { useEffect, useState } from "react";
import { destaque } from "../src/remotion/tema";
import { Fundo3D, Nucleo } from "./Efeitos3D";
import { Pergunta } from "./Pergunta";
import { textoDaMeta } from "./Feed";
import { embaralhar, embaralharQuestao } from "./questoes";
import {
  INTERVALOS,
  pendentes,
  registrarResposta,
  responderRevisao,
  respostasHoje,
  useProgresso,
  type Cartao,
  type Questao,
} from "./progresso";

const MAX_POR_SESSAO = 20;

const quandoVolta = (c: Cartao, acertou: boolean) => {
  if (!acertou) return "Ela volta amanhã para você tentar de novo.";
  const caixa = c.caixa + 1;
  return caixa >= INTERVALOS.length ? "Dominada! Essa não volta mais. 🏆" : `Ela volta daqui a ${INTERVALOS[caixa]} dias.`;
};

type Passo = { cartao: Cartao; questao: Questao };

// A revisão do dia: as perguntas que a pessoa errou (ou marcou para revisar) voltam 1, 3 e 7 dias depois.
export const Revisao = ({ aoSair }: { aoSair: () => void }) => {
  const progresso = useProgresso();
  // A sessão é montada uma vez: responder não tira nem põe perguntas no meio do caminho.
  const [sessao, setSessao] = useState<Passo[] | null>(null);
  const [atual, setAtual] = useState(0);
  const [acertos, setAcertos] = useState(0);
  const [nota, setNota] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const feitasHoje = respostasHoje(progresso.perfil);
  const meta = progresso.perfil.metaDiaria;

  useEffect(() => {
    if (sessao || progresso.fonte === "carregando") return;
    setSessao(
      embaralhar(pendentes(progresso))
        .slice(0, MAX_POR_SESSAO)
        .map((cartao) => ({ cartao, questao: embaralharQuestao(cartao.questao) })),
    );
  }, [progresso, sessao]);

  const responder = (passo: Passo, acertou: boolean) => {
    setNota(quandoVolta(passo.cartao, acertou));
    responderRevisao(passo.cartao.id, acertou);
    if (acertou) setAcertos((a) => a + 1);
    const dia = registrarResposta(acertou, acertou ? 10 : 2);
    if (dia.bateuMeta) {
      setAviso(textoDaMeta(dia.ofensiva));
      setTimeout(() => setAviso(null), 3800);
    }
  };

  const total = sessao?.length ?? 0;
  const passo = sessao?.[atual];

  return (
    <div className="feed-pagina">
      <Fundo3D denso={false} />
      <div className="feed-moldura">
        <div className="hud">
          <button className="hud-botao" onClick={aoSair} aria-label="Sair da revisão">
            ✕
          </button>
          <div className="hud-direita">
            {passo && (
              <div className="hud-pilula">
                ↻ {atual + 1} de {total}
              </div>
            )}
            <div className={feitasHoje >= meta ? "hud-pilula meta feita" : "hud-pilula meta"}>
              🎯 {Math.min(feitasHoje, meta)}/{meta}
            </div>
          </div>
        </div>
        {total > 0 && (
          <div className="barra-revisao">
            <div style={{ width: `${(Math.min(atual, total) / total) * 100}%` }} />
          </div>
        )}
        {aviso && <div className="aviso-topo">{aviso}</div>}

        <section className="card">
          {!sessao && (
            <div className="carregando-card">
              <Nucleo />
              <h2>Separando suas perguntas</h2>
            </div>
          )}
          {passo && (
            <Pergunta
              key={atual}
              questao={passo.questao}
              etiqueta="REVISÃO"
              conceito={`${passo.cartao.conceito} · ${passo.cartao.aulaTitulo}`}
              cor={destaque(atual + 1)}
              lembrete={passo.cartao.lembrete}
              nota={nota}
              textoContinuar={atual + 1 < total ? "Próxima pergunta" : "Terminar revisão"}
              aoResponder={(acertou) => responder(passo, acertou)}
              aoContinuar={() => {
                setNota(null);
                setAtual((a) => a + 1);
              }}
            />
          )}
          {sessao && !passo && (
            <div className="fim-card">
              <div className="fim-emoji">{total === 0 ? "😌" : acertos === total ? "🏆" : "💪"}</div>
              <h2>{total === 0 ? "Nada para revisar hoje" : "Revisão concluída!"}</h2>
              <p>
                {total === 0
                  ? "Quando você errar uma pergunta, ela volta aqui no dia seguinte."
                  : `Você acertou ${acertos} de ${total}. O que você acertou volta daqui a alguns dias, e o que errou volta amanhã. É assim que fica na memória.`}
              </p>
              <button className="botao-principal" onClick={aoSair}>
                Voltar ao início
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
