import { useEffect, useRef, useState } from "react";
import { Player } from "@remotion/player";
import { CenaVisual } from "../src/remotion/templates/CenaVisual";
import type { Cena } from "../src/schema";
import { statusServidor } from "./api";
import { Fundo3D, useParallax } from "./Efeitos3D";

export type Objetivo = "ENEM" | "Vestibular" | "Concurso" | "Faculdade";
export type Pedido = {
  tipo: "tema" | "texto" | "pdf";
  // Tema ou texto digitado; para PDF, o nome do arquivo.
  conteudo: string;
  arquivo?: File;
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

export const Inicio = ({ aoGerar }: { aoGerar: (p: Pedido) => void }) => {
  const [tipo, setTipo] = useState<Pedido["tipo"]>("tema");
  const [tema, setTema] = useState("");
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [objetivo, setObjetivo] = useState<Objetivo>("ENEM");
  const [reels, setReels] = useState(3);
  const seletor = useRef<HTMLInputElement>(null);
  const [semIA, setSemIA] = useState(false);
  useParallax();

  useEffect(() => {
    statusServidor().then((s) => setSemIA(s === null || !s.ia));
  }, []);

  const conteudo = tipo === "tema" ? tema.trim() : tipo === "texto" ? texto.trim() : arquivo?.name ?? "";
  const pdfGrande = tipo === "pdf" && (arquivo?.size ?? 0) > 15 * 1024 * 1024;
  const pronto = tipo === "texto" ? conteudo.length >= 200 : conteudo.length > 0 && !pdfGrande;
  const gerar = () => pronto && aoGerar({ tipo, conteudo, arquivo: tipo === "pdf" ? arquivo ?? undefined : undefined, objetivo, reels });

  return (
    <div className="inicio">
      <Fundo3D />
      <header className="topo">
        <div className="logo">
          <span className="logo-icone">▶</span> IA de Estudos
        </div>
        <nav className="topo-links">
          <a href="#como-funciona">Como funciona</a>
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
            Coloque o assunto, cole seu resumo ou envie a apostila. A IA transforma em reels curtos, animados e com voz,
            e no meio deles te faz perguntas para ver se você aprendeu.
          </p>

          <div className="cartao-entrada">
            <div className="abas" role="tablist">
              {(
                [
                  ["tema", "Digitar tema"],
                  ["texto", "Colar texto"],
                  ["pdf", "Enviar PDF"],
                ] as const
              ).map(([valor, rotulo]) => (
                <button key={valor} role="tab" aria-selected={tipo === valor} className={tipo === valor ? "aba ativa" : "aba"} onClick={() => setTipo(valor)}>
                  {rotulo}
                </button>
              ))}
            </div>

            {tipo === "tema" && (
              <>
                <input
                  className="campo"
                  placeholder="O que você quer aprender hoje?"
                  value={tema}
                  onChange={(e) => setTema(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && gerar()}
                  autoFocus
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

            {pdfGrande && <div className="erro-linha">O PDF passa de 15 MB. Envie só o capítulo que você quer estudar.</div>}

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
            {semIA && <div className="erro-linha">O servidor ainda não está ligado à IA. Veja o guia de configuração no README.</div>}
          </div>
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
            <div className="chip3d chip-fogo">🔥 3 seguidas</div>
            <div className="chip3d chip-voz">🎙️ Voz humana</div>
            <div className="sombra-chao" />
          </div>
        </aside>
      </main>

      <section className="passos" id="como-funciona">
        {[
          ["1", "Você coloca a matéria", "Um tema, um resumo ou a apostila em PDF."],
          ["2", "A IA monta a aula", "Separa os conceitos e confere tudo com o seu material."],
          ["3", "Você rola e aprende", "Reels animados com voz, perguntas no meio e revisão do que errou."],
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
