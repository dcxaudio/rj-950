# Changelog

## Próxima

- FILTER igual ao do S950: passa-baixa Butterworth de **6 polos** (36 dB por oitava, −3 dB no corte, sem pico), como o chip MF6. Antes era de 2 polos, com um pico de +0,5 dB no corte. Ganhou também um anti-imaging fixo de 6 polos em 0,4 × a taxa em que o sample sai, ligado inclusive em FILTER 99, que tira o chiado metálico das taxas baixas.

## b0.1 (beta)

- O RJ-950 ganha repositório e página próprios. O histórico de `js/s950.js` e de `docs/s950-referencia.md` vem do [RJ-2000](https://github.com/dcxaudio/rj-2000), onde ele nasceu como o rack embaixo do SP.
- Página solo com o host do [dcx-core](https://github.com/dcxaudio/dcx-core) v1.0.0 (submódulo em `vendor/dcx-core`). Os dados ficam no navegador com o prefixo `rj950/`.
- Teclas A a K tocam os pads A1 a A8. O mapa MIDI padrão (notas 36 a 67 nos 32 pads) desliga quando algum controle aprende.
- Botão **MIDI Learn** na página, para aprender sem o SET-UP 22 do RJ-2000.
- O LCD mostra b0.1.
