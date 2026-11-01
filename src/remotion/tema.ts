export const FPS = 30;
export const LARGURA = 1080;
export const ALTURA = 1920;
export const QUIZ_SEGUNDOS = 6;

export const FONTE = "Inter, 'Helvetica Neue', Arial, sans-serif";
export const FUNDO = "#F6F7FC";
export const TEXTO = "#0F1222";
export const TEXTO_SUAVE = "rgba(15,18,34,0.58)";
export const CERTO = "#16A34A";

// Tema claro com profundidade: cartões brancos, borda fina e sombra longa e suave.
export const SUPERFICIE = "#FFFFFF";
export const BORDA = "rgba(15,18,34,0.08)";
export const SOMBRA = "0 30px 70px rgba(60,50,140,0.16), 0 6px 16px rgba(60,50,140,0.08)";
export const SOBRE_DESTAQUE = "#FFFFFF";

// Uma cor de destaque por reel, para a aula não ficar monótona no feed.
const DESTAQUES = ["#6C4CF5", "#0E9F87", "#F06A1D", "#2F7BEA", "#E5397F"];
export const destaque = (numero: number) => DESTAQUES[(numero - 1) % DESTAQUES.length];
