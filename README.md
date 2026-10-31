# ia-de-estudos

## O site (`web/`)

Página inicial onde o aluno digita um tema, cola um texto ou envia um PDF, escolhe o objetivo (ENEM, vestibular, concurso, faculdade) e o tamanho da aula. Depois vem um feed vertical, como nos apps de vídeo:

- reels animados tocando ao vivo, com voz do navegador e legenda que acompanha a palavra falada;
- toque para pausar, dois toques para curtir, botões de "não entendi", salvar para revisar, som e velocidade;
- depois de cada reel, uma pergunta que se responde com um toque, com XP, sequência de acertos e confete;
- tela final com porcentagem de acerto e os conceitos para revisar.

```bash
npm run site         # abre em http://localhost:5173
npm run site:build   # gera a versão estática em dist-web/
```

Por enquanto o site é uma demonstração: toda aula usa o conteúdo de exemplo (Revolução Francesa). O próximo passo é ligar o site ao gerador abaixo por meio de um servidor.

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
