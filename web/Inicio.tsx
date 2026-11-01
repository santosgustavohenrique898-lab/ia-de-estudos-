import { useEffect, useRef, useState } from "react";
import { Player } from "@remotion/player";
import { CenaVisual } from "../src/remotion/templates/CenaVisual";
import type { Cena } from "../src/schema";
import type { Objetivo } from "../src/pipeline/estilo";
import { MODO_ARTEFATO, statusServidor } from "./api";
import type { LimitesDeFoto } from "./artefato";
import { Fundo3D, useParallax } from "./Efeitos3D";
import {
  apagarAula,
  aulaCurtida,
  diaDe,
  ofensivaAtual,
  pendentes,
  proximaRevisao,
  quando,
  respostasHoje,
  somarDias,
  trocarMeta,
  useProgresso,
} from "./progresso";

export type { Objetivo };
export type Pedido = {
  tipo: "tema" | "texto" | "pdf" | "foto";
  // Tema ou texto digitado; para PDF, o nome do arquivo; para fotos, quantas são.
  conteudo: string;
  arquivo?: File;
  fotos?: File[];
  objetivo: Objetivo;
  reels: number;
};

const SUGESTOES = ["Revolução Francesa", "Fotossíntese", "Leis de Newton", "Uso da crase", "Direito Constitucional"];
const OBJETIVOS: Objetivo[] = ["ENEM", "Vestibular", "Concurso", "Faculdade"];

const CENA_VITRINE: Cena = {
  template: "lista",
  fala: "",
  titulo: "Sua matéria vira isto",
  itens: ["Reels de 60 segundos", "Voz explicando", "Pergunta no final"],
};

const quandoFoi = (ms: number) => {
  const dia = diaDe(new Date(ms));
  const hoje = diaDe();
  if (dia === hoje) return "hoje";
  if (dia === somarDias(hoje, -1)) return "ontem";
  const [, m, d] = dia.split("-");
  return `${d}/${m}`;
};

type Foto = { arquivo: File; url: string };

export const Inicio = ({
  aoGerar,
  aoAbrirAula,
  aoRevisar,
  aviso,
}: {
  aoGerar: (p: Pedido) => void;
  aoAbrirAula: (id: string) => void;
  aoRevisar: () => void;
  aviso: string | null;
}) => {
  const [tipo, setTipo] = useState<Pedido["tipo"]>("tema");
  const [tema, setTema] = useState("");
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const [objetivo, setObjetivo] = useState<Objetivo>("ENEM");
  const [reels, setReels] = useState(3);
  const seletor = useRef<HTMLInputElement>(null);
  const seletorFoto = useRef<HTMLInputElement>(null);
  const campoTema = useRef<HTMLInputElement>(null);
  const [semIA, setSemIA] = useState(false);
  const [vozHumana, setVozHumana] = useState(false);
  const [limitesFoto, setLimitesFoto] = useState<LimitesDeFoto | null>(null);
  const [verTodas, setVerTodas] = useState(false);
  const [apagando, setApagando] = useState<string | null>(null);
  const progresso = useProgresso();
  const fotosAtuais = useRef<Foto[]>([]);
  fotosAtuais.current = fotos;
  useParallax();

  // No computador, o campo do tema já começa ativo. No celular não: abriria o teclado e esconderia o painel.
  useEffect(() => {
    if (window.matchMedia?.("(pointer: fine)").matches) campoTema.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    statusServidor().then((s) => {
      setSemIA(s === null || !s.ia);
      setVozHumana(Boolean(s?.voz));
      setLimitesFoto(s?.fotos ?? null);
    });
    return () => fotosAtuais.current.forEach((f) => URL.revokeObjectURL(f.url));
  }, []);

  const adicionarFotos = (lista: FileList | null) => {
    if (!lista || !limitesFoto) return;
    const novas: Foto[] = [];
    let problema: string | null = null;
    for (const arq of Array.from(lista)) {
      if (fotos.length + novas.length >= limitesFoto.maximo) {
        problema = `Dá para enviar até ${limitesFoto.maximo} fotos por aula.`;
        break;
      }
      if (limitesFoto.tipos.length > 0 && !limitesFoto.tipos.includes(arq.type)) {
        problema = "Essa foto está num formato que o Claude não lê. Use JPG ou PNG.";
        continue;
      }
      if (arq.size > limitesFoto.bytes) {
        problema = `Uma das fotos passa de ${Math.floor(limitesFoto.bytes / 1024 / 1024)} MB. Tire com qualidade menor.`;
        continue;
      }
      novas.push({ arquivo: arq, url: URL.createObjectURL(arq) });
    }
    setErroFoto(problema);
    setFotos((f) => [...f, ...novas]);
  };

  const removerFoto = (i: number) => {
    URL.revokeObjectURL(fotos[i].url);
    setFotos((f) => f.filter((_, k) => k !== i));
    setErroFoto(null);
  };

  const conteudo =
    tipo === "tema"
      ? tema.trim()
      : tipo === "texto"
        ? texto.trim()
        : tipo === "pdf"
          ? (arquivo?.name ?? "")
          : fotos.length === 1
            ? "1 foto"
            : `${fotos.length} fotos`;
  const pdfGrande = tipo === "pdf" && (arquivo?.size ?? 0) > 15 * 1024 * 1024;
  const pronto =
    tipo === "texto" ? conteudo.length >= 200 : tipo === "foto" ? fotos.length > 0 : conteudo.length > 0 && !pdfGrande;
  const gerar = () =>
    pronto &&
    aoGerar({
      tipo,
      conteudo,
      arquivo: tipo === "pdf" ? (arquivo ?? undefined) : undefined,
      fotos: tipo === "foto" ? fotos.map((f) => f.arquivo) : undefined,
      objetivo,
      reels,
    });

  const abas: [Pedido["tipo"], string][] = [
    ["tema", "✏️ Tema"],
    ["texto", "📋 Texto"],
    ["pdf", "📄 PDF"],
  ];
  if (limitesFoto) abas.push(["foto", "📷 Foto"]);

  // Progresso guardado: aparece depois da primeira aula.
  const carregado = progresso.fonte !== "carregando";
  const temHistorico = carregado && (progresso.perfil.xp > 0 || progresso.cartoes.length > 0 || progresso.aulas.length > 0);
  const feitasHoje = respostasHoje(progresso.perfil);
  const meta = progresso.perfil.metaDiaria;
  const ofensiva = ofensivaAtual(progresso.perfil);
  const paraRevisar = pendentes(progresso).length;
  const proxima = proximaRevisao(progresso);
  // Aulas com algum reel curtido sobem para o topo, mantendo a ordem de data entre elas.
  const aulas = [...progresso.aulas].sort((a, b) => Number(aulaCurtida(progresso, b.id)) - Number(aulaCurtida(progresso, a.id)));

  return (
    <div className="inicio">
      <Fundo3D />
      <header className="topo">
        <div className="logo">
          <span className="logo-icone">▶</span> LearningFlix
        </div>
        <nav className="topo-links">
          {temHistorico && ofensiva > 0 ? <span className="topo-fogo">🔥 {ofensiva}</span> : <a href="#como-funciona">Como funciona</a>}
        </nav>
      </header>

      <main className="hero">
        <section className="hero-texto">
          <div className="etiqueta-hero">✦ Feito para ENEM, vestibular e concurso</div>
          <h1>
            Chega de videoaula de 2 horas.
            <br />
            <span className="grad">Aprenda qualquer matéria rolando reels.</span>
          </h1>
          <p className="sub">
            {limitesFoto
              ? "Coloque o assunto, cole seu resumo, envie a apostila ou tire foto do caderno. "
              : "Coloque o assunto, cole seu resumo ou envie a apostila. "}
            A IA transforma em reels curtos, animados e com voz, faz perguntas no meio e um simulado no fim.
          </p>

          {temHistorico && (
            <div className="painel">
              <div className="painel-numeros">
                <div className={ofensiva > 0 ? "painel-num fogo" : "painel-num"}>
                  <strong>🔥 {ofensiva}</strong>
                  <span>{ofensiva === 1 ? "dia seguido" : "dias seguidos"}</span>
                </div>
                <button className={feitasHoje >= meta ? "painel-num meta feita" : "painel-num meta"} onClick={trocarMeta} title="Toque para trocar a meta">
                  <strong>
                    🎯 {Math.min(feitasHoje, meta)}/{meta}
                  </strong>
                  <span>{feitasHoje >= meta ? "meta batida! · trocar" : "meta de hoje · trocar"}</span>
                  <i style={{ width: `${Math.min(1, feitasHoje / meta) * 100}%` }} />
                </button>
                <div className="painel-num">
                  <strong>⚡ {progresso.perfil.xp}</strong>
                  <span>XP total</span>
                </div>
              </div>
              {paraRevisar > 0 ? (
                <button className="chamada-revisao" onClick={aoRevisar}>
                  <span className="chamada-icone">↻</span>
                  <span className="chamada-texto">
                    <strong>Revisão de hoje</strong>
                    <small>{paraRevisar === 1 ? "1 pergunta esperando por você" : `${paraRevisar} perguntas esperando por você`}</small>
                  </span>
                  <span className="chamada-seta">Revisar →</span>
                </button>
              ) : proxima ? (
                <div className="revisao-futura">
                  ↻ Próxima revisão {quando(proxima.dia)}: {proxima.quantidade} {proxima.quantidade === 1 ? "pergunta" : "perguntas"}
                </div>
              ) : (
                <div className="revisao-futura">↻ Nada para revisar. O que você errar volta aqui no dia seguinte.</div>
              )}
              {progresso.fonte !== "conta" && (
                <div className="painel-nota">
                  {progresso.fonte === "aparelho"
                    ? "Seu progresso fica salvo neste aparelho."
                    : "Este navegador não deixa salvar: o progresso some quando você fechar a página."}
                </div>
              )}
            </div>
          )}
          {aviso && <div className="erro-linha aviso-inicio">{aviso}</div>}

          <div className="cartao-entrada">
            <div className="abas" role="tablist">
              {abas.map(([valor, rotulo]) => (
                <button key={valor} role="tab" aria-selected={tipo === valor} className={tipo === valor ? "aba ativa" : "aba"} onClick={() => setTipo(valor)}>
                  {rotulo}
                </button>
              ))}
            </div>

            {tipo === "tema" && (
              <>
                <input
                  ref={campoTema}
                  className="campo"
                  placeholder="O que você quer aprender hoje?"
                  value={tema}
                  onChange={(e) => setTema(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && gerar()}
                />
                <div className="sugestoes">
                  {SUGESTOES.map((s) => (
                    <button key={s} className="chip" onClick={() => setTema(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}

            {tipo === "texto" && (
              <>
                <textarea
                  className="campo area"
                  placeholder="Cole aqui seu resumo, anotação ou trecho da apostila (mínimo de 200 caracteres)"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                />
                <div className="dica">{texto.trim().length} caracteres</div>
              </>
            )}

            {tipo === "pdf" && (
              <button className="soltar" onClick={() => seletor.current?.click()}>
                <input ref={seletor} type="file" accept="application/pdf" hidden onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
                {arquivo ? (
                  <>
                    <strong>{arquivo.name}</strong>
                    <span>{(arquivo.size / 1024 / 1024).toFixed(1)} MB · toque para trocar</span>
                  </>
                ) : (
                  <>
                    <strong>Toque para escolher o PDF</strong>
                    <span>apostila, slide da aula, capítulo do livro</span>
                  </>
                )}
              </button>
            )}

            {tipo === "foto" && limitesFoto && (
              <>
                <input
                  ref={seletorFoto}
                  type="file"
                  accept={limitesFoto.tipos.length ? limitesFoto.tipos.join(",") : "image/*"}
                  multiple
                  hidden
                  onChange={(e) => {
                    adicionarFotos(e.target.files);
                    e.target.value = "";
                  }}
                />
                {fotos.length > 0 && (
                  <div className="fotos">
                    {fotos.map((f, i) => (
                      <div key={f.url} className="foto">
                        <img src={f.url} alt={`Foto ${i + 1}`} />
                        <button onClick={() => removerFoto(i)} aria-label={`Tirar a foto ${i + 1}`}>
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {fotos.length < limitesFoto.maximo && (
                  <button className="soltar" onClick={() => seletorFoto.current?.click()}>
                    <strong>{fotos.length ? "Adicionar outra página" : "Tirar foto ou escolher da galeria"}</strong>
                    <span>caderno, apostila, livro ou lousa · até {limitesFoto.maximo} fotos, com a letra bem visível</span>
                  </button>
                )}
              </>
            )}

            {pdfGrande && <div className="erro-linha">O PDF passa de 15 MB. Envie só o capítulo que você quer estudar.</div>}
            {tipo === "foto" && erroFoto && <div className="erro-linha">{erroFoto}</div>}

            <div className="linha-opcoes">
              <div>
                <div className="rotulo">Estou estudando para</div>
                <div className="pilulas">
                  {OBJETIVOS.map((o) => (
                    <button key={o} className={objetivo === o ? "pilula ativa" : "pilula"} onClick={() => setObjetivo(o)}>
                      {o}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="rotulo">Tamanho da aula</div>
                <div className="pilulas">
                  <button className={reels === 3 ? "pilula ativa" : "pilula"} onClick={() => setReels(3)}>
                    Rápida · 3 reels
                  </button>
                  <button className={reels === 6 ? "pilula ativa" : "pilula"} onClick={() => setReels(6)}>
                    Completa · 6 reels
                  </button>
                </div>
              </div>
            </div>

            <button className="botao-principal" disabled={!pronto} onClick={gerar}>
              Gerar minha aula em reels
            </button>
            {semIA && (
              <div className="erro-linha">
                {MODO_ARTEFATO
                  ? "Para gerar aulas, abra este link dentro do Claude (no site claude.ai ou no app)."
                  : "O servidor ainda não está ligado à IA. Veja o guia de configuração no README."}
              </div>
            )}
          </div>

          {carregado && progresso.aulas.length > 0 && (
            <section className="suas-aulas">
              <div className="rotulo">Suas aulas · assista de novo sem esperar</div>
              {aulas.slice(0, verTodas ? aulas.length : 4).map((a) => (
                <div key={a.id} className="aula-salva">
                  <button className="aula-salva-abrir" onClick={() => aoAbrirAula(a.id)}>
                    <span className="aula-salva-play">▶</span>
                    <span className="aula-salva-texto">
                      <strong>
                        {aulaCurtida(progresso, a.id) && (
                          <span className="aula-curtida" aria-label="Aula curtida">
                            ♥
                          </span>
                        )}
                        {a.titulo}
                      </strong>
                      <small>
                        {a.reels} reels{a.questoes ? ` · simulado de ${a.questoes}` : ""} · {a.objetivo} · {quandoFoi(a.criadaEm)}
                      </small>
                    </span>
                  </button>
                  <button
                    className={apagando === a.id ? "aula-salva-apagar confirmar" : "aula-salva-apagar"}
                    onClick={() => (apagando === a.id ? (apagarAula(a.id), setApagando(null)) : setApagando(a.id))}
                    onBlur={() => setApagando((x) => (x === a.id ? null : x))}
                    aria-label={`Apagar a aula ${a.titulo}`}
                  >
                    {apagando === a.id ? "Apagar?" : "✕"}
                  </button>
                </div>
              ))}
              {progresso.aulas.length > 4 && (
                <button className="ver-todas" onClick={() => setVerTodas((v) => !v)}>
                  {verTodas ? "Ver menos" : `Ver todas (${progresso.aulas.length})`}
                </button>
              )}
            </section>
          )}
        </section>

        <aside className="vitrine" aria-hidden>
          <div className="palco3d">
            <div className="celular">
              <div className="celular-tela">
                <Player
                  component={CenaVisual}
                  inputProps={{ cena: CENA_VITRINE, cor: "#6C4CF5" }}
                  durationInFrames={150}
                  fps={30}
                  compositionWidth={1080}
                  compositionHeight={1920}
                  style={{ width: "100%", height: "100%" }}
                  autoPlay
                  loop
                  controls={false}
                  acknowledgeRemotionLicense
                />
                <div className="legenda-falsa">
                  e no fim, <span>uma pergunta</span>
                </div>
              </div>
            </div>
            <div className="chip3d chip-xp">⚡ +15 XP</div>
            <div className="chip3d chip-certo">✓ Mandou bem!</div>
            <div className="chip3d chip-fogo">🔥 5 dias seguidos</div>
            <div className="chip3d chip-voz">{vozHumana ? "🎙️ Voz humana" : "🎙️ Com narração"}</div>
            <div className="sombra-chao" />
          </div>
        </aside>
      </main>

      <section className="passos" id="como-funciona">
        {[
          ["1", "Você coloca a matéria", limitesFoto ? "Um tema, um resumo, a apostila em PDF ou a foto do caderno." : "Um tema, um resumo ou a apostila em PDF."],
          ["2", "A IA monta a aula", "Separa os conceitos e escreve reels curtos, com perguntas e um simulado no fim."],
          ["3", "Você rola e aprende", "O que você errar volta na revisão 1, 3 e 7 dias depois, até ficar na memória."],
        ].map(([n, t, d]) => (
          <div key={n} className="passo">
            <div className="passo-n">{n}</div>
            <div>
              <strong>{t}</strong>
              <p>{d}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
};
