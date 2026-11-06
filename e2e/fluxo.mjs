// Teste do fluxo completo no navegador, com o Claude simulado (não gasta nada nem precisa de conta).
// Uso: npm run site:artefato && node e2e/fluxo.mjs
// Precisa do Playwright com o Chromium instalado (npx playwright install chromium).
import { chromium } from "playwright";
import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";

const RAIZ = new URL("../dist-artefato/", import.meta.url).pathname;
const AULA = JSON.parse(readFileSync(new URL("../exemplos/fotossintese.aula.json", import.meta.url), "utf8"));
const TIPOS = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html" };
const servidor = createServer((q, r) => {
  let p = join(RAIZ, decodeURIComponent(q.url.split("?")[0]));
  if (p.endsWith("/")) p += "index.html";
  if (!existsSync(p)) return r.writeHead(404).end();
  r.writeHead(200, { "Content-Type": TIPOS[extname(p)] ?? "application/octet-stream" });
  createReadStream(p).pipe(r);
}).listen(0);
const URL_SITE = `http://localhost:${servidor.address().port}/`;

// Claude de mentira: cada linha demora MS_POR_LINHA, como se fosse escrita ao vivo.
// Guarda em window.__pedidos quando cada pedido começou e terminou, para medir o paralelismo.
const simularClaude = ({ aula, msPorLinha }) => {
  const nomes = ["Fotossíntese", "Cloroplasto", "Fase clara", "Fase escura", "Fatores limitantes", "Respiração x fotossíntese"];
  const reel = (i) => ({ tipo: "reel", ...aula.reels[i % aula.reels.length], conceito: nomes[i] });
  window.__pedidos = [];
  const sample = async (prompt, o = {}) => {
    const registro = { inicio: performance.now(), fim: 0, tipo: "" };
    window.__pedidos.push(registro);
    let linhas;
    if (prompt.includes("questões inéditas")) {
      registro.tipo = "simulado";
      const q = { tipo: "questao", conceito: "Fotossíntese", textoBase: "Uma planta ficou 48 horas no escuro.", pergunta: "O que acontece com a produção de glicose?", alternativas: ["Aumenta", "Diminui", "Fica igual", "Dobra", "Vira proteína"], correta: 1, explicacao: "Sem luz não há fotossíntese.", porQue: ["Não.", "Sim.", "Não.", "Não.", "Não."] };
      linhas = [q, q, q, q, q];
    } else if (prompt.includes("já tem este plano")) {
      registro.tipo = "reels";
      linhas = nomes.map((_, i) => i).filter((i) => prompt.includes(`"${nomes[i]}"`)).map(reel);
    } else {
      registro.tipo = "aula";
      const m = prompt.match(/SÓ para os (\d+) primeiros/);
      const n = Number(prompt.match(/exatamente (\d+) conceitos/)?.[1] ?? 3);
      const k = m ? Number(m[1]) : n;
      linhas = [{ tipo: "plano", titulo: "Fotossíntese", conceitos: nomes.slice(0, n) }, ...nomes.slice(0, k).map((_, i) => reel(i))];
    }
    let texto = "";
    for (const l of linhas) {
      await new Promise((ok) => setTimeout(ok, msPorLinha));
      const linha = JSON.stringify(l) + "\n";
      texto += linha;
      o.onText?.({ text: texto, delta: linha });
    }
    registro.fim = performance.now();
    return { text: texto, truncated: false };
  };
  sample.limits = async () => ({ maxPromptBytes: 500000 });
  const docs = {};
  const db = { collection: (c) => ({ doc: (id) => ({ get: async () => ({ exists: Boolean(docs[c + id]), data: () => docs[c + id] }), set: async (v) => void (docs[c + id] = v), delete: async () => void delete docs[c + id] }) }) };
  window.claude = { use: async (n) => (n === "sample" ? sample : n === "db" ? db : n === "user" ? { id: async () => "aluno", can: async () => true } : null) };
};

const falhas = [];
const conferir = (ok, mensagem) => {
  console.log(`${ok ? "✓" : "✗"} ${mensagem}`);
  if (!ok) falhas.push(mensagem);
};

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 390, height: 844 } });
const erros = [];
pagina.on("pageerror", (e) => erros.push(e.message));
await pagina.addInitScript(simularClaude, { aula: AULA, msPorLinha: 400 });
await pagina.goto(URL_SITE);

// 1. Aula completa de 6 reels: a segunda metade é pedida em paralelo.
await pagina.fill("input.campo", "Fotossíntese");
await pagina.click("text=Completa · 6 reels");
await pagina.click(".botao-principal");
await pagina.waitForSelector(".feed", { timeout: 20000 });
await pagina.waitForFunction(() => window.__pedidos.some((p) => p.tipo === "simulado"), null, { timeout: 30000 });
const pedidos = await pagina.evaluate(() => window.__pedidos);
const [aula, resto] = pedidos;
conferir(resto?.tipo === "reels" && resto.inicio < aula.fim, "a segunda metade dos reels é pedida enquanto a primeira ainda está sendo escrita");
const reels = await pagina.locator(".reel").count();
conferir(reels === 6, `os 6 reels entram no feed (entraram ${reels})`);
const titulos = await pagina.locator(".reel-titulo").allTextContents();
const esperado = ["Fotossíntese", "Cloroplasto", "Fase clara", "Fase escura", "Fatores limitantes", "Respiração x fotossíntese"];
conferir(titulos.every((t, i) => t === `${i + 1}/6${esperado[i]}`), "cada reel fica na posição do seu conceito, mesmo com reel repetido na resposta");

// 2. Curtir com dois toques no reel: a aula curtida aparece com coração em "Suas aulas".
await pagina.click("text=Curtir");
conferir((await pagina.locator("text=Curtido").count()) === 1, "o botão Curtir marca o reel como curtido");

// 3. Responde a primeira pergunta, pula o resto e confere o resultado.
await pagina.evaluate(() => document.querySelector('[data-indice="1"]').scrollIntoView());
await pagina.waitForTimeout(700);
await pagina.locator('[data-indice="1"] .alternativa').first().click();
await pagina.waitForSelector("text=Ver meu resultado", { state: "attached", timeout: 30000 });
await pagina.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("meu resultado")).click());
await pagina.waitForSelector(".resumo");
const aprendi = await pagina.locator(".aprendi:not(.faltou) .aprendi-item b").allTextContents();
const faltou = await pagina.locator(".aprendi.faltou .aprendi-item").count();
conferir(aprendi.length === 1 && aprendi[0] === "Fotossíntese", `"O que você aprendeu" mostra só o reel visto (${aprendi.join(", ")})`);
conferir(faltou === 5, `"Você ainda não viu" lista os 5 reels pulados (listou ${faltou})`);
conferir((await pagina.locator(".heroi svg.medalha").count()) === 1, "o resultado mostra a medalha desenhada");
const medalha = await pagina.locator(".heroi-titulo").innerText();
conferir(medalha === "Em treino", `responder 1 pergunta e pular o resto não dá medalha (${medalha})`);
conferir((await pagina.locator(".heroi-acao").innerText()).includes("que faltaram"), "o resultado oferece responder as que faltaram");
conferir((await pagina.locator(".gabarito .bolha").count()) >= 6, "a correção mostra o gabarito das perguntas da aula");

// 4. De volta ao início, a aula curtida tem o coração e continua curtida ao reabrir.
await pagina.click("text=Estudar outra matéria");
await pagina.waitForSelector(".aula-salva");
conferir((await pagina.locator(".aula-salva .aula-curtida").count()) === 1, "a aula curtida aparece com coração em Suas aulas");
await pagina.click(".aula-salva-abrir");
await pagina.waitForSelector(".feed");
conferir((await pagina.locator("text=Curtido").count()) >= 1, "ao reabrir a aula, o reel continua curtido");

conferir(erros.length === 0, `nenhum erro na página ${erros.length ? `(${erros.join(" | ")})` : ""}`);
await navegador.close();
servidor.close();
if (falhas.length) {
  console.log(`\n${falhas.length} verificação(ões) falharam.`);
  process.exit(1);
}
console.log("\nTudo certo.");
