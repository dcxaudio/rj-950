# Manual do RJ-950 (b0.1)

O RJ-950 é um sampler de rack inspirado no Akai S950. Ele roda sozinho nesta página ou no rack do DCX Studio, embaixo do RJ-2000.

## Sozinho nesta página

- Aperte **LIGAR** (ou Espaço). Depois ligue o 950 no botão Power do painel, se ele não ligar sozinho.
- Solte um WAV ou MP3 no drive (ou clique no drive) para carregar um sample.
- Teclas **A S D F G H J K** tocam os pads 1 a 8 (banco A). Depois de clicar no painel, números, setas e Enter vão para o 950, como abaixo.
- MIDI: as notas 36 a 67 tocam os 32 pads (36 = A1). Com qualquer controle aprendido, esse mapa desliga.
- **MIDI Learn:** o botão no alto da página. Toque num controle do 950, mexa no controlador e aperte Enter (ou Save). Delete apaga o do controle escolhido, Esc sai.
- O que fica salvo neste navegador: os samples e o mapa MIDI (chaves `rj950/...`).

No Studio, quem toca o 950 são os pads e o sequenciador do RJ-2000, e o MIDI Learn fica no SET-UP 22 do SP.

Versão reduzida, inspirada no Akai S950 de 1988, o sampler que muita gente usava junto com o SP-1200. O SP mandava notas MIDI e o S950 tocava os loops, os baixos e as frases, com mais tempo de sample e o filtro. Aqui os dois já vêm ligados.

**Ligando:** o 950 liga junto com o SP (`LOADING OPERATING SYSTEM`) e volta com a memória salva no navegador. O botão **Power** desliga e liga só ele. O LCD é de 2 linhas e 40 caracteres, com mensagens em maiúsculas, como no original. (O mockup da face nova tinha 1 linha; por decisão de Igor o visor mantém as 2 linhas do original do 950.)

## Como os pads do SP tocam o 950

Cada pad do RJ-2000 manda uma nota (A1 = 36 ... D8 = 67), tocado ao vivo ou pelo sequenciador. No 950, cada pad pode apontar para um sample. O pad toca o som do SP **e** o sample do 950; por isso o normal é usar pads vazios no SP, o truque da época. A luz **MIDI** pisca a cada nota recebida.

- Ao carregar ou gravar um sample, o 950 já liga ele ao primeiro pad vazio do SP (sem som no SP e sem sample do 950) e mostra qual foi, por exemplo `ON PAD C1`.
- No **Edit Program** dá para trocar: toque o pad no SP (ou gire o Control com o cursor em PAD) e escolha o sample em SMP (`--` = nenhum).
- Gravar no SP funciona normal: o segmento guarda o pad, e o 950 toca junto.
- Run/Stop parando o SP também para o que o 950 estiver tocando. Um sample com loop toca até o próximo disparo do mesmo pad ou até o SP parar.

## Painel

A face segue a do original: chapa clara de 977 x 295 (razão 3,31:1), sem orelhas de rack. Ela encolhe junto com a largura da página (no Studio e no celular), sem mudar a posição das peças.

- **Modos** (8 teclas brancas embaixo do LCD, com luz): Play, Rec, Edit Sample, Edit Prgrm, MIDI, Utility, Disk, Master Tune. Apertar o mesmo modo de novo passa para a página seguinte. As tabelas impressas embaixo das teclas (EDIT SAMPLE, EDIT PROGRAM, DISK) são decoração, como no original; as páginas do RJ-950 ficam em **Funções de cada modo**, embaixo do painel (recolhido).
- **Control** (o knob grande): gira o valor que está no cursor. Arraste para cima ou para baixo, ou use a roda do mouse. Girando rápido, os passos ficam maiores.
- **Teclado** (placa cinza, teclas azuis e cinzas): números digitam um valor, **Ent** confirma (ou executa a página). O painel não tem tecla de ponto, como o original: o ponto decimal vem da tecla **.** do computador (ou de um controle MIDI aprendido). **Space** e **Letter** estão no painel como no original, mas não fazem nada no RJ-950. **◀ ▶** movem o cursor, **Page ▲▼** trocam de página, **On/+** e **Off/−** sobem ou descem um passo (segurando, repetem). **PB** toca ou para o sample atual.
- **Disquete:** clique para escolher um arquivo de áudio ou solte o arquivo em cima dele. A luz vermelha do drive pisca enquanto carrega.
- **Rec Level** (ganho do microfone, de −12 a +36 dB), **Monitor** (ouvir a entrada) e **Output** (volume do 950). O 950 sai junto com o SP, mas não passa pelo Mix Volume dele. **Contrast** ajusta o LCD.

## Modos e páginas

| Modo | Página | O que faz |
|---|---|---|
| Play | | Escolhe o sample (SMP), mostra o pad ligado a ele e a memória livre. Parado, tocar um pad do SP também escolhe o sample. |
| Rec | | Grava pelo microfone. RATE (taxa), LEN (tempo máximo) e THR (limiar; 00 = grava na hora). Ent começa, Ent de novo para. |
| Edit Sample | 1 | ST e END: início e fim, em segundos. A linha 2 mostra o sample inteiro, com o trecho usado aceso e marcas no início e no fim. |
| | 2 | LOOP ON/OFF e AT: o loop vai do ponto AT até o fim. |
| | 3 | TUNE (±24 semitons), FINE (±50 cents), LEVEL (00 a 99) e REVERSE. |
| | 4 | FILTER: passa-baixa de 6 polos sem ressonância (Butterworth, 36 dB por oitava), como o MF6 do S950. 99 = aberto; abaixando, o corte desce até 60 Hz. |
| | 5 | CUT GROUP: OFF ou 1 a 9. Samples no mesmo grupo cortam um ao outro: tocar um para o que estava soando. A linha 2 mostra quais samples estão no grupo. |
| | 6 | Envelope do VCA (volume): ATTACK, DECAY, SUSTAIN e RELEASE, de 00 a 99. ATTACK é o tempo para subir, DECAY o tempo para cair até o nível do SUSTAIN, e o som fica no SUSTAIN enquanto o pad está apertado. RELEASE é a cauda depois de soltar o pad. Os tempos vão de 0 a 10 s, mais finos nos valores baixos (10 ≈ 0,01 s, 50 ≈ 1,3 s, 99 = 10 s). Com RELEASE em OFF (o padrão), o sample é one shot: toca inteiro mesmo soltando o pad, como antes. No sequenciador as notas não têm duração (como no SP), então o som fica no SUSTAIN até acabar ou até ser cortado por outra nota ou pelo CUT GROUP, e aí entra o RELEASE. O padrão (00, 00, 99, OFF) soa igual a sem envelope. |
| Edit Program | | PAD do SP → SMP do 950. |
| MIDI | | Liga ou desliga a recepção dos pads do SP. |
| Utility | 1 | COPY: cria uma cópia do sample que usa a mesma memória. Serve para tocar trechos diferentes do mesmo loop em pads diferentes. |
| | 2 | DELETE: Ent duas vezes. |
| | 3 | CLEAR ALL MEMORY: Ent duas vezes. |
| Disk | 1 | LOAD AUDIO FILE e RATE, a taxa usada para converter o arquivo. |
| | 2 | SAVE MEMORY: baixa `rj-950-memoria.json` com todos os samples. |
| | 3 | LOAD MEMORY: abre esse arquivo (substitui a memória). |
| Master Tune | | Afinação geral, ±50 cents. |

**Início, fim e loop caem no cruzamento de zero:** girando o Control, o ponto anda na direção do giro até o zero seguinte; digitando um valor (por exemplo `1.25` e Ent), vai para o zero mais perto. Assim o corte não estala.

## Fatiando um loop entre os pads

1. Solte o loop no disquete. Ele entra como SMP 01 e fica ligado, por exemplo, ao pad C1.
2. Em Edit Sample, página 5, ponha CUT GROUP em 1. Assim as fatias se cortam, como num sampler de loop: tocar uma fatia para a anterior.
3. Na página 1, ajuste ST e END para o primeiro trecho. Toque C1 no SP para ouvir.
4. Utility > COPY (Ent). A cópia vira o SMP 02, já ligada ao C2, no mesmo grupo de corte e sem gastar memória.
5. Ajuste ST e END da cópia para o próximo trecho. Repita para os outros pads.

Para que as fatias toquem por cima umas das outras, deixe CUT GROUP em OFF. Dá para mudar o grupo de cada fatia depois, na página 5.

## O som e a memória

- **12 bits**, como o S950. A taxa (RATE) é escolhida ao carregar ou gravar, de 7,5 a 48 kHz (padrão 32 kHz). Taxa mais baixa dá mais tempo e um som mais sujo.
- **Memória de 2,25 MB**, como um S950 com as duas expansões EXM-006: 48 s a 32 kHz, 38 s a 40 kHz, 32 s a 48 kHz. Arquivo que não cabe é cortado no fim (`MEMORY FULL: END CUT`).
- **8 vozes.** O mesmo sample disparado de novo corta o anterior, e samples no mesmo CUT GROUP se cortam. Com as 8 ocupadas, a mais antiga para.
- Até 99 samples.

## O que ficou de fora do S950

Para simplificar: keygroups e programas múltiplos (aqui é um programa só, um sample por pad), o envelope do filtro (só o do VCA, de volume, entrou), LFO, crossfade de loop, time stretch e saídas separadas. O 950 não recebe notas próprias: um controlador MIDI toca os pads do SP (seção 15), e os pads tocam o 950. Os botões e knobs do 950, o Control incluído, aprendem MIDI pelo Learn do SP. O REVERSE não usa o loop.
