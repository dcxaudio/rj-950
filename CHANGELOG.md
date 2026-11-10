# Changelog

## Próxima

- **Face nova**, igual ao mockup aprovado (que segue a foto do original): chapa clara de 977 x 295 (razão 3,31:1) sem orelhas de rack, logo DCX vermelha, POWER com moldura preta, DISPLAY CONTRAST serrilhado, LCD de moldura preta larga com vidro verde e 40 colunas, MIDI RECEIVE com LED quadrado, 8 teclas brancas de modo com LED em barra, as 3 tabelas impressas (EDIT SAMPLE, EDIT PROGRAM, DISK), placa cinza com teclado azul (numerais brancos, como na foto; a variável `--r950-key-num` troca a cor), ARROW/CURSOR, PAGE, SPACE, LETTER, ENT e P.B cinzas, CONTROL de alumínio, REC LEVEL (aleta vermelha), MONITOR e OUTPUT com escala MIN/MAX, jacks MIC/LINE/TRIGGER e drive de disquete com fenda, porta, LED e ejetar. Tudo em CSS, sem imagens; a face escala com a largura (container query), sem JS.
- O funcionamento não mudou: mesmos ids e `data-r9*`, o `js/s950.js` é o mesmo. O LCD continua com as 2 linhas que o 950 usa, dentro do vidro de 1 linha do original. Sem tecla "." no painel (ela fica escondida para o MIDI Learn; o ponto vem do teclado do computador). SPACE e LETTER são só do painel. A tabela de páginas virou ajuda opcional, recolhida embaixo do painel ("Funções de cada modo"). Decisão de Igor: o visor mantém as 2 linhas (diferença consciente em relação ao mockup, que tinha 1 linha).

- FILTER igual ao do S950: passa-baixa Butterworth de **6 polos** (36 dB por oitava, −3 dB no corte, sem pico), como o chip MF6. Antes era de 2 polos, com um pico de +0,5 dB no corte. Ganhou também um anti-imaging fixo de 6 polos em 0,4 × a taxa em que o sample sai, ligado inclusive em FILTER 99, que tira o chiado metálico das taxas baixas.

## b0.1 (beta)

- O RJ-950 ganha repositório e página próprios. O histórico de `js/s950.js` e de `docs/s950-referencia.md` vem do [RJ-2000](https://github.com/dcxaudio/rj-2000), onde ele nasceu como o rack embaixo do SP.
- Página solo com o host do [dcx-core](https://github.com/dcxaudio/dcx-core) v1.0.0 (submódulo em `vendor/dcx-core`). Os dados ficam no navegador com o prefixo `rj950/`.
- Teclas A a K tocam os pads A1 a A8. O mapa MIDI padrão (notas 36 a 67 nos 32 pads) desliga quando algum controle aprende.
- Botão **MIDI Learn** na página, para aprender sem o SET-UP 22 do RJ-2000.
- O LCD mostra b0.1.
