export const FPS = 30;
export const LARGURA = 1080;
export const ALTURA = 1920;
export const QUIZ_SEGUNDOS = 6;

export const FONTE = "Inter, 'Helvetica Neue', Arial, sans-serif";
export const FUNDO = "#0B1020";
export const TEXTO = "#F5F7FF";
export const TEXTO_SUAVE = "rgba(245,247,255,0.65)";
export const CERTO = "#2BD47D";

// Uma cor de destaque por reel, para a aula não ficar monótona no feed.
const DESTAQUES = ["#8B6CFF", "#00C2A8", "#FF8A3D", "#3DA5FF", "#FF5C8A"];
export const destaque = (numero: number) => DESTAQUES[(numero - 1) % DESTAQUES.length];
