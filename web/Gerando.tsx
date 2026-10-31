import type { Pedido } from "./Inicio";
import type { Construcao } from "./main";
import { Fundo3D } from "./Efeitos3D";

export const Gerando = ({
  pedido,
  construcao,
  aoTentarDeNovo,
  aoVoltar,
}: {
  pedido: Pedido;
  construcao: Construcao;
  aoTentarDeNovo: () => void;
  aoVoltar: () => void;
}) => {
  const etapas =
    pedido.tipo === "tema"
      ? [
          ["pesquisando", "Pesquisando o assunto na internet"],
          ["planejando", "Separando os conceitos principais"],
          ["escrevendo", "Escrevendo, conferindo e gravando a voz dos reels"],
        ]
      : [
          ["lendo", pedido.tipo === "pdf" ? "Lendo o seu PDF" : "Lendo o seu texto"],
          ["planejando", "Separando os conceitos principais"],
          ["escrevendo", "Escrevendo, conferindo e gravando a voz dos reels"],
        ];
  const atual = etapas.findIndex(([id]) => id === construcao.etapa);
  const origem = pedido.tipo === "pdf" ? `o PDF ${pedido.conteudo}` : pedido.tipo === "texto" ? "o seu texto" : `"${pedido.conteudo}"`;

  if (construcao.erro) {
    return (
      <div className="gerando">
        <Fundo3D denso={false} />
        <div className="erro-icone">!</div>
        <h2>Não deu certo desta vez</h2>
        <p className="sub">{construcao.erro}</p>
        <div className="botoes-erro">
          <button className="botao-principal" onClick={aoTentarDeNovo}>
            Tentar de novo
          </button>
          <button className="botao-secundario" onClick={aoVoltar}>
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="gerando">
      <Fundo3D denso={false} />
      <div className="nucleo3d">
        <div className="orbita-anel a1" />
        <div className="orbita-anel a2" />
        <div className="nucleo-orbe" />
      </div>
      <h2>{construcao.titulo || `Montando sua aula sobre ${origem}`}</h2>
      <p className="sub">
        {pedido.reels} reels para {pedido.objetivo} · leva cerca de 1 minuto
      </p>
      <ol className="etapas">
        {etapas.map(([id, rotulo], i) => (
          <li key={id} className={i < atual ? "feita" : i === atual ? "atual" : ""}>
            <span className="marca">{i < atual ? "✓" : ""}</span>
            {rotulo}
          </li>
        ))}
      </ol>
      {construcao.conceitos.length > 0 && (
        <div className="plano">
          <div className="rotulo">O que você vai aprender</div>
          {construcao.conceitos.map((c, i) => (
            <div key={c} className="plano-item">
              <span className="plano-num">{i + 1}</span>
              {c}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
