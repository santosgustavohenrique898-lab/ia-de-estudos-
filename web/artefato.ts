import type { Cena, Reel } from "../src/schema";
import { estilo } from "../src/pipeline/estilo";
import type { EventoServidor } from "./api";
import type { Pedido } from "./Inicio";

// Modo Artifact: publicado dentro do Claude, o site não tem servidor. Quem escreve a aula é o
// Claude da própria pessoa que está usando (capacidade "sample" do Artifact), direto do navegador.
// Diferenças para o servidor: não pesquisa na internet (usa o conhecimento do modelo, ou o texto
// e o PDF do aluno) e a voz é a do navegador.

type Sample = (
  entrada: string,
  opcoes?: { onText?: (u: { text: string; delta: string }) => void; signal?: AbortSignal },
) => Promise<{ text: string; truncated: boolean }>;
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

const LIMITE_CARACTERES = 150_000;
type AulaPreparada = { pedido: Pedido; material: string | null };
const preparadas = new Map<string, AulaPreparada>();

export async function prepararAulaNoClaude(pedido: Pedido): Promise<string> {
  if (!(await claudeDaPagina())) {
    throw new Error("Para gerar aulas, abra este link dentro do Claude (no site claude.ai ou no app).");
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
  preparadas.set(id, { pedido, material });
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

const FORMATO = `Formato: responda só com linhas JSON, um objeto completo por linha, sem markdown e sem nenhum texto fora dos objetos.

Cada cena tem "template", "fala" (o que a voz diz, em frases completas) e os campos do seu template:
- "gancho": "titulo" (até 8 palavras) e "subtitulo" (até 10 palavras, pode ser "")
- "definicao": "termo" (até 4 palavras) e "definicao" (até 18 palavras)
- "exemplo": "titulo" (até 5 palavras, como "Na prática" ou "Imagina assim") e "situacao" (até 25 palavras)
- "lista": "titulo" e "itens" (2 a 4 itens de até 6 palavras)
- "comparacao": "titulo", "esquerda" e "direita", cada lado {"nome": "...", "pontos": ["...", "..."]} com 2 ou 3 pontos curtos
- "linha_do_tempo": "titulo" e "eventos" (2 a 4 itens {"data": "...", "texto": "..."} em ordem cronológica)
- "fixacao": "frase" (até 14 palavras)

O quiz de cada reel: {"pergunta": "...", "alternativas": ["...", "...", "...", "..."], "correta": 0, "explicacao": "..."}. São exatamente 4 alternativas curtas; "correta" é a posição da certa, de 0 a 3 (varie essa posição entre os reels); "explicacao" é uma frase dizendo por que ela está certa.

Exemplo de uma linha de reel (só mostra o formato; o assunto é outro e o seu reel deve ser mais completo):
${EXEMPLO_REEL}`;

function contexto({ pedido, material }: AulaPreparada) {
  const base = material ? "material" : "conhecimento";
  const fonte = material
    ? `<material_do_aluno>\n${material}\n</material_do_aluno>`
    : `O aluno quer estudar: """${pedido.conteudo}"""`;
  return `${estilo(pedido.objetivo, base)}\n\n${fonte}`;
}

function pedidoDaAula(aula: AulaPreparada) {
  const n = aula.pedido.reels;
  const tarefa = aula.material
    ? `Tarefa: transforme o material do aluno numa aula em reels com até ${n} conceitos (menos, se o material for curto), na ordem certa para aprender: do mais básico ao mais avançado. Ensine o que está no material.`
    : `Tarefa: monte uma aula em reels com exatamente ${n} conceitos sobre esse assunto, na ordem certa para aprender: do mais básico ao mais avançado. Se o pedido for amplo ou vago, escolha o recorte que mais cai em prova para esse público.`;
  return `${contexto(aula)}

${tarefa}
Cada reel ensina um conceito diferente, sem repetir o que outro reel já explicou.

Responda nesta ordem:
1. Primeira linha, o plano: {"tipo":"plano","titulo":"título curto da aula","conceitos":["conceito 1","conceito 2"]}
2. Depois, um reel por linha, na ordem do plano: {"tipo":"reel","conceito":"...","cenas":[...],"quiz":{...}}
Se não houver o que ensinar (texto sem sentido ou sem conteúdo de estudo), responda só: {"tipo":"erro","mensagem":"explicação curta para o aluno"}

${FORMATO}`;
}

function pedidoDeReels(aula: AulaPreparada, plano: Plano, posicoes: number[]) {
  return `${contexto(aula)}

A aula "${plano.titulo}" já tem este plano:
${plano.conceitos.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Tarefa: escreva os reels destes conceitos, um por linha, nesta ordem: ${posicoes.map((i) => `"${plano.conceitos[i]}"`).join(", ")}.
Cada linha: {"tipo":"reel","conceito":"...","cenas":[...],"quiz":{...}}

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

function normalizarCena(o: unknown): Cena | null {
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

export function normalizarReel(o: unknown): Reel | null {
  if (!ehObjeto(o)) return null;
  const cenas = (Array.isArray(o.cenas) ? o.cenas : []).map(normalizarCena).filter((c): c is Cena => c !== null);
  const quiz = normalizarQuiz(o.quiz);
  if (cenas.length < 3 || !quiz) return null;
  return { conceito: texto(o.conceito), cenas: cenas.slice(0, 7), quiz };
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
  const posicaoDo = (conceito: string, pedidas: number[]) => {
    const livres = pedidas.filter((i) => !prontos[i]);
    const alvo = simplificar(conceito);
    const porNome = livres.find((i) => {
      const c = simplificar(plano!.conceitos[i]);
      return c === alvo || (alvo.length > 3 && c.length > 3 && (c.includes(alvo) || alvo.includes(c)));
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
    emitir({ tipo: "reel", indice: i, reel, narracao: { audio: null, duracao: 0, palavras: [], cenas: reel.cenas.map(() => ({ inicio: 0, fim: 0 })) } });
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

  // 1. Um pedido só: o plano chega primeiro e cada reel aparece no feed assim que termina de ser escrito.
  emitir({ tipo: "etapa", etapa: aula.material ? "lendo" : "pesquisando" });
  let comecou = false;
  const todas = () => intervalo(plano ? plano.conceitos.length : n);
  const ler = leitorDeObjetos((o) => receber(o, todas));
  let erro: ErroSample | null = null;
  try {
    const { text } = await sample(pedidoDaAula(aula), {
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
  if (signal.aborted) return;
  if (erro?.code === "refused") throw erro;
  if (recusa) throw new ErroDaAula(recusa);
  const planoFinal = plano as Plano | null;
  if (!planoFinal) {
    if (erro) throw erro;
    throw new ErroDaAula("Não consegui montar a aula desta vez. Tente de novo.");
  }

  // 2. Se a resposta foi cortada ou algum reel veio com defeito, pede só os que faltaram, uma vez.
  let faltando = intervalo(planoFinal.conceitos.length).filter((i) => !prontos[i]);
  if (faltando.length > 0 && !(erro?.code && SEM_CONTINUACAO.has(erro.code))) {
    const pedidas = faltando;
    const lerResto = leitorDeObjetos((o) => receber(o, () => pedidas));
    let chegou = false;
    try {
      const { text } = await sample(pedidoDeReels(aula, planoFinal, pedidas), {
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
}
