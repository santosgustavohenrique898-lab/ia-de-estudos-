import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { streamSSE } from "hono/streaming";
import { textoDoPdf } from "../src/pipeline/ingestao.js";
import { gerarAula, type Entrada, type EventoAula } from "../src/pipeline/gerarAula.js";
import type { Objetivo } from "../src/pipeline/roteiro.js";

const PORTA = Number(process.env.PORT ?? 8787);
const PASTA_AUDIO = process.env.PASTA_AUDIO ?? join(tmpdir(), "ia-de-estudos-audio");
const AULAS_POR_HORA = Number(process.env.AULAS_POR_HORA ?? 10);
const OBJETIVOS: Objetivo[] = ["ENEM", "Vestibular", "Concurso", "Faculdade"];

type EventoServidor = EventoAula | { tipo: "erro"; mensagem: string };

// Aulas em andamento ficam em memória: os eventos já emitidos são reenviados a quem conectar depois.
type Trabalho = { eventos: EventoServidor[]; ouvintes: Set<(e: EventoServidor) => void>; criado: number };
const trabalhos = new Map<string, Trabalho>();
const pedidosPorIp = new Map<string, number[]>();

setInterval(() => {
  const limite = Date.now() - 60 * 60 * 1000;
  for (const [id, t] of trabalhos) if (t.criado < limite) trabalhos.delete(id);
}, 10 * 60 * 1000).unref();

const app = new Hono();

app.get("/api/status", (c) =>
  c.json({ ia: Boolean(process.env.ANTHROPIC_API_KEY), voz: Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID) }),
);

app.post("/api/aulas", async (c) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return c.json({ erro: "O servidor ainda não tem a chave da IA (ANTHROPIC_API_KEY)." }, 503);
  }

  const ip = c.req.header("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const recentes = (pedidosPorIp.get(ip) ?? []).filter((t) => t > Date.now() - 60 * 60 * 1000);
  if (recentes.length >= AULAS_POR_HORA) {
    return c.json({ erro: "Você chegou ao limite de aulas por hora. Tente de novo daqui a pouco." }, 429);
  }

  const corpo = await c.req.json<{ tipo: string; conteudo?: string; pdfBase64?: string; objetivo: string; reels: number }>();
  const objetivo = OBJETIVOS.includes(corpo.objetivo as Objetivo) ? (corpo.objetivo as Objetivo) : "ENEM";
  const reels = Math.min(Math.max(Math.round(corpo.reels) || 3, 1), 8);

  let entrada: Entrada;
  try {
    if (corpo.tipo === "tema" && corpo.conteudo?.trim()) {
      entrada = { tipo: "tema", tema: corpo.conteudo.trim().slice(0, 300) };
    } else if (corpo.tipo === "texto" && corpo.conteudo) {
      entrada = { tipo: "texto", texto: corpo.conteudo };
    } else if (corpo.tipo === "pdf" && corpo.pdfBase64) {
      entrada = { tipo: "texto", texto: await textoDoPdf(new Uint8Array(Buffer.from(corpo.pdfBase64, "base64"))) };
    } else {
      return c.json({ erro: "Envie um tema, um texto ou um PDF." }, 400);
    }
  } catch {
    return c.json({ erro: "Não consegui ler esse PDF. Ele pode estar protegido ou corrompido." }, 400);
  }

  pedidosPorIp.set(ip, [...recentes, Date.now()]);
  const id = randomUUID();
  const trabalho: Trabalho = { eventos: [], ouvintes: new Set(), criado: Date.now() };
  trabalhos.set(id, trabalho);
  const emitir = (e: EventoServidor) => {
    trabalho.eventos.push(e);
    for (const ouvir of trabalho.ouvintes) ouvir(e);
  };

  await mkdir(PASTA_AUDIO, { recursive: true });
  gerarAula({ entrada, objetivo, reels, pastaAudio: PASTA_AUDIO, prefixoAudio: id, aoEvento: emitir }).catch((erro) => {
    console.error(erro);
    emitir({ tipo: "erro", mensagem: erro instanceof Error ? erro.message : "Erro inesperado ao gerar a aula." });
  });

  return c.json({ id });
});

app.get("/api/aulas/:id/eventos", (c) => {
  const trabalho = trabalhos.get(c.req.param("id"));
  if (!trabalho) return c.json({ erro: "Aula não encontrada." }, 404);

  return streamSSE(c, async (stream) => {
    const fila: EventoServidor[] = [...trabalho.eventos];
    let acordar: (() => void) | null = null;
    const ouvir = (e: EventoServidor) => {
      fila.push(e);
      acordar?.();
    };
    trabalho.ouvintes.add(ouvir);
    stream.onAbort(() => {
      trabalho.ouvintes.delete(ouvir);
    });

    while (!stream.aborted) {
      while (fila.length) {
        const e = fila.shift()!;
        await stream.writeSSE({ data: JSON.stringify(e) });
        if (e.tipo === "fim" || e.tipo === "erro") {
          trabalho.ouvintes.delete(ouvir);
          return;
        }
      }
      await new Promise<void>((r) => {
        acordar = r;
        setTimeout(r, 15000);
      });
      acordar = null;
      if (!fila.length) await stream.writeSSE({ event: "ping", data: "" });
    }
  });
});

app.get("/api/audio/:arquivo", async (c) => {
  const arquivo = c.req.param("arquivo");
  if (!/^[\w-]+\.mp3$/.test(arquivo)) return c.notFound();
  const caminho = join(PASTA_AUDIO, arquivo);
  if (!existsSync(caminho)) return c.notFound();
  return c.body(await readFile(caminho), 200, { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=3600" });
});

// Em produção o mesmo servidor entrega o site já compilado (npm run site:build).
app.use("/*", serveStatic({ root: "./dist-web" }));

serve({ fetch: app.fetch, port: PORTA }, () => {
  console.log(`Servidor em http://localhost:${PORTA}`);
  if (!process.env.ANTHROPIC_API_KEY) console.log("Aviso: sem ANTHROPIC_API_KEY, o site não consegue gerar aulas.");
  if (!process.env.ELEVENLABS_API_KEY) console.log("Aviso: sem ELEVENLABS_API_KEY, a voz será a do navegador.");
});
