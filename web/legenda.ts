// Blocos de legenda: até 4 palavras, quebrando no fim de frase.
const MAX_POR_BLOCO = 4;

export function blocoDe(palavras: string[], indice: number): number {
  let inicio = 0;
  while (true) {
    const fim = blocoFim(palavras, inicio);
    if (indice < fim || fim >= palavras.length) return inicio;
    inicio = fim;
  }
}

export function blocoFim(palavras: string[], inicio: number): number {
  let i = inicio;
  while (i < palavras.length) {
    i++;
    if (i - inicio >= MAX_POR_BLOCO || /[.!?,;:]$/.test(palavras[i - 1])) break;
  }
  return i;
}
