import { useState } from "react";
import type { RespostaDada } from "./main";
import type { Questao } from "./progresso";
import { LETRAS } from "./questoes";
import { porConceito } from "./resultado";

// Uma pergunta da aula, respondida ou não.
export type PerguntaDaAula = {
  chave: string;
  tipo: "reel" | "simulado";
  numero: number;
  conceito: string;
  questao: Questao;
  resposta?: RespostaDada;
};

type Ligacoes = {
  // Em que reel da aula está o conceito, para o "Rever o reel" (-1 se não houver).
  reelDe: (conceito: string) => number;
  emojiDe: (conceito: string) => string | null;
  lembreteDe: (conceito: string) => string | undefined;
  aoReverReel: (indice: number) => void;
};

const nomeDa = (p: PerguntaDaAula) => (p.tipo === "simulado" ? `Questão ${p.numero} do simulado` : `Pergunta do reel ${p.numero}`);

// A correção da aula: gabarito, acertos por assunto e, questão por questão, o que o aluno marcou,
// qual era a certa e por quê. Os erros vêm primeiro e abertos; os acertos ficam recolhidos.
export const Correcao = ({
  perguntas,
  nomeProva,
  aoRefazer,
  aoResponderFaltaram,
  ...ligacoes
}: Ligacoes & {
  perguntas: PerguntaDaAula[];
  nomeProva: string;
  aoRefazer: () => void;
  aoResponderFaltaram: () => void;
}) => {
  const [verAcertos, setVerAcertos] = useState(false);
  const [destaque, setDestaque] = useState<string | null>(null);
  const respondidas = perguntas.filter((p) => p.resposta);
  const erradas = respondidas.filter((p) => !p.resposta!.acertou);
  const certas = respondidas.filter((p) => p.resposta!.acertou);
  const faltam = perguntas.filter((p) => !p.resposta);
  const paraRefazer = erradas.filter((p) => !p.resposta!.refeita);
  const simulado = perguntas.filter((p) => p.tipo === "simulado");
  const doReel = perguntas.filter((p) => p.tipo === "reel");
  const assuntos = porConceito(respondidas.map((p) => p.resposta!));
  const pontoFraco = assuntos.find((a) => a.acertos < a.total);

  const irPara = (p: PerguntaDaAula) => {
    if (!p.resposta) {
      document.getElementById("correcao-faltaram")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (p.resposta.acertou) setVerAcertos(true);
    setDestaque(p.chave);
    setTimeout(() => setDestaque((d) => (d === p.chave ? null : d)), 1800);
    // Espera a lista de acertos abrir antes de rolar.
    setTimeout(() => document.getElementById(`correcao-${p.chave}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  const linhaDoGabarito = (rotulo: string, lista: PerguntaDaAula[]) =>
    lista.length > 0 && (
      <div className="gabarito-linha">
        <div className="gabarito-rotulo">
          {rotulo}
          <span>
            {lista.filter((p) => p.resposta?.acertou).length} de {lista.length}
          </span>
        </div>
        <div className="gabarito-bolhas">
          {lista.map((p) => {
            const estado = !p.resposta ? "vazia" : p.resposta.acertou ? "certa" : "errada";
            return (
              <button
                key={p.chave}
                className={`bolha ${estado}${p.resposta?.refeita ? " refeita" : ""}`}
                onClick={() => irPara(p)}
                aria-label={`${nomeDa(p)}: ${estado === "vazia" ? "sem resposta" : estado === "certa" ? "acertou" : "errou"}`}
              >
                <span>{p.numero}</span>
                <i>{estado === "vazia" ? "–" : estado === "certa" ? "✓" : "✗"}</i>
              </button>
            );
          })}
        </div>
      </div>
    );

  return (
    <section className="resultado-cartao correcao" id="correcao">
      <div className="secao-topo">
        <h3>{erradas.length > 0 ? "📍 Onde você errou" : respondidas.length > 0 ? "✅ Sua correção" : "📝 Sua correção"}</h3>
        <p>
          {paraRefazer.length > 0
            ? `${paraRefazer.length === 1 ? "1 pergunta" : `${paraRefazer.length} perguntas`} para corrigir. Toque num número para ir direto nela.`
            : erradas.length > 0
              ? `Você acertou na 2ª chance ${erradas.length === 1 ? "a que tinha errado" : `as ${erradas.length} que tinha errado`}. Releia o porquê para não cair de novo.`
              : respondidas.length > 0
                ? "Nenhum erro nas perguntas que você respondeu."
                : "Você ainda não respondeu as perguntas desta aula."}
        </p>
      </div>

      <div className="gabarito">
        {linhaDoGabarito(`Simulado ${nomeProva}`, simulado)}
        {linhaDoGabarito("Perguntas dos reels", doReel)}
      </div>

      {assuntos.length > 0 && (
        <div className="assuntos">
          <div className="rotulo">Acertos por assunto</div>
          {assuntos.map((a) => {
            const fraco = a === pontoFraco;
            const reel = ligacoes.reelDe(a.conceito);
            const emoji = ligacoes.emojiDe(a.conceito);
            return (
              <div key={a.conceito} className={fraco ? "assunto fraco" : "assunto"}>
                <div className="assunto-topo">
                  <span className="assunto-nome">
                    {emoji && <span className="assunto-emoji">{emoji}</span>}
                    {a.conceito}
                  </span>
                  <span className={a.acertos === a.total ? "assunto-nota cheia" : "assunto-nota"}>
                    {a.acertos}/{a.total}
                  </span>
                </div>
                <div className="assunto-barra" aria-hidden>
                  {a.respostas.map((r) => (
                    <i key={r.chave} className={r.acertou ? "certa" : r.refeita ? "refeita" : "errada"} />
                  ))}
                </div>
                {fraco && (
                  <div className="assunto-fraco">
                    <span>
                      {a.respostas.every((r) => r.acertou || r.refeita) ? "💪 Era seu ponto fraco, e você corrigiu" : "🎯 Seu ponto fraco nesta aula"}
                    </span>
                    {reel >= 0 && (
                      <button className="link-rever" onClick={() => ligacoes.aoReverReel(reel)}>
                        ▶ Rever o reel
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(paraRefazer.length > 0 || faltam.length > 0) && (
        <div className="correcao-acoes" id="correcao-faltaram">
          {paraRefazer.length > 0 && (
            <button className="botao-principal botao-refazer" onClick={aoRefazer}>
              🔁 Refazer {paraRefazer.length === 1 ? "a que errei" : `as ${paraRefazer.length} que errei`}
            </button>
          )}
          {faltam.length > 0 && (
            <button className={paraRefazer.length > 0 ? "botao-secundario largo" : "botao-principal"} onClick={aoResponderFaltaram}>
              ✍️ Responder {faltam.length === 1 ? "a que faltou" : `as ${faltam.length} que faltaram`}
            </button>
          )}
        </div>
      )}

      {erradas.map((p) => (
        <CartaoDaCorrecao key={p.chave} p={p} destacado={destaque === p.chave} {...ligacoes} />
      ))}

      {certas.length > 0 && (
        <>
          <button className="ver-acertos" onClick={() => setVerAcertos((v) => !v)} aria-expanded={verAcertos}>
            {verAcertos ? "▲ Esconder" : "▼ Ver"} {certas.length === 1 ? "a que você acertou" : `as ${certas.length} que você acertou`}
          </button>
          {verAcertos && certas.map((p) => <CartaoDaCorrecao key={p.chave} p={p} destacado={destaque === p.chave} {...ligacoes} />)}
        </>
      )}
    </section>
  );
};

const CartaoDaCorrecao = ({ p, destacado, reelDe, lembreteDe, aoReverReel }: Ligacoes & { p: PerguntaDaAula; destacado: boolean }) => {
  const r = p.resposta!;
  const q = p.questao;
  const certa = q.correta;
  const marcou = r.escolhida;
  const reel = reelDe(p.conceito);
  const lembrete = lembreteDe(p.conceito);
  const porQueErrou = !r.acertou ? q.porQue?.[marcou] : undefined;
  const porQueCerta = q.porQue?.[certa] || q.explicacao;

  return (
    <article
      id={`correcao-${p.chave}`}
      className={`questao-corrigida ${r.acertou ? "acertou" : "errou"}${r.refeita ? " refeita" : ""}${destacado ? " destacada" : ""}`}
    >
      <div className="qc-topo">
        <span className="qc-nome">{nomeDa(p)}</span>
        {r.acertou ? (
          <span className="qc-selo certo">✓ Acertou</span>
        ) : r.refeita ? (
          <span className="qc-selo virou">💪 Acertou na 2ª chance</span>
        ) : (
          <span className="qc-selo errado">✗ Errou</span>
        )}
      </div>
      <div className="qc-conceito">{p.conceito}</div>

      {q.textoBase && (
        <details className="qc-texto-base">
          <summary>Ver o texto-base</summary>
          <p>{q.textoBase}</p>
        </details>
      )}
      <p className="qc-pergunta">{q.pergunta}</p>

      <ol className="qc-alternativas">
        {q.alternativas.map((alt, i) => {
          const classe = i === certa ? "certa" : i === marcou ? "errada" : "";
          return (
            <li key={i} className={classe}>
              <span className="letra">{LETRAS[i]}</span>
              <span className="qc-texto">{alt}</span>
              {i === marcou && <span className="qc-marca">{i === certa ? "Sua resposta ✓" : "Sua resposta"}</span>}
              {i === certa && i !== marcou && <span className="qc-marca">Gabarito</span>}
            </li>
          );
        })}
      </ol>

      {porQueErrou && (
        <p className="qc-porque errou">
          <strong>Por que a {LETRAS[marcou]} está errada:</strong> {porQueErrou}
        </p>
      )}
      {porQueCerta && (
        <p className="qc-porque certo">
          <strong>Por que a {LETRAS[certa]} está certa:</strong> {porQueCerta}
        </p>
      )}
      {!r.acertou && lembrete && (
        <p className="qc-lembrete">
          <strong>Para lembrar:</strong> {lembrete}
        </p>
      )}
      {!r.acertou && reel >= 0 && (
        <button className="link-rever" onClick={() => aoReverReel(reel)}>
          ▶ Rever o reel: {p.conceito}
        </button>
      )}
    </article>
  );
};
