# ia-de-estudos

## Como o produto funciona

1. O aluno abre o site, digita um tema, cola um texto ou envia um PDF, escolhe o objetivo (ENEM, vestibular, concurso, faculdade) e o tamanho da aula.
2. O servidor (`servidor/`) monta a aula:
   - **tema**: a IA (Claude) pesquisa o assunto na internet e escreve um dossiê com fontes;
   - **texto ou PDF**: usa o material do aluno;
   - planeja os conceitos, escreve cada reel, confere cada frase contra o material (reel reprovado é reescrito ou descartado) e grava a voz humana (ElevenLabs).
3. Cada reel aparece no feed assim que fica pronto: animação, voz, legenda palavra por palavra, toque para pausar, dois toques para curtir, "não entendi", salvar e velocidade.
4. Depois de cada reel vem uma pergunta valendo XP. No final, o resumo com acertos e o que revisar.

Sem chave da ElevenLabs, a voz é a do navegador (robótica). Sem chave do Claude, o site não gera aulas.

## Rodar no seu computador

Precisa de Node 20 ou mais novo.

```bash
npm install
cp .env.example .env    # preencha as chaves (veja abaixo)
npm start               # compila o site e abre em http://localhost:8787
```

Para mexer no visual com recarga automática, rode `npm run servidor` num terminal e `npm run site` em outro (abre em http://localhost:5173).

## Colocar no ar: o que você precisa fazer

1. **Chave do Claude (a IA)**: crie uma conta em https://console.anthropic.com, coloque créditos em *Billing* e gere uma chave em *API Keys*. Ela vai na variável `ANTHROPIC_API_KEY`.
2. **Voz humana (ElevenLabs)**: crie uma conta em https://elevenlabs.io. Em *Voice Library*, filtre por português do Brasil, escolha uma voz e adicione às suas vozes; copie o *Voice ID* para `ELEVENLABS_VOICE_ID`. Gere a chave de API para `ELEVENLABS_API_KEY`. Para vender o produto, use um plano pago, que libera uso comercial.
3. **Hospedagem**: qualquer serviço que rode Node continuamente serve. Exemplo no Render (https://render.com):
   - *New > Web Service*, conecte este repositório do GitHub;
   - Build command: `npm install && npx vite build`;
   - Start command: `npx tsx servidor/index.ts`;
   - em *Environment*, adicione `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY` e `ELEVENLABS_VOICE_ID`;
   - o Render dá um endereço `https://...onrender.com`; depois dá para ligar um domínio seu.
4. Opcional: `AULAS_POR_HORA` limita quantas aulas cada pessoa gera por hora (padrão 10), para proteger seus créditos.

**Custo estimado por aula de 3 reels** (estimativa; confira no painel depois das primeiras aulas): IA com o modelo padrão (`claude-opus-5-5`) entre US$ 0,50 e US$ 1,00, contando pesquisa e checagem; voz de cerca de 3 mil caracteres na ElevenLabs. Dá para trocar o modelo em `CLAUDE_MODEL`.

## O que ainda falta para virar produto

- Login, planos e pagamento.
- Guardar as aulas (hoje ficam na memória do servidor por 1 hora) e a revisão espaçada dos conceitos errados.
- "Não entendi" que pede à IA uma nova explicação (hoje repete a parte mais devagar).
- Ler PDF escaneado (foto).

## O gerador de vídeos (`src/`)

Protótipo da Fase 0: transforma uma matéria (PDF, texto ou só um tema) em reels verticais animados, com voz, legenda palavra por palavra e uma pergunta rápida no final.

## Como funciona

1. **Ingestão**: lê o PDF ou o texto (`src/pipeline/ingestao.ts`).
2. **Plano da aula**: o Claude escolhe de 3 a 8 conceitos e copia o trecho do material que sustenta cada um (`src/pipeline/roteiro.ts`).
3. **Roteiro**: cada conceito vira um reel em JSON, usando só os templates do projeto (`src/schema.ts`).
4. **Checagem de fonte**: outra chamada confere cada frase contra o material. Reel reprovado é reescrito uma vez; se falhar de novo, é descartado.
5. **Voz**: ElevenLabs com o tempo de cada palavra (`src/pipeline/voz.ts`). Sem chave, o vídeo sai sem áudio e a legenda segue um ritmo estimado.
6. **Render**: Remotion gera MP4 1080x1920 (`src/remotion/`).

Templates de cena: `gancho`, `lista`, `comparacao`, `linha_do_tempo`, `fixacao`, mais o card de quiz.

## Rodando

Precisa de Node 20 ou mais novo.

```bash
npm install
cp .env.example .env   # preencha as chaves

# Aula de exemplo (Revolução Francesa), sem chamar a IA:
npm run demo

# A partir de um PDF ou de um tema:
npm run gerar -- apostila.pdf
npm run gerar -- "Fotossíntese" --reels 4

# Editar os templates vendo ao vivo:
npm run studio
```

Os vídeos saem em `saida/<titulo-da-aula>/`.

## Limitações conhecidas

- PDF escaneado (foto) ainda não funciona: não há OCR.
- Material com mais de 150 mil caracteres é recusado; envie um capítulo por vez.
- Voz só pela ElevenLabs por enquanto; Azure (mais barata) é o próximo passo.
- O caminho da IA (`npm run gerar`) ainda não foi testado com uma chave real; o modo demo foi renderizado e conferido.
