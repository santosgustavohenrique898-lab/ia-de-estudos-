import type { CSSProperties, ReactNode } from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Cena } from "../../schema";
import { BORDA, SOBRE_DESTAQUE, SOMBRA, SUPERFICIE, TEXTO, TEXTO_SUAVE } from "../tema";

// Área útil entre o cabeçalho e a legenda.
const AREA: CSSProperties = {
  position: "absolute",
  top: 300,
  left: 80,
  right: 80,
  height: 1120,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  color: TEXTO,
};

// Entrada com mola: sobe e aparece. `atraso` em frames.
const Entra = ({ atraso = 0, children, style }: { atraso?: number; children: ReactNode; style?: CSSProperties }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - atraso, fps, config: { damping: 14, mass: 0.6 } });
  return (
    <div style={{ opacity: p, transform: `perspective(1400px) translateY(${(1 - p) * 70}px) rotateX(${(1 - p) * 28}deg)`, transformOrigin: "50% 100%", ...style }}>
      {children}
    </div>
  );
};

const Titulo = ({ texto, cor, tamanho = 76 }: { texto: string; cor: string; tamanho?: number }) => (
  <Entra>
    <div style={{ fontSize: tamanho, fontWeight: 900, lineHeight: 1.08, marginBottom: 56 }}>
      {texto}
      <div style={{ width: 120, height: 10, borderRadius: 5, background: cor, marginTop: 28 }} />
    </div>
  </Entra>
);

export const CenaVisual = ({ cena, cor }: { cena: Cena; cor: string }) => {
  switch (cena.template) {
    case "gancho":
      return (
        <div style={{ ...AREA, alignItems: "center", textAlign: "center" }}>
          <Entra>
            <div style={{ fontSize: 104, fontWeight: 900, lineHeight: 1.05 }}>{cena.titulo}</div>
          </Entra>
          {cena.subtitulo && (
            <Entra atraso={10}>
              <div style={{ fontSize: 48, fontWeight: 600, color: cor, marginTop: 48 }}>{cena.subtitulo}</div>
            </Entra>
          )}
        </div>
      );

    case "definicao":
      return (
        <div style={AREA}>
          <Entra>
            <div style={{ fontSize: 40, fontWeight: 800, color: cor, letterSpacing: 4, marginBottom: 24 }}>O QUE É</div>
          </Entra>
          <Entra atraso={6}>
            <div style={{ fontSize: 96, fontWeight: 900, lineHeight: 1.05, marginBottom: 48 }}>{cena.termo}</div>
          </Entra>
          <Entra atraso={16}>
            <div
              style={{
                fontSize: 54,
                fontWeight: 600,
                lineHeight: 1.3,
                borderLeft: `10px solid ${cor}`,
                paddingLeft: 36,
              }}
            >
              {cena.definicao}
            </div>
          </Entra>
        </div>
      );

    case "exemplo":
      return (
        <div style={AREA}>
          <Entra>
            <div
              style={{
                display: "inline-block",
                fontSize: 40,
                fontWeight: 800,
                color: SOBRE_DESTAQUE,
                background: cor,
                borderRadius: 999,
                padding: "12px 32px",
                marginBottom: 44,
              }}
            >
              {cena.titulo}
            </div>
          </Entra>
          <Entra atraso={10}>
            <div
              style={{
                fontSize: 58,
                fontWeight: 700,
                lineHeight: 1.3,
                background: SUPERFICIE,
                border: `2px solid ${BORDA}`,
                boxShadow: SOMBRA,
                borderRadius: 36,
                padding: "52px 48px",
              }}
            >
              “{cena.situacao}”
            </div>
          </Entra>
        </div>
      );

    case "lista":
      return (
        <div style={AREA}>
          <Titulo texto={cena.titulo} cor={cor} />
          {cena.itens.map((item, i) => (
            <Entra key={i} atraso={12 + i * 14}>
              <div style={{ display: "flex", alignItems: "center", gap: 32, marginBottom: 36 }}>
                <div
                  style={{
                    minWidth: 76,
                    height: 76,
                    borderRadius: 22,
                    background: cor,
                    color: SOBRE_DESTAQUE,
                    fontSize: 42,
                    fontWeight: 900,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ fontSize: 54, fontWeight: 700, lineHeight: 1.15 }}>{item}</div>
              </div>
            </Entra>
          ))}
        </div>
      );

    case "comparacao":
      return (
        <div style={AREA}>
          <Titulo texto={cena.titulo} cor={cor} tamanho={68} />
          <div style={{ display: "flex", gap: 28 }}>
            {[cena.esquerda, cena.direita].map((lado, i) => (
              <Entra key={i} atraso={12 + i * 16} style={{ flex: 1 }}>
                <div
                  style={{
                    border: `4px solid ${i === 0 ? cor : BORDA}`,
                    borderRadius: 32,
                    padding: "36px 32px",
                    minHeight: 560,
                    background: i === 0 ? `linear-gradient(160deg, #FFFFFF, ${cor}1A)` : SUPERFICIE,
                    boxShadow: SOMBRA,
                  }}
                >
                  <div style={{ fontSize: 48, fontWeight: 900, marginBottom: 28, color: i === 0 ? cor : TEXTO }}>{lado.nome}</div>
                  {lado.pontos.map((p, k) => (
                    <div key={k} style={{ fontSize: 38, fontWeight: 600, lineHeight: 1.2, marginBottom: 22 }}>
                      • {p}
                    </div>
                  ))}
                </div>
              </Entra>
            ))}
          </div>
        </div>
      );

    case "linha_do_tempo":
      return (
        <div style={AREA}>
          <Titulo texto={cena.titulo} cor={cor} tamanho={68} />
          <div style={{ position: "relative", paddingLeft: 70 }}>
            <div style={{ position: "absolute", left: 22, top: 20, bottom: 20, width: 6, borderRadius: 3, background: BORDA }} />
            {cena.eventos.map((e, i) => (
              <Entra key={i} atraso={12 + i * 14}>
                <div style={{ position: "relative", marginBottom: 48 }}>
                  <div style={{ position: "absolute", left: -62, top: 12, width: 34, height: 34, borderRadius: 17, background: cor }} />
                  <div style={{ fontSize: 46, fontWeight: 900, color: cor }}>{e.data}</div>
                  <div style={{ fontSize: 44, fontWeight: 600, lineHeight: 1.2, marginTop: 6 }}>{e.texto}</div>
                </div>
              </Entra>
            ))}
          </div>
        </div>
      );

    case "fixacao":
      return (
        <div style={{ ...AREA, alignItems: "center", textAlign: "center" }}>
          <Entra>
            <div style={{ fontSize: 40, fontWeight: 800, color: cor, letterSpacing: 4, marginBottom: 40 }}>LEVE PARA A PROVA</div>
          </Entra>
          <Entra atraso={8}>
            <div
              style={{
                fontSize: 70,
                fontWeight: 900,
                lineHeight: 1.15,
                border: `5px solid ${cor}`,
                borderRadius: 40,
                padding: "56px 48px",
                background: `${cor}1A`,
              }}
            >
              {cena.frase}
            </div>
          </Entra>
          <Entra atraso={20}>
            <div style={{ fontSize: 34, color: TEXTO_SUAVE, marginTop: 40 }}>a seguir: pergunta rápida</div>
          </Entra>
        </div>
      );
  }
};
