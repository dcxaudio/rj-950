# RJ-950

Sampler de rack de 12 bits que roda no navegador, inspirado no Akai S950. É um projeto open source da [DCX Audio](https://github.com/dcxaudio).

**Abrir:** [dcxaudio.github.io/rj-950](https://dcxaudio.github.io/rj-950/). No [DCX Studio](https://dcxaudio.github.io/dcx-studio/), ele fica embaixo do RJ-2000 e toca pelos pads dele.

- Solte um WAV ou MP3 no drive. As teclas A a K tocam os pads A1 a A8, e as notas MIDI 36 a 67 tocam os 32 pads.
- O botão **MIDI Learn** no alto da página aprende qualquer controle do painel.
- O manual está em [docs/manual.md](docs/manual.md), e a referência do S950 em [docs/s950-referencia.md](docs/s950-referencia.md).

## Rodar no seu computador

O código comum vem do [dcx-core](https://github.com/dcxaudio/dcx-core), um submódulo em `vendor/dcx-core`:

```bash
git clone --recurse-submodules https://github.com/dcxaudio/rj-950.git
```

```bash
cd rj-950 && python3 -m http.server 8000
```

Depois abra `http://localhost:8000`. Não tem build nem dependências.

## Estrutura

```
index.html            página solo (host do dcx-core com só o 950)
js/solo.js            monta a página: host, teclado, mapa MIDI padrão, tela de ligar
js/s950.js            o aparelho: memória, vozes, filtro, envelope e páginas
css/rj950.css         o painel
docs/                 manual e referência do S950
vendor/dcx-core/      submódulo (v1.0.0)
```

## Licença

GPL-3.0 ([LICENSE](LICENSE)).
