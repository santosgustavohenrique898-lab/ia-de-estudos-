import { useState } from "react";
import type { AulaAtual, Construcao, Desempenho } from "./main";
import type { ReelPronto } from "./api";
import { Fundo3D } from "./Efeitos3D";
import { lembreteDoReel } from "./Feed";
import { ofensivaAtual, respostasHoje, useProgresso } from "./progresso";
import { baixarArquivo, imagemDoResumo, nomeDoArquivo } from "./resumoImagem";

export const Resumo = ({
  aula,
  construcao,
  desempenho,
  aoNovaAula,
}: {
  aula: AulaAtual;
  construcao: Construcao;
  desempenho: Desempenho;
  aoNovaAula: () => void;
}) => {
  const progresso = useProgresso();
  const [baixando, setBaixando] = useState(false);
  const [situacao, setSituacao] = useState<string | null>(null);
  const total = Math.max(desempenho.respondidas, 1);
  const pct = desempenho.respondidas ? Math.round((desempenho.acertos / total) * 100) : 0;
  const mensagem = !desempenho.respondidas ? "Aula assistida! 🎬" : pct === 100 ? "Gabaritou! 🏆" : pct >= 60 ? "Muito bom! 💪" : "Bora revisar e tentar de novo 📚";
  const ofensiva = ofensivaAtual(progresso.perfil);
  const feitasHoje = respostasHoje(progresso.perfil);
  const meta = progresso.perfil.metaDiaria;
  const conceitos = construcao.reels
    .filter((r): r is ReelPronto => Boolean(r) && r !== "descartado")
    .map((r) => ({ nome: r.reel.conceito, frase: lembreteDoReel(r) ?? "" }));

  const baixar = async () => {
    setBaixando(true);
    setSituacao(null);
    try {
      const imagem = await imagemDoResumo({
        titulo: construcao.titulo || "Minha aula",
        objetivo: aula.objetivo,
        conceitos,
        acertos: desempenho.acertos,
        respondidas: desempenho.respondidas,
        xp: desempenho.xp,
      });
      const r = await baixarArquivo(imagem, nomeDoArquivo(construcao.titulo || "aula"));
      setSituacao(
        r === "salvo"
          ? "Resumo salvo! Agora é só mandar no grupo de estudos."
          : r === "ocupado"
            ? "Já tem um download esperando sua confirmação."
            : "Download cancelado.",
      );
    } catch (e) {
      console.error("Falha ao montar o resumo", e);
      setSituacao("Não consegui montar a imagem agora. Tente de novo.");
    } finally {
      setBaixando(false);
    }
  };

  return (
    <div className="resumo">
      <Fundo3D />
      <div className="resumo-cartao">
        <div className="anel" style={{ ["--pct" as string]: `${pct}%` }}>
          <div>
            <strong>{pct}%</strong>
            <span>de acerto</span>
          </div>
        </div>
        <h2>{mensagem}</h2>
        <p className="sub">{construcao.titulo}</p>

        <div className="numeros">
          <div>
            <strong>⚡ {desempenho.xp}</strong>
            <span>XP ganho</span>
          </div>
          <div>
            <strong>
              {desempenho.acertos}/{desempenho.respondidas}
            </strong>
            <span>acertos</span>
          </div>
          <div>
            <strong>🔥 {ofensiva}</strong>
            <span>{ofensiva === 1 ? "dia seguido" : "dias seguidos"}</span>
          </div>
        </div>

        {progresso.fonte !== "carregando" && (
          <div className="meta-resumo">
            <div>
              <span>🎯 Meta de hoje</span>
              <b>
                {Math.min(feitasHoje, meta)}/{meta} perguntas{feitasHoje >= meta ? " · batida!" : ""}
              </b>
            </div>
            <i>
              <span style={{ width: `${Math.min(1, feitasHoje / meta) * 100}%` }} />
            </i>
          </div>
        )}

        {desempenho.revisar.length > 0 ? (
          <div className="revisar">
            <div className="rotulo">Volta amanhã na sua revisão</div>
            {desempenho.revisar.map((c) => (
              <div key={c} className="revisar-item">
                ↻ {c}
              </div>
            ))}
          </div>
        ) : (
          <div className="revisar">
            <div className="rotulo">Revisão</div>
            <div className="revisar-item">Nada pendente desta aula. O que você errar numa aula volta no dia seguinte.</div>
          </div>
        )}

        {conceitos.length > 0 && (
          <div className="aprendi">
            <div className="rotulo">O que você aprendeu</div>
            {conceitos.map((c, i) => (
              <div key={i} className="aprendi-item">
                <b>{c.nome}</b>
                {c.frase && <span>{c.frase}</span>}
              </div>
            ))}
          </div>
        )}

        <button className="botao-secundario largo" onClick={baixar} disabled={baixando}>
          {baixando ? "Montando a imagem…" : "📥 Baixar resumo para mandar no grupo"}
        </button>
        {situacao && <div className="situacao">{situacao}</div>}
        <button className="botao-principal" onClick={aoNovaAula}>
          Estudar outra matéria
        </button>
      </div>
    </div>
  );
};
