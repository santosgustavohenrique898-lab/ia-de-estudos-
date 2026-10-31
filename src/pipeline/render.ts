import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { ReelProps } from "../remotion/ReelVideo.js";

const ENTRADA = fileURLToPath(new URL("../remotion/index.ts", import.meta.url));

export type Renderizador = (props: ReelProps, arquivo: string) => Promise<void>;

// Empacota os templates uma vez; cada reel é renderizado com suas próprias props.
// `pastaPublica` é onde ficam os áudios, servidos via staticFile().
export async function prepararRender(pastaPublica: string): Promise<Renderizador> {
  await mkdir(pastaPublica, { recursive: true });
  const serveUrl = await bundle({ entryPoint: ENTRADA, publicDir: pastaPublica });
  const browserExecutable = process.env.CHROME_PATH || null;

  return async (props, arquivo) => {
    const inputProps = props as unknown as Record<string, unknown>;
    const composition = await selectComposition({ serveUrl, id: "Reel", inputProps, browserExecutable });
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: arquivo,
      inputProps,
      browserExecutable,
      crf: 20,
    });
  };
}
