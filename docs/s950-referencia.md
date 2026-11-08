# Akai S950: referência para o RJ-950

O que levantamos sobre o sampler original e o que entrou na versão reduzida.

## O aparelho (1988)

- Rack de 3 unidades (482,6 × 132,6 × 410 mm, 11 kg), cinza escuro, com teclado azul-acinzentado.
- **Painel, da esquerda para a direita** (diagrama do manual do operador): Power e Contrast; o drive de disquete de 3,5" embaixo; o LCD de 2 × 40 no centro, com os 8 botões de modo embaixo (Play, Rec, Edit Sample, Edit Program, MIDI, Utility, Disk, Master Tune) e uma tabela de parâmetros impressa no painel; o bloco de teclas (números, ON/+, OFF/−, ENT, cursor, Page, PB, Space, Letter); os knobs Rec Level, Monitor e Output, com as entradas Mic, Input e Rec/PB Trigger; e o knob grande Control no canto direito.
- **Som:** 12 bits, gravação de 7,5 a 48 kHz, 8 vozes com saídas separadas.
- **Memória:** 750 KB, até 2,25 MB com duas placas EXM-006. Com as duas: 60,9 s a 25 kHz, 38,1 s a 40 kHz, 34,6 s a 44,1 kHz, 31,7 s a 48 kHz. Até 99 samples.
- **Filtro:** passa-baixa de 6 polos (36 dB por oitava), Butterworth, sem ressonância: o chip MF6CN-50, um filtro de capacitor chaveado. Tem keytrack. Fontes: datasheet do MF6 (National/TI) e manual de uso, p. 94.
- **Edição:** início, fim, loop (com crossfade), time stretch, keygroups com faixa de notas, envelopes e LFO.
- **Uso com o SP-1200:** o SP fazia a bateria e o sequenciamento e mandava notas MIDI ao S950, que tocava loops, baixos e frases mais longas e filtradas.

## O que o RJ-950 faz

| S950 | RJ-950 |
|---|---|
| LCD 2 × 40, 8 modos, teclado, Control | Igual, com as páginas simplificadas (manual, seção 16). |
| 12 bits, 7,5 a 48 kHz | Igual. Padrão 32 kHz. |
| 2,25 MB com expansões | Já vem com 2,25 MB: 48 s a 32 kHz. |
| Filtro de 6 polos sem ressonância (MF6CN-50) | Igual: Butterworth de 6 polos, de 60 Hz a aberto (FILTER 00 a 99). Também tem um anti-imaging fixo de 6 polos em 0,4 × a taxa de reprodução. O keytrack ficou de fora. |
| Keygroups e programas | Um programa só: cada pad do RJ-2000 aponta para um sample. |
| Notas por cabo MIDI | Ligado direto aos pads do RJ-2000 (notas 36 a 67). |
| Copiar sample gasta memória | A cópia divide a memória com o original. |
| Envelope do VCA (ADSR de volume) | Entrou, por sample (Edit Sample, página 6). |
| Envelope do filtro, LFO, crossfade, time stretch, saídas separadas | Ficaram de fora. |

## Fontes

- Datasheet do MF6 (National Semiconductor, hoje Texas Instruments): filtro passa-baixa Butterworth de 6ª ordem, de capacitor chaveado. É o MF6CN-50 do S950.
- Manual de uso do S950, p. 94: o filtro.
- [Akai S950 na Polynominal](https://www.polynominal.com/akai-s950/index.html): formato, display, memória, filtro, envelopes, time stretch.
- [Review do S950 na Music Technology (arquivo Muzines)](https://www.muzines.co.uk/articles/akai-s950/1372): tabela de tempo de sample por taxa e memória, time stretch, teclado azul-acinzentado.
- Manual do operador do S950 (diagrama do painel frontal), cópia em [manuals.fdiskc.com](https://manuals.fdiskc.com/flat/Akai%20S-950%20Owners%20Manual.pdf). Não incluímos o manual no repositório porque é material protegido da Akai.
