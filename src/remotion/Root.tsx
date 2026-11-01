import { Composition } from "remotion";
import { ReelVideo, type ReelProps } from "./ReelVideo";
import { ALTURA, FPS, LARGURA, QUIZ_SEGUNDOS } from "./tema";
import exemplo from "../../exemplos/revolucao-francesa.preview.json";

export const Root = () => (
  <Composition
    id="Reel"
    component={ReelVideo}
    fps={FPS}
    width={LARGURA}
    height={ALTURA}
    durationInFrames={FPS * 30}
    defaultProps={exemplo as unknown as ReelProps}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.ceil((props.narracao.duracao + QUIZ_SEGUNDOS) * FPS),
    })}
  />
);
