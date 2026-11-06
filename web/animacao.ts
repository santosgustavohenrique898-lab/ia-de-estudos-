import { useEffect, useRef, useState } from "react";

// Quem pediu ao sistema menos movimento vê tudo parado (sem contagem, confete nem brilho).
export const menosMovimento = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

// Conta de `de` até `ate` em `duracao` ms, desacelerando no fim. Se o alvo muda, conta do valor atual até o novo.
export function useContagem(ate: number, { de = 0, duracao = 1200, atraso = 0 }: { de?: number; duracao?: number; atraso?: number } = {}) {
  const parado = menosMovimento();
  const [valor, setValor] = useState(parado ? ate : de);
  const atual = useRef(parado ? ate : de);
  useEffect(() => {
    if (menosMovimento()) {
      atual.current = ate;
      setValor(ate);
      return;
    }
    const partida = atual.current;
    let quadro = 0;
    let inicio = 0;
    const passo = (agora: number) => {
      if (!inicio) inicio = agora;
      const t = Math.min(1, (agora - inicio) / duracao);
      const v = partida + (ate - partida) * (1 - Math.pow(1 - t, 3));
      atual.current = v;
      setValor(v);
      if (t < 1) quadro = requestAnimationFrame(passo);
    };
    const espera = window.setTimeout(() => {
      quadro = requestAnimationFrame(passo);
    }, atraso);
    return () => {
      clearTimeout(espera);
      cancelAnimationFrame(quadro);
    };
  }, [ate, duracao, atraso]);
  return valor;
}
