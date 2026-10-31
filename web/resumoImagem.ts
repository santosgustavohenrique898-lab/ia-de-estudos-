// Resumo da aula em imagem (PNG vertical), para salvar e mandar no grupo de estudos.
// Desenhado num canvas, sem depender de nenhum serviço de fora.

export type DadosDoResumo = {
  titulo: string;
  objetivo: string;
  conceitos: { nome: string; frase: string }[];
  acertos: number;
  respondidas: number;
  xp: number;
};

const FONTE = `Inter, "Helvetica Neue", Arial, sans-serif`;
const LARGURA = 1080;
const MARGEM = 72;
const TEXTO = "#0f1222";
const SUAVE = "rgba(15, 18, 34, 0.62)";

function quebrar(ctx: CanvasRenderingContext2D, texto: string, largura: number): string[] {
  const linhas: string[] = [];
  let linha = "";
  for (const palavra of texto.split(/\s+/).filter(Boolean)) {
    const teste = linha ? `${linha} ${palavra}` : palavra;
    if (linha && ctx.measureText(teste).width > largura) {
      linhas.push(linha);
      linha = palavra;
    } else linha = teste;
  }
  if (linha) linhas.push(linha);
  return linhas;
}

function retangulo(ctx: CanvasRenderingContext2D, x: number, y: number, l: number, a: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + l, y, x + l, y + a, r);
  ctx.arcTo(x + l, y + a, x, y + a, r);
  ctx.arcTo(x, y + a, x, y, r);
  ctx.arcTo(x, y, x + l, y, r);
  ctx.closePath();
}

// Mede (desenhar = false) ou desenha (desenhar = true) o resumo; devolve a altura total.
function compor(ctx: CanvasRenderingContext2D, d: DadosDoResumo, desenhar: boolean): number {
  const util = LARGURA - MARGEM * 2;
  let y = 0;

  // Cabeçalho com o degradê da marca.
  ctx.font = `900 72px ${FONTE}`;
  const titulo = quebrar(ctx, d.titulo, util);
  const alturaTopo = MARGEM + 48 + 28 + 44 + titulo.length * 84 + MARGEM - 12;
  if (desenhar) {
    const grad = ctx.createLinearGradient(0, 0, LARGURA, alturaTopo);
    grad.addColorStop(0, "#6c4cf5");
    grad.addColorStop(0.55, "#3f6df2");
    grad.addColorStop(1, "#22b3c9");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, LARGURA, alturaTopo);
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "top";
    ctx.font = `800 40px ${FONTE}`;
    ctx.fillText("▶  LearningFlix", MARGEM, MARGEM);
    ctx.globalAlpha = 0.82;
    ctx.font = `800 28px ${FONTE}`;
    ctx.fillText(`RESUMO DA AULA  ·  ${d.objetivo.toUpperCase()}`, MARGEM, MARGEM + 76);
    ctx.globalAlpha = 1;
    ctx.font = `900 72px ${FONTE}`;
    titulo.forEach((linha, i) => ctx.fillText(linha, MARGEM, MARGEM + 124 + i * 84));
  }
  y = alturaTopo + 48;

  // Números da aula.
  const pct = d.respondidas ? Math.round((d.acertos / d.respondidas) * 100) : 0;
  const numeros: [string, string][] = d.respondidas
    ? [
        [`${pct}%`, "de acerto"],
        [`${d.acertos}/${d.respondidas}`, "perguntas certas"],
        [`${d.xp} XP`, "ganhos na aula"],
      ]
    : [
        [`${d.conceitos.length}`, "conceitos"],
        [`${d.xp} XP`, "ganhos na aula"],
      ];
  const largNum = (util - 24 * (numeros.length - 1)) / numeros.length;
  if (desenhar) {
    numeros.forEach(([valor, rotulo], i) => {
      const x = MARGEM + i * (largNum + 24);
      ctx.save();
      ctx.shadowColor = "rgba(40, 30, 120, 0.12)";
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 10;
      ctx.fillStyle = "#ffffff";
      retangulo(ctx, x, y, largNum, 168, 32);
      ctx.fill();
      ctx.restore();
      ctx.textAlign = "center";
      ctx.fillStyle = TEXTO;
      ctx.font = `900 56px ${FONTE}`;
      ctx.fillText(valor, x + largNum / 2, y + 34);
      ctx.fillStyle = SUAVE;
      ctx.font = `600 26px ${FONTE}`;
      ctx.fillText(rotulo, x + largNum / 2, y + 108);
      ctx.textAlign = "left";
    });
  }
  y += 168 + 64;

  if (desenhar) {
    ctx.fillStyle = "rgba(15, 18, 34, 0.45)";
    ctx.font = `800 28px ${FONTE}`;
    ctx.fillText("O QUE EU APRENDI", MARGEM, y);
  }
  y += 56;

  // Um cartão por conceito, com a frase para levar para a prova.
  const recuo = 40 + 64 + 28;
  const largTexto = util - recuo - 40;
  d.conceitos.forEach((c, i) => {
    ctx.font = `800 40px ${FONTE}`;
    const nome = quebrar(ctx, c.nome, largTexto);
    ctx.font = `400 34px ${FONTE}`;
    const frase = c.frase ? quebrar(ctx, c.frase, largTexto) : [];
    const altura = 40 + nome.length * 50 + (frase.length ? 14 + frase.length * 46 : 0) + 40;
    if (desenhar) {
      ctx.save();
      ctx.shadowColor = "rgba(40, 30, 120, 0.1)";
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = "#ffffff";
      retangulo(ctx, MARGEM, y, util, altura, 32);
      ctx.fill();
      ctx.restore();
      const grad = ctx.createLinearGradient(MARGEM + 40, y + 40, MARGEM + 104, y + 104);
      grad.addColorStop(0, "#6c4cf5");
      grad.addColorStop(1, "#22b3c9");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(MARGEM + 72, y + 72, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.font = `900 32px ${FONTE}`;
      ctx.fillText(String(i + 1), MARGEM + 72, y + 54);
      ctx.textAlign = "left";
      ctx.fillStyle = TEXTO;
      ctx.font = `800 40px ${FONTE}`;
      nome.forEach((linha, k) => ctx.fillText(linha, MARGEM + recuo, y + 40 + k * 50));
      ctx.fillStyle = SUAVE;
      ctx.font = `400 34px ${FONTE}`;
      frase.forEach((linha, k) => ctx.fillText(linha, MARGEM + recuo, y + 40 + nome.length * 50 + 14 + k * 46));
    }
    y += altura + 24;
  });

  y += 40;
  if (desenhar) {
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(15, 18, 34, 0.5)";
    ctx.font = `700 28px ${FONTE}`;
    ctx.fillText("Feito com LearningFlix · aprenda qualquer matéria rolando reels", LARGURA / 2, y);
    ctx.textAlign = "left";
  }
  return y + 28 + MARGEM;
}

export async function imagemDoResumo(d: DadosDoResumo): Promise<Blob> {
  await document.fonts?.ready.catch(() => {});
  const canvas = document.createElement("canvas");
  canvas.width = LARGURA;
  canvas.height = 100;
  const medida = canvas.getContext("2d")!;
  medida.textBaseline = "top";
  const altura = Math.ceil(compor(medida, d, false));
  canvas.width = LARGURA;
  canvas.height = altura;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f6f7fc";
  ctx.fillRect(0, 0, LARGURA, altura);
  ctx.textBaseline = "top";
  compor(ctx, d, true);
  return new Promise((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error("canvas vazio"))), "image/png"));
}

export const nomeDoArquivo = (titulo: string) =>
  `resumo-${
    titulo
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "aula"
  }.png`;

type Downloads = { save(pedido: { filename: string; data: Blob }): Promise<unknown> };

// Dentro do Claude, o arquivo passa pela confirmação de download do próprio Claude (no celular, abre o compartilhar).
// Fora dele, baixa direto pelo navegador.
export async function baixarArquivo(dados: Blob, nome: string): Promise<"salvo" | "recusado" | "ocupado"> {
  const claude = window.claude;
  if (claude) {
    const downloads = (await claude.use("downloads").catch(() => null)) as Downloads | null;
    if (downloads) {
      try {
        await downloads.save({ filename: nome, data: dados });
        return "salvo";
      } catch (e) {
        const code = (e as { code?: string })?.code;
        if (code === "declined") return "recusado";
        if (code === "rate_limited") return "ocupado";
        // Outros casos (indisponível neste app): tenta o download direto do navegador.
      }
    }
  }
  const url = URL.createObjectURL(dados);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "salvo";
}
