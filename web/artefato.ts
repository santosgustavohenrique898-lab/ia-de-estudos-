import type { Cena, Reel } from "../src/schema";
import { PUBLICO, estilo, type Objetivo } from "../src/pipeline/estilo";
import type { Narracao } from "../src/pipeline/voz";
import type { EventoServidor } from "./api";
import type { Pedido } from "./Inicio";
import type { Questao } from "./progresso";

// Modo Artifact: publicado dentro do Claude, o site não tem servidor. Quem escreve a aula é o
// Claude da própria pessoa que está usando (capacidade "sample" do Artifact), direto do navegador.
// Diferenças para o servidor: não pesquisa na internet (usa o conhecimento do modelo, ou o texto
// e o PDF do aluno) e a voz é a do navegador.

type OpcoesSample = {
  onText?: (u: { text: string; delta: string }) => void;
  signal?: AbortSignal;
  images?: Blob[];
  modelTier?: "quick" | "default" | "complex";
  cache?: boolean;
};
type LimitesSample = { maxPromptBytes: number; images?: { maxCount: number; maxInputBytes: number; mediaTypes: string[] } };
type Sample = ((entrada: string, opcoes?: OpcoesSample) => Promise<{ text: string; truncated: boolean }>) & {
  limits?: () => Promise<LimitesSample>;
};
type ErroSample = { code?: string; message?: string };

declare global {
  interface Window {
    claude?: { use(nome: string): Promise<unknown> };
  }
}

let sampleDaPagina: Promise<Sample | null> | undefined;

// Resolve a função do Claude, ou null fora do Claude (por exemplo, o arquivo aberto direto no navegador).
export function claudeDaPagina(): Promise<Sample | null> {
  sampleDaPagina ??= (async () => {
    try {
      const s = await window.claude?.use("sample");
      return typeof s === "function" ? (s as Sample) : null;
    } catch {
      return null;
    }
  })();
  return sampleDaPagina;
}

// O que este Claude aceita de fotos (quantas por pedido, tamanho e formatos), ou null se não aceita.
export type LimitesDeFoto = { maximo: number; bytes: number; tipos: string[] };
export async function limitesDeFoto(): Promise<LimitesDeFoto | null> {
  const sample = await claudeDaPagina();
  const limites = await sample?.limits?.().catch(() => null);
  const img = limites?.images;
  return img && img.maxCount > 0 ? { maximo: Math.min(img.maxCount, 6), bytes: img.maxInputBytes, tipos: img.mediaTypes } : null;
}

// Narração vazia: a voz do navegador fala cena a cena e o tempo de cada palavra é estimado na hora.
export const narracaoDoNavegador = (reel: Reel): Narracao => ({
  audio: null,
  duracao: 0,
  palavras: [],
  cenas: reel.cenas.map(() => ({ inicio: 0, fim: 0 })),
});

const LIMITE_CARACTERES = 150_000;
type AulaPreparada = { pedido: Pedido; material: string | null; imagens: File[] | null };
const preparadas = new Map<string, AulaPreparada>();

export async function prepararAulaNoClaude(pedido: Pedido): Promise<string> {
  if (!(await claudeDaPagina())) {
    throw new Error("Para gerar aulas, abra este link dentro do Claude (no site claude.ai ou no app).");
  }
  if (pedido.tipo === "foto") {
    const fotos = pedido.fotos ?? [];
    const limites = await limitesDeFoto();
    if (!limites) throw new Error("Este app do Claude não aceita fotos. Abra o link pelo site claude.ai ou use \"Colar texto\".");
    if (fotos.length === 0) throw new Error("Escolha pelo menos uma foto do caderno ou da apostila.");
    if (fotos.length > limites.maximo) throw new Error(`Envie no máximo ${limites.maximo} fotos por aula.`);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    preparadas.set(id, { pedido, material: null, imagens: fotos });
    return id;
  }
  let material: string | null = null;
  if (pedido.tipo === "texto") material = pedido.conteudo;
  if (pedido.tipo === "pdf" && pedido.arquivo) material = await textoDoPdf(pedido.arquivo);
  if (material !== null) {
    material = material.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (material.length < 200) {
      throw new Error(
        pedido.tipo === "pdf"
          ? "Não achei texto nesse PDF (pode ser uma foto ou um escaneado). Copie o texto e use \"Colar texto\"."
          : "O texto é curto demais. Cole pelo menos um parágrafo inteiro.",
      );
    }
    if (material.length > LIMITE_CARACTERES) throw new Error("O material é grande demais para uma aula só. Envie um capítulo por vez.");
  }
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  preparadas.set(id, { pedido, material, imagens: null });
  return id;
}

async function textoDoPdf(arquivo: File): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(await arquivo.arrayBuffer()));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch {
    throw new Error("Não consegui ler esse PDF aqui. Copie o texto dele e use \"Colar texto\".");
  }
}

// ---------- O pedido ao Claude ----------

const EXEMPLO_REEL = JSON.stringify({
  tipo: "reel",
  conceito: "Evaporação",
  emoji: "💧",
  cenas: [
    { template: "gancho", fala: "Por que a roupa seca no varal, se ninguém tira a água dela?", titulo: "Pra onde vai a água?", subtitulo: "ela não some, ela sobe" },
    {
      template: "definicao",
      fala: "Isso é evaporação: o calor dá energia para as moléculas de água, e elas escapam para o ar em forma de vapor.",
      termo: "Evaporação",
      definicao: "A água líquida vira vapor ao receber energia do calor.",
    },
    {
      template: "exemplo",
      fala: "Repara: em dia de sol e vento, a roupa seca muito mais rápido. Mais calor, mais evaporação.",
      titulo: "Na prática",
      situacao: "Roupa no varal seca mais rápido em dia de sol e vento.",
    },
    { template: "fixacao", fala: "Leva isso para a prova: calor faz a água líquida virar vapor. Isso é evaporação.", frase: "Calor transforma água líquida em vapor: evaporação." },
  ],
  quiz: {
    pergunta: "O que faz a roupa no varal secar?",
    alternativas: ["Condensação", "Evaporação", "Solidificação", "Fusão"],
    correta: 1,
    explicacao: "O calor transforma a água da roupa em vapor, e isso é evaporação.",
  },
});

const CENAS = `Cada cena tem "template", "fala" (o que a voz diz, em frases completas) e os campos do seu template:
- "gancho": "titulo" (até 8 palavras) e "subtitulo" (até 10 palavras, pode ser "")
- "definicao": "termo" (até 4 palavras) e "definicao" (até 18 palavras)
- "exemplo": "titulo" (até 5 palavras, como "Na prática" ou "Imagina assim") e "situacao" (até 25 palavras)
- "lista": "titulo" e "itens" (2 a 4 itens de até 6 palavras)
- "comparacao": "titulo", "esquerda" e "direita", cada lado {"nome": "...", "pontos": ["...", "..."]} com 2 ou 3 pontos curtos
- "linha_do_tempo": "titulo" e "eventos" (2 a 4 itens {"data": "...", "texto": "..."} em ordem cronológica)
- "fixacao": "frase" (até 14 palavras)`;

const FORMATO = `Formato: responda só com linhas JSON, um objeto completo por linha, sem markdown e sem nenhum texto fora dos objetos.

${CENAS}

Cada reel tem um "emoji": um só emoji que represente o conceito, para a capa do reel (como 💧 para evaporação ou ⚖️ para leis). Nada de bandeiras.

O quiz de cada reel: {"pergunta": "...", "alternativas": ["...", "...", "...", "..."], "correta": 0, "explicacao": "..."}. São exatamente 4 alternativas curtas; "correta" é a posição da certa, de 0 a 3 (varie essa posição entre os reels); "explicacao" é uma frase dizendo por que ela está certa, sem citar letras.

Exemplo de uma linha de reel (só mostra o formato; o assunto é outro e o seu reel deve ser mais completo):
${EXEMPLO_REEL}`;

function contexto({ pedido, material, imagens }: AulaPreparada) {
  if (imagens) {
    const fotos = imagens.length === 1 ? "a foto anexada" : `as ${imagens.length} fotos anexadas`;
    return `${estilo(pedido.objetivo, "material")}

O material de referência é ${fotos}: caderno, apostila, livro ou lousa do aluno. Leia com atenção o texto, os esquemas, as tabelas e as fórmulas. Ignore o que estiver ilegível ou cortado, e não invente o que não dá para ler.`;
  }
  const base = material ? "material" : "conhecimento";
  const fonte = material
    ? `<material_do_aluno>\n${material}\n</material_do_aluno>`
    : `O aluno quer estudar: """${pedido.conteudo}"""`;
  return `${estilo(pedido.objetivo, base)}\n\n${fonte}`;
}

// Quantos reels o primeiro pedido escreve. Os demais são pedidos em paralelo assim que o plano chega,
// para a aula inteira ficar pronta em cerca de metade do tempo.
export const reelsDoPrimeiroPedido = (n: number) => (n <= 2 ? n : Math.ceil(n / 2));

function pedidoDaAula(aula: AulaPreparada) {
  const n = aula.pedido.reels;
  const k = reelsDoPrimeiroPedido(n);
  const tarefa = aula.material || aula.imagens
    ? `Tarefa: transforme o material do aluno numa aula em reels com até ${n} conceitos (menos, se o material for curto), na ordem certa para aprender: do mais básico ao mais avançado. Ensine o que está no material.`
    : `Tarefa: monte uma aula em reels com exatamente ${n} conceitos sobre esse assunto, na ordem certa para aprender: do mais básico ao mais avançado. Se o pedido for amplo ou vago, escolha o recorte que mais cai em prova para esse público.`;
  const quais =
    k < n
      ? `2. Depois, um reel por linha, SÓ para os ${k} primeiros conceitos do plano, na ordem (os outros reels são escritos à parte): {"tipo":"reel","conceito":"...","emoji":"...","cenas":[...],"quiz":{...}}`
      : `2. Depois, um reel por linha, na ordem do plano: {"tipo":"reel","conceito":"...","emoji":"...","cenas":[...],"quiz":{...}}`;
  return `${contexto(aula)}

${tarefa}
Cada reel ensina um conceito diferente, sem repetir o que outro reel já explicou.

Responda nesta ordem:
1. Primeira linha, o plano, já com todos os conceitos da aula: {"tipo":"plano","titulo":"título curto da aula","conceitos":["conceito 1","conceito 2"]}
${quais}
Se não houver o que ensinar (texto sem sentido, foto ilegível ou sem conteúdo de estudo), responda só: {"tipo":"erro","mensagem":"explicação curta para o aluno"}

${FORMATO}`;
}

function pedidoDeReels(aula: AulaPreparada, plano: Plano, posicoes: number[]) {
  return `${contexto(aula)}

A aula "${plano.titulo}" já tem este plano:
${plano.conceitos.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Tarefa: escreva os reels destes conceitos, um por linha, nesta ordem: ${posicoes.map((i) => `"${plano.conceitos[i]}"`).join(", ")}.
Os outros conceitos do plano têm reels próprios: não repita o que eles explicam.
Cada linha: {"tipo":"reel","conceito":"...","emoji":"...","cenas":[...],"quiz":{...}}

${FORMATO}`;
}

// ---------- Leitura da resposta enquanto ela chega ----------

// Separa os objetos JSON de primeiro nível conforme o texto chega. Aceita um objeto por linha,
// JSON formatado em várias linhas, objetos dentro de uma lista ou de um bloco de código.
// Uma linha quebrada (texto sem fechar, chave faltando) é descartada sem estragar as seguintes.
export function leitorDeObjetos(aoObjeto: (o: unknown) => void): (pedaco: string) => void {
  let atual = "";
  let profundidade = 0;
  let emString = false;
  let escape = false;
  let anterior = "\n";
  return (pedaco) => {
    for (const ch of pedaco) {
      const comecoDeLinha = anterior === "\n";
      anterior = ch;
      if (profundidade === 0 || (ch === "{" && comecoDeLinha)) {
        // Fora de objeto, ou um objeto novo no começo da linha enquanto o anterior não fechou.
        if (ch === "{") {
          atual = "{";
          profundidade = 1;
          emString = false;
          escape = false;
        }
        continue;
      }
      if (ch === "\n" && emString) {
        // JSON não tem quebra de linha dentro de texto: esta linha veio com defeito.
        profundidade = 0;
        atual = "";
        continue;
      }
      atual += ch;
      if (emString) {
        if (escape) escape = false;
        else if (ch === "\\") escape = true;
        else if (ch === '"') emString = false;
      } else if (ch === '"') emString = true;
      else if (ch === "{") profundidade++;
      else if (ch === "}" && --profundidade === 0) {
        const trecho = atual;
        atual = "";
        let objeto: unknown;
        try {
          objeto = JSON.parse(trecho);
        } catch {
          continue; // objeto malformado: o reel que faltar é pedido de novo no fim
        }
        aoObjeto(objeto);
      }
    }
  };
}

type Bruto = Record<string, unknown>;
const ehObjeto = (v: unknown): v is Bruto => typeof v === "object" && v !== null && !Array.isArray(v);
const texto = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const textos = (v: unknown) => (Array.isArray(v) ? v.map(texto).filter(Boolean) : []);

export function normalizarCena(o: unknown): Cena | null {
  if (!ehObjeto(o)) return null;
  const fala = texto(o.fala);
  if (!fala) return null;
  switch (o.template) {
    case "gancho": {
      const titulo = texto(o.titulo);
      return titulo ? { template: "gancho", fala, titulo, subtitulo: texto(o.subtitulo) } : null;
    }
    case "definicao": {
      const termo = texto(o.termo);
      const definicao = texto(o.definicao);
      return termo && definicao ? { template: "definicao", fala, termo, definicao } : null;
    }
    case "exemplo": {
      const situacao = texto(o.situacao);
      return situacao ? { template: "exemplo", fala, titulo: texto(o.titulo) || "Na prática", situacao } : null;
    }
    case "lista": {
      const itens = textos(o.itens).slice(0, 5);
      return itens.length >= 2 ? { template: "lista", fala, titulo: texto(o.titulo), itens } : null;
    }
    case "comparacao": {
      const lado = (l: unknown) => (ehObjeto(l) ? { nome: texto(l.nome), pontos: textos(l.pontos).slice(0, 4) } : { nome: "", pontos: [] });
      const esquerda = lado(o.esquerda);
      const direita = lado(o.direita);
      return esquerda.nome && direita.nome ? { template: "comparacao", fala, titulo: texto(o.titulo), esquerda, direita } : null;
    }
    case "linha_do_tempo": {
      const eventos = (Array.isArray(o.eventos) ? o.eventos : [])
        .map((e: unknown) => (ehObjeto(e) ? { data: texto(e.data), texto: texto(e.texto) } : { data: "", texto: "" }))
        .filter((e) => e.data && e.texto)
        .slice(0, 5);
      return eventos.length >= 2 ? { template: "linha_do_tempo", fala, titulo: texto(o.titulo), eventos } : null;
    }
    case "fixacao": {
      const frase = texto(o.frase);
      return frase ? { template: "fixacao", fala, frase } : null;
    }
    default:
      return null;
  }
}

function normalizarQuiz(o: unknown): Reel["quiz"] | null {
  if (!ehObjeto(o)) return null;
  const pergunta = texto(o.pergunta);
  const alternativas = textos(o.alternativas).slice(0, 5);
  if (!pergunta || alternativas.length < 2) return null;
  let correta = o.correta;
  if (typeof correta === "string") {
    const s = correta.trim();
    correta = /^[A-Ea-e]$/.test(s) ? s.toUpperCase().charCodeAt(0) - 65 : /^\d$/.test(s) ? Number(s) : alternativas.indexOf(s);
  }
  if (typeof correta !== "number" || !Number.isInteger(correta) || correta < 0 || correta >= alternativas.length) return null;
  return { pergunta, alternativas, correta, explicacao: texto(o.explicacao) };
}

// O emoji da capa do reel: só um emoji curto (sem texto junto); fora disso, a capa fica sem.
export function normalizarEmoji(v: unknown): string | undefined {
  const e = texto(v);
  if (!e || e.length > 12 || /[\p{L}\p{N}]/u.test(e.replace(/[\u{FE0F}\u{200D}]/gu, ""))) return undefined;
  return /\p{Extended_Pictographic}/u.test(e) ? e : undefined;
}

export function normalizarReel(o: unknown): Reel | null {
  if (!ehObjeto(o)) return null;
  const cenas = (Array.isArray(o.cenas) ? o.cenas : []).map(normalizarCena).filter((c): c is Cena => c !== null);
  const quiz = normalizarQuiz(o.quiz);
  if (cenas.length < 3 || !quiz) return null;
  const reel: Reel & { emoji?: string } = { conceito: texto(o.conceito), cenas: cenas.slice(0, 7), quiz };
  const emoji = normalizarEmoji(o.emoji);
  if (emoji) reel.emoji = emoji;
  return reel;
}

// ---------- A geração ----------

type Plano = { titulo: string; conceitos: string[] };

const intervalo = (n: number) => Array.from({ length: n }, (_, i) => i);
const simplificar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Erros em que não adianta pedir os reels que faltaram: a pessoa precisa agir antes.
const SEM_CONTINUACAO = new Set([
  "cancelled",
  "not_granted",
  "sampling_disabled",
  "not_declared",
  "capability_disabled",
  "capability_removed",
  "session_expired",
  "rate_limited",
  "refused",
  "prompt_too_large",
  "invalid_request",
  "transform_error",
  "queue_overflow",
  "images_unavailable",
  "image_rejected",
]);

function mensagemDoErro(e: ErroSample): string {
  switch (e.code) {
    case "not_granted":
      return "A aula precisa da sua permissão para usar o Claude. Recarregue a página, toque em Gerar e escolha Permitir.";
    case "sampling_disabled":
    case "not_declared":
    case "capability_disabled":
    case "capability_removed":
      return "O Claude não está liberado para esta página nesta conta ou neste app. Tente abrir o link pelo site claude.ai.";
    case "rate_limited":
      return "Muitos pedidos ao Claude em pouco tempo, ou o limite de uso da sua conta foi atingido. Espere alguns minutos e tente de novo.";
    case "session_expired":
      return "Sua sessão do Claude expirou. Entre de novo na sua conta e tente outra vez.";
    case "refused":
      return "O Claude não quis montar uma aula com esse conteúdo. Tente outro assunto ou outro trecho.";
    case "prompt_too_large":
      return "O material é grande demais para uma aula só. Envie um capítulo por vez.";
    case "images_unavailable":
      return "Este app do Claude não aceita fotos. Abra o link pelo site claude.ai ou use \"Colar texto\".";
    case "image_rejected":
      return "Não consegui abrir uma das fotos. Tire outra (em JPG ou PNG, sem ser enorme) e tente de novo.";
    default:
      return "A conexão com o Claude falhou no meio do caminho. Tente de novo.";
  }
}

class ErroDaAula extends Error {}

export function gerarAulaNoClaude(id: string, aoEvento: (e: EventoServidor) => void): () => void {
  const controle = new AbortController();
  const aula = preparadas.get(id);
  preparadas.delete(id);
  const emitir = (e: EventoServidor) => {
    if (!controle.signal.aborted) aoEvento(e);
  };
  if (!aula) {
    queueMicrotask(() => emitir({ tipo: "erro", mensagem: "Essa aula não foi encontrada. Tente de novo." }));
  } else {
    gerar(aula, emitir, controle.signal).catch((e: unknown) => {
      console.error("Falha ao gerar a aula", e);
      emitir({ tipo: "erro", mensagem: e instanceof ErroDaAula ? e.message : mensagemDoErro(e as ErroSample) });
    });
  }
  return () => controle.abort();
}

async function gerar(aula: AulaPreparada, emitir: (e: EventoServidor) => void, signal: AbortSignal) {
  const sample = await claudeDaPagina();
  if (!sample) throw new ErroDaAula("Para gerar aulas, abra este link dentro do Claude (no site claude.ai ou no app).");
  const n = aula.pedido.reels;
  let plano: Plano | null = null;
  const prontos: (Reel | null)[] = [];
  let recusa: string | null = null;

  const definirPlano = (p: Plano) => {
    plano = p;
    emitir({ tipo: "plano", titulo: p.titulo, conceitos: p.conceitos });
    emitir({ tipo: "etapa", etapa: "escrevendo" });
  };

  // Coloca o reel na posição do conceito com o mesmo nome; se não achar, na próxima vaga pedida.
  // Um reel com o nome exato de um conceito que não foi pedido nesta resposta é descartado
  // (a outra resposta, que corre em paralelo, cuida dele).
  const posicaoDo = (conceito: string, pedidas: number[]) => {
    const livres = pedidas.filter((i) => !prontos[i]);
    const alvo = simplificar(conceito);
    const nomes = plano!.conceitos.map(simplificar);
    const exato = nomes.findIndex((c) => c === alvo);
    if (exato >= 0) return livres.includes(exato) ? exato : -1;
    const porNome = livres.find((i) => {
      const c = nomes[i];
      return alvo.length > 3 && c.length > 3 && (c.includes(alvo) || alvo.includes(c));
    });
    return porNome ?? livres[0] ?? -1;
  };

  const receberReel = (bruto: unknown, pedidas: () => number[]) => {
    const reel = normalizarReel(bruto);
    if (!reel) return;
    if (!plano) {
      definirPlano({
        titulo: aula.pedido.tipo === "tema" ? aula.pedido.conteudo : "Sua aula",
        conceitos: intervalo(n).map((i) => (i === 0 ? reel.conceito || "Parte 1" : `Parte ${i + 1}`)),
      });
    }
    const i = posicaoDo(reel.conceito, pedidas());
    if (i < 0) return;
    if (!reel.conceito) reel.conceito = plano!.conceitos[i];
    prontos[i] = reel;
    emitir({ tipo: "reel", indice: i, reel, narracao: narracaoDoNavegador(reel) });
  };

  const receber = (o: unknown, pedidas: () => number[]) => {
    if (!ehObjeto(o)) return;
    if (o.tipo === "erro" || (typeof o.erro === "string" && !o.cenas)) {
      recusa ??= texto(o.mensagem) || texto(o.erro) || "Não deu para montar uma aula com isso. Tente escrever o assunto de outro jeito.";
      return;
    }
    if (Array.isArray(o.cenas)) return receberReel(o, pedidas);
    const conceitos = (Array.isArray(o.conceitos) ? o.conceitos : [])
      .map((c: unknown) => (ehObjeto(c) ? texto(c.nome) : texto(c)))
      .filter(Boolean)
      .slice(0, n);
    if (!plano && conceitos.length > 0) definirPlano({ titulo: texto(o.titulo) || aula.pedido.conteudo, conceitos });
    // Alguns modelos devolvem a aula inteira num objeto só: {"titulo", "conceitos", "reels": [...]}.
    if (Array.isArray(o.reels)) for (const r of o.reels) receberReel(r, pedidas);
  };

  // 1. O primeiro pedido traz o plano e a primeira metade dos reels; assim que o plano chega, a outra
  //    metade é pedida em paralelo. Cada reel aparece no feed assim que termina de ser escrito.
  emitir({ tipo: "etapa", etapa: aula.material || aula.imagens ? "lendo" : "pesquisando" });
  const fotos = aula.imagens ? { images: aula.imagens } : {};
  const k = reelsDoPrimeiroPedido(n);
  let comecou = false;
  // Antes do plano chegar, qualquer posição serve; depois, o primeiro pedido só preenche as k primeiras.
  const doPrimeiro = () => (plano ? intervalo(Math.min(k, plano.conceitos.length)) : intervalo(n));
  let erroParalelo: ErroSample | null = null;
  let paralelo: Promise<void> = Promise.resolve();
  const pedirSegundaMetade = (p: Plano) => {
    const pedidas = intervalo(p.conceitos.length).slice(k);
    if (pedidas.length === 0) return;
    const lerParalelo = leitorDeObjetos((o) => {
      if (ehObjeto(o) && Array.isArray(o.cenas)) receberReel(o, () => pedidas);
    });
    let chegou = false;
    paralelo = sample(pedidoDeReels(aula, p, pedidas), {
      ...fotos,
      signal,
      onText: ({ delta }) => {
        chegou = true;
        lerParalelo(delta);
      },
    })
      .then(({ text }) => {
        if (!chegou) lerParalelo(text);
      })
      .catch((e: unknown) => {
        erroParalelo = e as ErroSample;
      });
  };
  const ler = leitorDeObjetos((o) => {
    const tinhaPlano = Boolean(plano);
    receber(o, doPrimeiro);
    // O plano de verdade acabou de chegar (não o improvisado a partir de um reel): pede o resto em paralelo.
    if (!tinhaPlano && plano && ehObjeto(o) && !Array.isArray(o.cenas)) pedirSegundaMetade(plano);
  });
  let erro: ErroSample | null = null;
  try {
    const { text } = await sample(pedidoDaAula(aula), {
      ...fotos,
      signal,
      onText: ({ delta }) => {
        if (!comecou) {
          comecou = true;
          emitir({ tipo: "etapa", etapa: "planejando" });
        }
        ler(delta);
      },
    });
    if (!comecou) ler(text); // o texto sempre chega pelo onText; isto só garante o caso raro em que não chegar
  } catch (e) {
    erro = e as ErroSample;
  }
  await paralelo;
  if (signal.aborted) return;
  if (erro?.code === "refused") throw erro;
  if (recusa) throw new ErroDaAula(recusa);
  const planoFinal = plano as Plano | null;
  if (!planoFinal) {
    if (erro) throw erro;
    throw new ErroDaAula("Não consegui montar a aula desta vez. Tente de novo.");
  }
  const bloqueio = [erro, erroParalelo as ErroSample | null].find((e) => e?.code && SEM_CONTINUACAO.has(e.code) && e.code !== "queue_overflow");

  // 2. Se a resposta foi cortada ou algum reel veio com defeito, pede só os que faltaram, uma vez.
  let faltando = intervalo(planoFinal.conceitos.length).filter((i) => !prontos[i]);
  if (faltando.length > 0 && !bloqueio) {
    const pedidas = faltando;
    const lerResto = leitorDeObjetos((o) => receber(o, () => pedidas));
    let chegou = false;
    try {
      const { text } = await sample(pedidoDeReels(aula, planoFinal, pedidas), {
        ...fotos,
        signal,
        onText: ({ delta }) => {
          chegou = true;
          lerResto(delta);
        },
      });
      if (!chegou) lerResto(text);
    } catch (e) {
      if ((e as ErroSample).code === "refused") throw e;
    }
    if (signal.aborted) return;
    faltando = faltando.filter((i) => !prontos[i]);
  }
  for (const indice of faltando) emitir({ tipo: "descartado", indice, motivo: "O Claude não conseguiu escrever este reel." });
  emitir({ tipo: "fim" });

  // 3. Com os reels prontos, o simulado é escrito enquanto o aluno assiste.
  const feitos = intervalo(planoFinal.conceitos.length)
    .map((i) => prontos[i])
    .filter((r): r is Reel => Boolean(r));
  if (feitos.length > 0) await gerarSimulado(sample, aula.pedido.objetivo, planoFinal.titulo, feitos, emitir, signal);
}

// ---------- Simulado no fim da aula ----------

const ESTILO_PROVA: Record<Objetivo, string> = {
  ENEM: "do ENEM: um texto-base (situação do cotidiano, trecho de reportagem, gráfico descrito, dado ou experimento) e um comando que exige interpretar o texto e aplicar o conceito",
  Vestibular: "de vestibular tradicional: enunciado direto que cobra o conceito com precisão, com um texto curto de apoio quando ajudar",
  Concurso: "de banca de concurso: enunciado objetivo e alternativas parecidas que testam detalhes, exceções e pegadinhas comuns",
  Faculdade: "de prova de faculdade: um caso ou problema curto que exige raciocinar com o conceito, não só decorar",
};

export const quantasQuestoes = (reels: number) => (reels <= 3 ? 3 : 5);

function pedidoDoSimulado(objetivo: Objetivo, titulo: string, reels: Reel[], n: number) {
  const aula = reels.map((r, i) => `${i + 1}. ${r.conceito}: ${r.cenas.map((c) => c.fala).join(" ")}`).join("\n\n");
  return `Você é um professor que escreve questões de prova em português do Brasil.
Público: ${PUBLICO[objetivo]}.

A aula "${titulo}" ensinou isto ao aluno:
${aula}

Tarefa: escreva ${n} questões inéditas de múltipla escolha no estilo ${ESTILO_PROVA[objetivo]}. Cubra os conceitos da aula, da questão mais fácil para a mais difícil. Cobre só o que a aula ensinou.

Cada questão tem:
- "conceito": o conceito da aula que ela cobra.
- "textoBase": texto de apoio com 2 a 5 frases, ou "" se a questão não precisar. Pode trazer situações e números hipotéticos, mas nunca atribua nada a uma pessoa, instituição ou pesquisa real.
- "pergunta": o comando da questão, claro e completo.
- "alternativas": exatamente 5, plausíveis, com uma só correta. Nada de "todas as anteriores" ou "nenhuma das anteriores".
- "correta": a posição da alternativa certa, de 0 a 4. Varie a posição entre as questões.
- "explicacao": 1 ou 2 frases dizendo por que a certa está certa.
- "porQue": lista com 5 frases curtas, na ordem das alternativas, dizendo por que cada uma está certa ou errada. Não cite letras.

Formato: responda só com linhas JSON, uma questão completa por linha, sem markdown e sem texto fora dos objetos:
{"tipo":"questao","conceito":"...","textoBase":"...","pergunta":"...","alternativas":["...","...","...","...","..."],"correta":0,"explicacao":"...","porQue":["...","...","...","...","..."]}`;
}

export function normalizarQuestao(o: unknown): Questao | null {
  if (!ehObjeto(o) || (o.tipo !== undefined && o.tipo !== "questao")) return null;
  const base = normalizarQuiz(o);
  if (!base || base.alternativas.length < 4) return null;
  const porQue = textos(o.porQue ?? o.por_que);
  return {
    ...base,
    textoBase: texto(o.textoBase ?? o.texto_base) || undefined,
    porQue: porQue.length === base.alternativas.length ? porQue : undefined,
    conceito: texto(o.conceito) || undefined,
  };
}

// Cada questão aparece no feed assim que termina de ser escrita. Uma falha aqui não estraga a aula: só fica sem simulado.
async function gerarSimulado(sample: Sample, objetivo: Objetivo, titulo: string, reels: Reel[], emitir: (e: EventoServidor) => void, signal: AbortSignal) {
  const n = quantasQuestoes(reels.length);
  emitir({ tipo: "simulado-gerando", total: n });
  let feitas = 0;
  const ler = leitorDeObjetos((o) => {
    const questao = normalizarQuestao(o);
    if (!questao || feitas >= n) return;
    emitir({ tipo: "questao", indice: feitas++, questao });
  });
  try {
    let chegou = false;
    const { text } = await sample(pedidoDoSimulado(objetivo, titulo, reels, n), {
      signal,
      onText: ({ delta }) => {
        chegou = true;
        ler(delta);
      },
    });
    if (!chegou) ler(text);
  } catch (e) {
    if (signal.aborted) return;
    console.error("Falha ao gerar o simulado", e);
  }
  if (!signal.aborted) emitir({ tipo: "simulado-fim" });
}

// ---------- "Não entendi": outra explicação, mais simples ----------

export async function explicarDeOutroJeito(
  { reel, cena, objetivo, deNovo }: { reel: Reel; cena: number; objetivo: Objetivo; deNovo: boolean },
  aoCena: (c: Cena) => void,
  signal: AbortSignal,
): Promise<void> {
  const sample = await claudeDaPagina();
  if (!sample) throw { code: "not_granted", message: "sem Claude" } satisfies ErroSample;
  const pedido = `Você é um professor paciente que explica em reels curtos, em português do Brasil.
Público: ${PUBLICO[objetivo]}.

O aluno assistia a este reel sobre "${reel.conceito}":
${reel.cenas.map((c, i) => `${i + 1}. ${c.fala}`).join("\n")}

Ele tocou em "Não entendi" na parte ${cena + 1}: """${reel.cenas[cena].fala}"""

Tarefa: explique essa ideia de outro jeito, mais simples, em 3 cenas:
1. "exemplo": uma analogia ou situação do dia a dia que deixa a ideia concreta.
2. "definicao" ou "lista": a ideia com palavras simples, passo a passo.
3. "fixacao": a frase para lembrar.
Cada fala tem no máximo 30 palavras. Não contradiga o reel e use só conhecimento consolidado.${
    deNovo ? " O aluno já viu uma explicação e ainda não entendeu: use uma analogia bem diferente e ainda mais simples." : ""
  }

${CENAS}

Formato: responda só com as 3 cenas, uma por linha, cada uma um objeto JSON completo como {"template":"exemplo","fala":"...","titulo":"...","situacao":"..."}, sem markdown e sem texto fora dos objetos.`;
  const ler = leitorDeObjetos((o) => {
    const c = normalizarCena(o);
    if (c) aoCena(c);
  });
  let chegou = false;
  const { text } = await sample(pedido, {
    signal,
    modelTier: "quick",
    ...(deNovo ? { cache: false } : {}),
    onText: ({ delta }) => {
      chegou = true;
      ler(delta);
    },
  });
  if (!chegou) ler(text);
}

export function mensagemDaExplicacao(e: unknown): string {
  const code = (e as ErroSample)?.code;
  if (code === "not_granted") return "Para receber a explicação, permita que a aula use o Claude.";
  if (code === "rate_limited") return "Muitos pedidos ao Claude agora. Espere um pouco e tente de novo.";
  return "Não consegui explicar agora. Tente de novo.";
}
