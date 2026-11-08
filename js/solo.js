/* RJ-950 - pagina solo
 *
 * Monta um host so com o 950 (RJ.Host.solo): targets() devolve so "file" e o
 * armazenamento usa o prefixo "rj950/". No Studio, quem monta o 950 e a pagina
 * do dcx-studio, e quem toca os pads e o RJ-2000.
 */
(function () {
  "use strict";
  const RJ = window.RJ;
  const PAD_KEYS = ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK"];

  window.addEventListener("DOMContentLoaded", () => {
    const host = RJ.Host.solo("rj950");
    const s950 = new RJ.S950(host.view("rj950"));
    host.add("rj950", s950, { label: "RJ-950" });
    s950.build();
    new RJ.LearnBar(host, { root: document.getElementById("r9"), bar: document.getElementById("learnbar") });

    // mapa MIDI padrao (como os pads do RJ-2000): notas 36-67 tocam os 32 pads.
    // Desliga quando algum controle aprendeu uma mensagem.
    host.midi.addDefaults(d => {
      const st = d[0] & 0xf0, n = d[1] - 36;
      if (!(st === 0x90 || st === 0x80) || n < 0 || n >= 32) return null;
      if (host.learn.custom) return "Off: Has Learn";
      if (!host.on) return "Off";
      const pad = "ABCD"[n >> 3] + ((n & 7) + 1);
      if (st === 0x90 && d[2] > 0) { host.emit("note", n, 0, d[2] / 127); return "Def: Pad " + pad; }
      host.emit("noteOff", n);
      return "Def: " + pad + " Off";
    });

    // tela de ligar: o navegador so libera o som depois de um toque
    const power = document.getElementById("power");
    const on = () => { host.power(); power.classList.add("off"); };
    document.getElementById("power-btn").addEventListener("click", on);

    // teclado: depois de um clique no 950, numeros, setas e Enter vao para ele;
    // fora isso, A..K tocam os pads A1..A8
    const held = new Set();
    window.addEventListener("keydown", e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!host.on) { if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); on(); } return; }
      if (host.emit("key", e)) { e.preventDefault(); return; }
      const i = PAD_KEYS.indexOf(e.code);
      if (i < 0) return;
      e.preventDefault();
      if (e.repeat || held.has(i)) return;
      held.add(i);
      host.emit("note", i, 0, 1);
    });
    window.addEventListener("keyup", e => {
      const i = PAD_KEYS.indexOf(e.code);
      if (i >= 0 && held.delete(i)) host.emit("noteOff", i);
    });

    // no console: RJ.solo (o host) e RJ.s950
    RJ.solo = host; RJ.s950 = s950;
  });
})();
