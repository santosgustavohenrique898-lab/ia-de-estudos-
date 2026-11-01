# LearningFlix

## Como o produto funciona

1. O aluno abre o site, digita um tema, cola um texto ou envia um PDF, escolhe o objetivo (ENEM, vestibular, concurso, faculdade) e o tamanho da aula.
2. O servidor (`servidor/`) monta a aula:
   - **tema**: a IA (Claude) pesquisa o assunto na internet e escreve um dossiê com fontes;
   - **texto ou PDF**: usa o material do aluno;
   - planeja os conceitos, escreve cada reel, confere cada frase contra o material (reel reprovado é reescrito ou descartado) e grava a voz humana (ElevenLabs).
3. Cada reel aparece no feed assim que fica pronto: animação, voz, legenda palavra por palavra, toque para pausar, dois toques para curtir, "não entendi", salvar e velocidade.
4. Depois de cada reel vem uma pergunta valendo XP. No final, o resumo com acertos e o que revisar.

Sem chave da ElevenLabs, a voz é a do navegador (robótica). Sem chave do Claude, o site não gera aulas.

## Versão dentro do Claude (link do Artifact)

O mesmo site também roda publicado como Artifact do Claude, sem servidor nenhum: quem abre o link gera a aula com o **próprio Claude** (a capacidade `sample` do Artifact), direto do navegador (`web/artefato.ts`).

- Funciona para qualquer tema, texto colado ou PDF (o texto do PDF é lido no navegador).
- Na primeira aula, o Claude pede permissão para a página usar a conta de quem está vendo; o uso sai do plano dessa pessoa.
- Não pesquisa na internet: o tema é explicado com o conhecimento do próprio Claude.
- A voz é a do navegador. Voz humana só na versão com servidor e chave da ElevenLabs.
- Um pedido só monta o plano e todos os reels; cada reel entra no feed assim que termina de ser escrito. Se a resposta vier cortada, o site pede só os reels que faltaram.
- Também aceita fotos do caderno ou da apostila (aba Foto): as fotos vão junto no pedido ao Claude.
- Com os reels prontos, o Claude escreve um simulado no estilo do objetivo (ENEM, vestibular, concurso ou faculdade), com texto-base, 5 alternativas e o porquê de cada uma. Se o simulado falhar, a aula termina sem ele.
- "Não entendi" pede ao Claude (modelo rápido) uma explicação nova da parte em que o aluno travou, tocada como um mini-reel por cima do reel.
- No fim, o resumo da aula sai como imagem PNG para baixar e mandar no grupo (`web/resumoImagem.ts`).

### Progresso salvo e revisão espaçada (`web/progresso.ts`)

- O que o aluno errou (ou marcou com "Revisar" ou "Não entendi") vira um cartão de revisão: volta no dia seguinte, depois em 3 e em 7 dias; errar faz voltar para o dia seguinte.
- Meta do dia (5, 10 ou 20 perguntas, todas contam) e ofensiva de dias seguidos batendo a meta.
- As aulas ficam salvas (as 20 mais recentes) para assistir de novo sem gerar outra vez.
- Onde fica salvo: na conta do Claude de quem usa (capacidade `db`, pasta privada `data/users/<id>`), quando a pessoa pode gravar no link (Contributor ou acima). Quem só pode ver o link, ou abre fora do Claude, tem o progresso salvo no próprio navegador.

O Artifact declara `{"sample": {"images": true}, "db": {}, "user": {}, "downloads": true}`.

Para gerar os arquivos dessa versão: `npm run site:artefato` (sai em `dist-artefato/`).

## Teste automático

`npm run teste` compila a versão do Artifact e percorre o fluxo inteiro num navegador, com o Claude simulado (não gasta nada): gera uma aula de 6 reels, confere que a segunda metade é pedida em paralelo e que cada reel fica na posição certa, curte um reel, responde, pula o resto e confere o resultado e "Suas aulas". Na primeira vez, rode `npx playwright install chromium`.

## Rodar no seu computador

Precisa de Node 20 ou mais novo.

```bash
npm install
cp .env.example .env    # preencha as chaves (veja abaixo)
npm start               # compila o site e abre em http://localhost:8787
```

Para mexer no visual com recarga automática, rode `npm run servidor` num terminal e `npm run site` em outro (abre em http://localhost:5173).

## Colocar no ar: o que você precisa fazer

A voz humana só funciona na versão hospedada: o link dentro do Claude não pode chamar serviços de fora.

1. **Voz humana (ElevenLabs)**: crie uma conta em https://elevenlabs.io.
   - Em *Voices > Explore*, filtre por português do Brasil, ouça e escolha uma voz de narração; clique em *Add to my voices*.
   - Em *My voices*, abra a voz e copie o *Voice ID*: ele vai em `ELEVENLABS_VOICE_ID`.
   - Em *API Keys*, crie uma chave com permissão de *Text to Speech*: ela vai em `ELEVENLABS_API_KEY`.
   - O plano gratuito serve para testar. Para vender, use um plano pago, que libera uso comercial. Cada reel gasta cerca de mil caracteres.
2. **A IA (Claude)**: em https://console.anthropic.com, coloque créditos em *Billing* e gere uma chave em *API Keys*. Ela vai em `ANTHROPIC_API_KEY`.
3. **Hospedagem (Render)**: crie uma conta em https://render.com entrando com o GitHub.
   - *New > Blueprint*, escolha este repositório. O Render lê o `render.yaml`, pede as três chaves acima e publica o site.
   - Em alguns minutos o site fica no ar num endereço `https://...onrender.com`; depois dá para ligar um domínio seu.
   - O plano gratuito do Render "dorme" depois de um tempo sem uso, e a primeira visita demora cerca de 1 minuto. Para vender, use um plano pago.
4. Opcional: `AULAS_POR_HORA` limita quantas aulas cada pessoa gera por hora (padrão 10), para proteger seus créditos.

Como a voz humana entra no reel: a fala do reel inteiro é gravada de uma vez (sem cortes entre as cenas), e a ElevenLabs devolve o tempo de cada palavra. A legenda acende exatamente a palavra dita, e cada cena entra um instante antes de a voz começar a falar dela. Se a voz falhar num reel (créditos acabaram, chave ou voz errada), o reel não se perde: ele toca com a voz do navegador e o motivo aparece no log do servidor.

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
- Voz humana só pela ElevenLabs por enquanto; Azure (mais barata) é o próximo passo.
- O caminho da IA (`npm run gerar`) ainda não foi testado com uma chave real; o modo demo foi renderizado e conferido.
