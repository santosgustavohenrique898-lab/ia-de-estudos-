import type { Construcao, Desempenho } from "./main";
import { Fundo3D } from "./Efeitos3D";

export const Resumo = ({ construcao, desempenho, aoNovaAula }: { construcao: Construcao; desempenho: Desempenho; aoNovaAula: () => void }) => {
  const total = Math.max(desempenho.respondidas, 1);
  const pct = desempenho.respondidas ? Math.round((desempenho.acertos / total) * 100) : 0;
  const mensagem = pct === 100 ? "Gabaritou! 🏆" : pct >= 60 ? "Muito bom! 💪" : "Bora revisar e tentar de novo 📚";

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
              {desempenho.acertos}/{total}
            </strong>
            <span>acertos</span>
          </div>
          <div>
            <strong>🔥 {desempenho.melhorSequencia}</strong>
            <span>melhor sequência</span>
          </div>
        </div>

        {desempenho.revisar.length > 0 ? (
          <div className="revisar">
            <div className="rotulo">Para revisar amanhã</div>
            {desempenho.revisar.map((c) => (
              <div key={c} className="revisar-item">
                ↻ {c}
              </div>
            ))}
          </div>
        ) : (
          <div className="revisar">
            <div className="rotulo">Revisão</div>
            <div className="revisar-item">Nada pendente. Amanhã a gente confere se ficou na memória.</div>
          </div>
        )}

        <button className="botao-principal" onClick={aoNovaAula}>
          Estudar outra matéria
        </button>
      </div>
    </div>
  );
};
