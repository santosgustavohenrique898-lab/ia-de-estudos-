import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { AulaAtual, Construcao, Desempenho, RespostaDada } from "./main";
import type { ReelPronto } from "./api";
import { Fundo3D } from "./Efeitos3D";
import { NOME_PROVA, cartaoDaQuestao, cartaoDoReel, lembreteDoReel, textoDaMeta } from "./Feed";
import { chaveDoReel, ofensivaAtual, registrarErro, registrarResposta, respostasHoje, useProgresso } from "./progresso";
import { baixarArquivo, imagemDoResumo, nomeDoArquivo } from "./resumoImagem";
import { FAIXAS, ORDEM_DAS_FAIXAS, conquistasDaAula, emojiDoReel, faixaDe, fraseDoResultado, nivelDe, reelDoConceito, simplificar } from "./resultado";
import { useContagem } from "./animacao";
import { Medalha } from "./Medalha";
import { Confete } from "./Confete";
import { Correcao, type PerguntaDaAula } from "./Correcao";
import { CapasDosReels, type CapaDoReel } from "./Capas";
import { Desafio, type ItemDoDesafio, type ModoDoDesafio, type Retorno } from "./Desafio";
import { ReelSobreposto } from "./ReelSobreposto";
import { embaralharQuestao } from "./questoes";

// XP de refazer uma pergunta que errou: menos que acertar de primeira, para valer a pena prestar atenção na hora.
const XP_REFAZER = 5;

export const Resumo = ({
  aula,
  construcao,
  desempenho,
  setDesempenho,
  aoNovaAula,
}: {
  aula: AulaAtual;
  construcao: Construcao;
  desempenho: Desempenho;
  setDesempenho: Dispatch<SetStateAction<Desempenho>>;
  aoNovaAula: () => void;
}) => {
  const progresso = useProgresso();
  const [baixando, setBaixando] = useState(false);
  const [situacao, setSituacao] = useState<string | null>(null);
  const [reelAberto, setReelAberto] = useState<number | null>(null);
  const [desafio, setDesafio] = useState<{ modo: ModoDoDesafio; itens: ItemDoDesafio[] } | null>(null);

  const titulo = construcao.titulo || "Sua aula";
  const nomeProva = NOME_PROVA[aula.objetivo];
  const prontos = useMemo(() => construcao.reels.filter((r): r is ReelPronto => Boolean(r) && r !== "descartado"), [construcao.reels]);
  const conceitosDosReels = prontos.map((p) => p.reel.conceito);
  const respostaPor = new Map(desempenho.respostas.map((r) => [r.chave, r]));

  // Todas as perguntas da aula, respondidas ou não: primeiro o simulado, depois as dos reels.
  const perguntas: PerguntaDaAula[] = [
    ...construcao.simulado.map((q, k) => ({
      chave: `s${k}`,
      tipo: "simulado" as const,
      numero: k + 1,
      conceito: q.conceito || titulo,
      questao: q,
      resposta: respostaPor.get(`s${k}`),
    })),
    ...prontos.map((p, i) => ({
      chave: `r${i}`,
      tipo: "reel" as const,
      numero: i + 1,
      conceito: p.reel.conceito,
      questao: { ...p.reel.quiz, conceito: p.reel.conceito },
      resposta: respostaPor.get(`r${i}`),
    })),
  ];

  // Números da aula. A nota conta todas as perguntas, inclusive as do simulado que ainda está chegando.
  const simuladoChegando = construcao.simuladoEstado === "gerando";
  const totalDaAula = prontos.length + (simuladoChegando ? Math.max(construcao.simuladoTotal, construcao.simulado.length) : construcao.simulado.length);
  const respondidas = desempenho.respostas.length;
  const acertos = desempenho.respostas.filter((r) => r.acertou).length;
  const base = Math.max(totalDaAula, respondidas);
  const semResposta = perguntas.filter((p) => !p.resposta).length;
  const pct = respondidas && base ? (acertos / base) * 100 : 0;
  const faixa = faixaDe(acertos, respondidas, totalDaAula);
  const carregado = progresso.fonte !== "carregando";
  const ofensiva = ofensivaAtual(progresso.perfil);
  const feitasHoje = respostasHoje(progresso.perfil);
  const meta = progresso.perfil.metaDiaria;
  const xpAntes = Math.max(0, progresso.perfil.xp - desempenho.xp);
  const nivelAntes = nivelDe(xpAntes);
  const nivelAgora = nivelDe(progresso.perfil.xp);
  const subiu = carregado && desempenho.xp > 0 && nivelAgora.nivel > nivelAntes.nivel ? nivelAgora.nivel : null;

  const pctAnimado = useContagem(pct, { duracao: 1300, atraso: 350 });
  const xpAnimado = useContagem(desempenho.xp, { duracao: 1300, atraso: 350 });
  const nivelAnimado = useContagem(carregado ? nivelAgora.fracao : 0, { de: subiu ? 0 : nivelAntes.fracao, duracao: 1500, atraso: 700 });

  // Confete ao abrir com medalha boa, e de novo se a medalha subir depois (respondendo o que faltou).
  const [confete, setConfete] = useState(FAIXAS[faixa].confete ? 1 : 0);
  const faixaAntes = useRef(faixa);
  useEffect(() => {
    if (ORDEM_DAS_FAIXAS.indexOf(faixa) > ORDEM_DAS_FAIXAS.indexOf(faixaAntes.current) && FAIXAS[faixa].confete) setConfete((c) => c + 1);
    faixaAntes.current = faixa;
  }, [faixa]);

  const vistos = new Set(desempenho.vistos.map(simplificar));
  const errouNo = new Set(desempenho.respostas.filter((r) => !r.acertou && !r.refeita).map((r) => simplificar(r.conceito)));
  const capas: CapaDoReel[] = prontos.map((pronto, indice) => ({
    pronto,
    indice,
    curtido: progresso.curtidas.includes(chaveDoReel(aula.id, indice)),
    errou: errouNo.has(simplificar(pronto.reel.conceito)),
  }));
  const vistas = capas.filter((c) => vistos.has(simplificar(c.pronto.reel.conceito)));
  const naoVistas = capas.filter((c) => !vistos.has(simplificar(c.pronto.reel.conceito)));

  const conquistas = conquistasDaAula({
    faixa,
    respostas: desempenho.respostas,
    totalSimulado: construcao.simulado.length,
    melhorSequencia: desempenho.melhorSequencia,
    reelsVistos: vistas.length,
    totalReels: prontos.length,
    nivelNovo: subiu,
    primeiraAula: carregado && xpAntes === 0 && respondidas > 0,
    metaBatida: carregado && feitasHoje >= meta,
    ofensiva,
  });

  const reelDe = (conceito: string) => reelDoConceito(conceitosDosReels, conceito);
  const ligacoes = {
    reelDe,
    emojiDe: (conceito: string) => {
      const i = reelDe(conceito);
      return i >= 0 ? emojiDoReel(prontos[i].reel) : null;
    },
    lembreteDe: (conceito: string) => {
      const i = reelDe(conceito);
      return i >= 0 ? lembreteDoReel(prontos[i]) : undefined;
    },
    aoReverReel: (i: number) => setReelAberto(i),
  };

  const itemDe = (p: PerguntaDaAula, embaralhar: boolean): ItemDoDesafio => ({
    chave: p.chave,
    tipo: p.tipo,
    numero: p.numero,
    conceito: p.conceito,
    questao: embaralhar ? embaralharQuestao(p.questao) : p.questao,
    lembrete: ligacoes.lembreteDe(p.conceito),
  });
  const refazer = () =>
    setDesafio({
      modo: "refazer",
      itens: perguntas.filter((p) => p.resposta && !p.resposta.acertou && !p.resposta.refeita).map((p) => itemDe(p, true)),
    });
  // O que ficou sem resposta: primeiro as perguntas dos reels, depois o simulado, na ordem da aula.
  const responderFaltaram = () =>
    setDesafio({
      modo: "faltaram",
      itens: [...perguntas.filter((p) => p.tipo === "reel"), ...perguntas.filter((p) => p.tipo === "simulado")]
        .filter((p) => !p.resposta)
        .map((p) => itemDe(p, false)),
    });

  const responderNoDesafio = (modo: ModoDoDesafio) => (item: ItemDoDesafio, acertou: boolean, escolhida: number): Retorno => {
    if (modo === "refazer") {
      // Refazer dá XP e conta para a meta do dia, mas não muda a nota da aula.
      const xp = acertou ? XP_REFAZER : 0;
      const dia = registrarResposta(acertou, xp);
      setDesempenho((d) => ({
        ...d,
        xp: d.xp + xp,
        respostas: d.respostas.map((r) => (r.chave === item.chave && acertou ? { ...r, refeita: true } : r)),
      }));
      return { xp, aviso: dia.bateuMeta ? textoDaMeta(dia.ofensiva) : null };
    }
    // Responder o que faltou conta como resposta da aula, como no feed.
    const xp = acertou ? 10 : 2;
    const dia = registrarResposta(acertou, xp);
    const resposta: RespostaDada = {
      chave: item.chave,
      tipo: item.tipo,
      numero: item.numero,
      conceito: item.conceito,
      questao: item.questao,
      escolhida,
      acertou,
    };
    setDesempenho((d) => ({
      ...d,
      xp: d.xp + xp,
      acertos: d.acertos + (acertou ? 1 : 0),
      respondidas: d.respondidas + 1,
      revisar: acertou || d.revisar.includes(item.conceito) ? d.revisar : [...d.revisar, item.conceito],
      vistos: item.tipo === "reel" && !d.vistos.includes(item.conceito) ? [...d.vistos, item.conceito] : d.vistos,
      respostas: [...d.respostas.filter((r) => r.chave !== item.chave), resposta],
    }));
    if (!acertou) {
      if (item.tipo === "reel") registrarErro(cartaoDoReel(aula, titulo, item.numero - 1, prontos[item.numero - 1]));
      else registrarErro(cartaoDaQuestao(aula, titulo, item.numero - 1, construcao.simulado[item.numero - 1]));
    }
    return { xp, aviso: dia.bateuMeta ? textoDaMeta(dia.ofensiva) : null };
  };

  const marcarVisto = (conceito: string) =>
    setDesempenho((d) => (d.vistos.includes(conceito) ? d : { ...d, vistos: [...d.vistos, conceito] }));

  const baixar = async () => {
    setBaixando(true);
    setSituacao(null);
    try {
      const imagem = await imagemDoResumo({
        titulo,
        objetivo: aula.objetivo,
        conceitos: vistas.map((c) => ({ nome: c.pronto.reel.conceito, frase: lembreteDoReel(c.pronto) ?? "" })),
        acertos,
        respondidas: respondidas ? base : 0,
        xp: desempenho.xp,
      });
      const r = await baixarArquivo(imagem, nomeDoArquivo(titulo));
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
      {confete > 0 && <Confete rodada={confete} />}
      <main className="resultado">
        <section className={`resultado-cartao heroi faixa-${faixa}`}>
          <div className="heroi-medalha" key={faixa}>
            <Medalha faixa={faixa} />
          </div>
          <h2 className="heroi-titulo">{FAIXAS[faixa].titulo}</h2>
          <p className="heroi-frase">{fraseDoResultado(acertos, respondidas, totalDaAula)}</p>
          <p className="heroi-aula">{titulo}</p>

          <div className="numeros">
            {respondidas > 0 ? (
              <div>
                <strong>{Math.round(pctAnimado)}%</strong>
                <span>
                  {acertos} de {base} {base === 1 ? "certa" : "certas"}
                </span>
              </div>
            ) : (
              <div>
                <strong>0/{base}</strong>
                <span>respondidas</span>
              </div>
            )}
            <div>
              <strong>⚡ {Math.round(xpAnimado)}</strong>
              <span>XP ganho</span>
            </div>
            {ofensiva > 0 || !carregado ? (
              <div>
                <strong>🔥 {ofensiva}</strong>
                <span>{ofensiva === 1 ? "dia seguido" : "dias seguidos"}</span>
              </div>
            ) : (
              <div>
                <strong>
                  🎯 {Math.min(feitasHoje, meta)}/{meta}
                </strong>
                <span>meta de hoje</span>
              </div>
            )}
          </div>

          {carregado && (
            <div className={subiu ? "nivel subiu" : "nivel"}>
              <div className="nivel-topo">
                <span className="nivel-selo">Nível {nivelAgora.nivel}</span>
                <span className="nivel-xp">
                  {progresso.perfil.xp - nivelAgora.inicio} / {nivelAgora.fim - nivelAgora.inicio} XP para o nível {nivelAgora.nivel + 1}
                </span>
              </div>
              <div className="nivel-barra">
                <span style={{ width: `${nivelAnimado * 100}%` }} />
              </div>
              {subiu && <div className="nivel-aviso">🚀 Subiu para o nível {subiu}!</div>}
            </div>
          )}

          {semResposta > 0 && (
            <button className="botao-principal heroi-acao" onClick={responderFaltaram}>
              {respondidas === 0
                ? "✍️ Responder as perguntas e ganhar minha medalha"
                : `✍️ Responder ${semResposta === 1 ? "a que faltou" : `as ${semResposta} que faltaram`}`}
            </button>
          )}
        </section>

        {conquistas.length > 0 && (
          <section className="resultado-cartao conquistas-cartao">
            <div className="secao-topo">
              <h3>🏅 Conquistas desta aula</h3>
            </div>
            <div className="conquistas">
              {conquistas.map((c, k) => (
                <div key={c.id} className="conquista" style={{ animationDelay: `${0.5 + k * 0.12}s` }}>
                  <span className="conquista-emoji">{c.emoji}</span>
                  <strong>{c.titulo}</strong>
                  <span>{c.detalhe}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {simuladoChegando && (
          <div className="resultado-cartao simulado-chegando">
            ⏳ Seu simulado {nomeProva} está sendo montado. Ele aparece aqui na correção assim que ficar pronto.
          </div>
        )}

        {perguntas.length > 0 && (
          <Correcao
            perguntas={perguntas}
            nomeProva={nomeProva}
            aoRefazer={refazer}
            aoResponderFaltaram={responderFaltaram}
            {...ligacoes}
          />
        )}

        {capas.length > 0 && <CapasDosReels vistas={vistas} naoVistas={naoVistas} aoAssistir={setReelAberto} />}

        <section className="resultado-cartao amanha">
          {carregado && (
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
              <div className="revisar-lista">
                {desempenho.revisar.map((c) => (
                  <span key={c} className="revisar-item">
                    ↻ {c}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="revisar">
              <div className="rotulo">Revisão</div>
              <div className="revisar-item">Nada pendente desta aula. O que você errar numa aula volta no dia seguinte.</div>
            </div>
          )}
        </section>

        <div className="resultado-acoes">
          <button className="botao-secundario largo" onClick={baixar} disabled={baixando}>
            {baixando ? "Montando a imagem…" : "📥 Baixar resumo para mandar no grupo"}
          </button>
          {situacao && <div className="situacao">{situacao}</div>}
          <button className="botao-principal" onClick={aoNovaAula}>
            Estudar outra matéria
          </button>
        </div>
      </main>

      {reelAberto !== null && prontos[reelAberto] && (
        <ReelSobreposto
          aula={aula}
          tituloDaAula={titulo}
          pronto={prontos[reelAberto]}
          indice={reelAberto}
          total={prontos.length}
          aoTerminar={() => marcarVisto(prontos[reelAberto].reel.conceito)}
          aoFechar={() => setReelAberto(null)}
        />
      )}

      {desafio && (
        <Desafio
          modo={desafio.modo}
          itens={desafio.itens}
          nomeProva={nomeProva}
          totalSimulado={construcao.simulado.length}
          aoResponder={responderNoDesafio(desafio.modo)}
          aoFechar={() => setDesafio(null)}
        />
      )}
    </div>
  );
};
