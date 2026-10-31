import type { Pedido } from "./Inicio";
import type { Construcao } from "./main";
import { Fundo3D } from "./Efeitos3D";
import { MODO_ARTEFATO } from "./api";

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
  // Dentro do Claude (Artifact) não há pesquisa na internet nem gravação de voz no servidor.
  const escrevendo = MODO_ARTEFATO ? "Escrevendo os reels e as perguntas" : "Escrevendo, conferindo e gravando a voz dos reels";
  const etapas =
    pedido.tipo === "tema"
      ? [
          ["pesquisando", MODO_ARTEFATO ? "Reunindo o que você precisa saber" : "Pesquisando o assunto na internet"],
          ["planejando", "Separando os conceitos principais"],
          ["escrevendo", escrevendo],
        ]
      : [
          ["lendo", pedido.tipo === "pdf" ? "Lendo o seu PDF" : pedido.tipo === "foto" ? "Lendo as suas fotos" : "Lendo o seu texto"],
          ["planejando", "Separando os conceitos principais"],
          ["escrevendo", escrevendo],
        ];
  const atual = etapas.findIndex(([id]) => id === construcao.etapa);
  const origem =
    pedido.tipo === "pdf"
      ? `o PDF ${pedido.conteudo}`
      : pedido.tipo === "texto"
        ? "o seu texto"
        : pedido.tipo === "foto"
          ? "as suas fotos"
          : `"${pedido.conteudo}"`;

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
      {MODO_ARTEFATO && atual <= 0 && (
        <p className="dica-permissao">
          Na primeira vez, o Claude pede sua permissão para criar a aula. Toque em <b>Permitir</b>.
        </p>
      )}
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
