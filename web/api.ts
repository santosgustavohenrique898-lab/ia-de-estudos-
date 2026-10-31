import type { Reel } from "../src/schema";
import type { Narracao } from "../src/pipeline/voz";
import type { EventoAula } from "../src/pipeline/gerarAula";
import type { Pedido } from "./Inicio";
import { claudeDaPagina, gerarAulaNoClaude, prepararAulaNoClaude } from "./artefato";

// Publicado como Artifact do Claude (build com VITE_ARTEFATO=1), o site não tem servidor:
// a aula é escrita pelo Claude de quem está usando, e a voz é a do navegador.
export const MODO_ARTEFATO = import.meta.env.VITE_ARTEFATO === "1";

export type ReelPronto = { reel: Reel; narracao: Narracao };
export type EventoServidor = EventoAula | { tipo: "erro"; mensagem: string };

export const urlAudio = (arquivo: string) => `/api/audio/${arquivo}`;

export async function statusServidor(): Promise<{ ia: boolean; voz: boolean } | null> {
  if (MODO_ARTEFATO) return (await claudeDaPagina()) ? { ia: true, voz: false } : null;
  try {
    const r = await fetch("/api/status");
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

async function base64(arquivo: File): Promise<string> {
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  let binario = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario);
}

export async function criarAula(pedido: Pedido): Promise<string> {
  if (MODO_ARTEFATO) return prepararAulaNoClaude(pedido);
  const corpo = {
    tipo: pedido.tipo,
    conteudo: pedido.tipo === "pdf" ? undefined : pedido.conteudo,
    pdfBase64: pedido.tipo === "pdf" && pedido.arquivo ? await base64(pedido.arquivo) : undefined,
    objetivo: pedido.objetivo,
    reels: pedido.reels,
  };
  let resposta: Response;
  try {
    resposta = await fetch("/api/aulas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  } catch {
    throw new Error("Não consegui falar com o servidor. Confira sua internet e tente de novo.");
  }
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.erro ?? `O servidor respondeu com erro ${resposta.status}.`);
  return dados.id;
}

// Recebe o progresso da aula em tempo real. Devolve uma função que para de ouvir.
export function ouvirAula(id: string, aoEvento: (e: EventoServidor) => void): () => void {
  if (MODO_ARTEFATO) return gerarAulaNoClaude(id, aoEvento);
  const fonte = new EventSource(`/api/aulas/${id}/eventos`);
  fonte.onmessage = (m) => {
    const e = JSON.parse(m.data) as EventoServidor;
    aoEvento(e);
    if (e.tipo === "fim" || e.tipo === "erro") fonte.close();
  };
  fonte.onerror = () => {
    if (fonte.readyState === EventSource.CLOSED) aoEvento({ tipo: "erro", mensagem: "A conexão com o servidor caiu." });
  };
  return () => fonte.close();
}
