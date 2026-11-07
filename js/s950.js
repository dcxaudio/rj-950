/* RJ-950 - sampler de rack que fica embaixo do RJ-2000
 *
 * Versao reduzida, inspirada no Akai S950 (1988), o sampler que muita gente
 * usava junto com o SP-1200: o SP fazia a bateria e o sequenciamento e mandava
 * notas MIDI para o S950 tocar os samples longos (loops, baixos, frases), com
 * mais tempo de sample e o filtro.
 *
 * Como funciona aqui:
 * - Cada pad do RJ-2000 manda uma nota (A1 = 36 ... D8 = 67), ao vivo ou pelo
 *   sequenciador. No EDIT PROGRAM, cada pad aponta para um sample do 950.
 *   Pad sem som no RJ-2000 so manda a nota (o truque da epoca).
 * - 12 bits, taxa escolhida ao gravar ou carregar (7,5 a 48 kHz) e 2,25 MB de
 *   memoria, como com as duas expansoes EXM-006: 48 s a 32 kHz.
 * - Por sample: inicio, fim, loop, tune, fine, level, reverse e o filtro
 *   passa-baixa de 2 polos sem ressonancia (como o do S950).
 * - 8 vozes. O mesmo sample disparado de novo corta o anterior.
 * Mensagens do LCD (2 x 40) em ingles e maiusculas, como no original.
 */
window.RJ = window.RJ || {};

(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pad2 = n => String(Math.max(0, n | 0)).padStart(2, "0");
  const fit = (s, n) => (String(s) + " ".repeat(n)).slice(0, n);
  const signed = (n, w = 2) => (n < 0 ? "-" : "+") + String(Math.abs(n)).padStart(w, "0");
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const esc = c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c);

  const VERSION = "b0.3";
  const COLS = 40;
  const MEM = 1536000;            // 2,25 MB em palavras de 12 bits
  const BITS = 12;
  const RATES = [48000, 44100, 40000, 32000, 25000, 20000, 15000, 10000, 7500];
  const MAX_SAMPLES = 99;
  const VOICES = 8;
  const MIN_LEN = 64;             // menor trecho entre inicio e fim (amostras)
  const NOTE0 = 36;               // nota do pad A1
  const STORE_KEY = "autosave";        // no store do host: "studio/rj950/autosave"
  const PAGES = { play: 1, rec: 1, sample: 6, program: 1, midi: 1, utility: 3, disk: 3, tune: 1 };
  // nomes no LCD do MIDI Learn do SP (16 colunas, com "950 " na frente)
  const LEARN_MODES = { play: "Play", rec: "Rec", sample: "Edit Smp", program: "Edit Prog", midi: "MIDI", utility: "Utility", disk: "Disk", tune: "Mstr Tune" };
  const LEARN_KEYS = { left: "Cursor <", right: "Cursor >", up: "Page Up", down: "Page Down", on: "On/+", off: "Off/-", ".": "Key .", pb: "PB", ent: "Enter" };
  const AUDIO_RE = /\.(wav|wave|aif|aiff|aifc|mp3|ogg|oga|flac|m4a|aac|opus)$/i;

  RJ.S950_MEM = MEM;

  const padName = i => RJ.soundLabel(i);
  const khz = r => (r / 1000).toFixed(1).padStart(4, " ");
  /** Posicao em segundos, sempre com 6 caracteres. */
  const secs = (n, rate) => { const v = n / rate; return v < 100 ? v.toFixed(3).padStart(6, "0") : v.toFixed(2).slice(0, 6); };
  /** FILTER 0..98 -> corte de 60 Hz a ~20 kHz. 99 = aberto. */
  const cutoff = f => 60 * Math.pow(2, (f / 99) * 8.4);
  /** ATTACK, DECAY e RELEASE 0..99 -> segundos (0 = na hora, 99 = 10 s), mais fino nos tempos curtos. */
  const envTime = v => 10 * Math.pow(v / 99, 3);
  const envSecs = v => { const t = envTime(v); return t < 1 ? t.toFixed(2).slice(1) + "s" : t.toFixed(1) + "s"; };
  const cleanName = n => (n || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9 #\-_.]/g, " ").replace(/\s+/g, " ").trim().slice(0, 10) || "SAMPLE";

  function newState() {
    return {
      format: "rj950", version: 1,
      rate: 32000, thr: 0, recLen: 10,
      master: 0, link: true,
      out: 0.8, recLevel: 0.5, monitor: 0, contrast: 0.6,
      nextId: 1,
      data: {},                               // id -> { rate, pcm }
      samples: [],                            // { id, name, data, start, end, loop, tune, fine, level, filter, reverse, cut, att, dec, sus, rel }
      keys: new Array(32).fill(null),         // pad do RJ-2000 -> id do sample
    };
  }

  function fadeOut(pcm, rate, sec) {
    const steps = Math.pow(2, BITS - 1), n = Math.min(pcm.length, Math.floor(sec * rate));
    for (let i = 0; i < n; i++) { const k = pcm.length - n + i; pcm[k] = Math.floor(pcm[k] * (1 - (i + 1) / n) * steps) / steps; }
  }

  class S950 {
    /** host: a vista do host (js/host.js), nunca o app do SP. */
    constructor(host) {
      this.host = host;
      this.engine = host.engine;
      this.st = newState();
      this.on = false;
      this.loaded = false;
      this.mode = "play";
      this.pages = {};
      this.field = 0;
      this.entry = "";
      this.cur = 0;                 // sample atual
      this.pad = 16;                // pad escolhido no EDIT PROGRAM (C1)
      this.voices = [];
      this.cache = new Map();
      this.peaks = new Map();
      this.flashUntil = 0;
      this.confirm = null;
      this.focused = false;
      this.audition = null;
      this.sampler = null;
      // as notas dos pads chegam pelo host, como pelo MIDI
      host.listen("note", (s, time, vel) => this.note(s, time, vel));
      host.listen("noteOff", s => this.noteOff(s));
      host.listen("stop", () => this.stopAll());
      host.listen("key", e => this.focused && this.keyEvent(e));
    }

    get smp() { return this.st.samples[this.cur] || null; }
    get page() { return this.pages[this.mode] || 0; }

    /* =========================================================== montagem */

    build() {
      const root = $("#r9");
      if (!root) return;
      this.el = { root, l1: $("#r9-l1"), l2: $("#r9-l2"), lcd: $("#r9-lcd"), midi: $("#r9-midi-led"), busy: $("#r9-busy"), drive: $("#r9-drive"), file: $("#r9-file") };
      const press = (el, down, up) => {
        el.addEventListener("pointerdown", e => {
          e.preventDefault();
          if (!this.host.on) return;
          try { el.setPointerCapture(e.pointerId); } catch (_) {}
          el.classList.add("down");
          down(e);
        });
        const end = () => { if (!el.classList.contains("down")) return; el.classList.remove("down"); if (up) up(); };
        el.addEventListener("pointerup", end);
        el.addEventListener("pointercancel", end);
        el.addEventListener("contextmenu", e => e.preventDefault());
      };
      // MIDI Learn do SP: os controles do 950 tambem aprendem (pelo MIDI, um toque = um passo)
      const learn = (id, el, name, down, kind = "button", h = {}) =>
        this.host.learn.add(id, el, name, kind, Object.assign({ down: () => { if (this.host.on) down(); } }, h));

      $$("[data-r9mode]", root).forEach(b => {
        const m = b.dataset.r9mode;
        press(b, () => this.modeButton(m));
        learn("r9mode:" + m, b, "950 " + LEARN_MODES[m], () => this.modeButton(m));
      });
      $$("[data-r9key]", root).forEach(b => {
        const k = b.dataset.r9key;
        let t1 = 0, t2 = 0;
        press(b, () => {
          this.key(k);
          // ON/+ e OFF/- repetem segurando, cada vez mais rapido
          if (k === "on" || k === "off") {
            let n = 0;
            t1 = setTimeout(() => { t2 = setInterval(() => { n++; this.key(k, n > 40 ? 50 : n > 15 ? 10 : 1); }, 60); }, 420);
          }
        }, () => { clearTimeout(t1); clearInterval(t2); });
        learn("r9key:" + k, b, "950 " + (LEARN_KEYS[k] || "Key " + k), () => this.key(k));
      });
      const power = () => (this.on ? this.powerOff() : this.boot());
      press($("#r9-power"), power);
      learn("r9:power", $("#r9-power"), "950 Power", power);

      this.bindKnob($("#r9-rec"), () => this.st.recLevel, v => { this.st.recLevel = v; this.applyRec(); this.dirty(); }, "r9:rec", "950 Rec Level");
      this.bindKnob($("#r9-mon"), () => this.st.monitor, v => { this.st.monitor = v; this.applyMonitor(); this.dirty(); }, "r9:mon", "950 Monitor");
      this.bindKnob($("#r9-out"), () => this.st.out, v => { this.st.out = v; this.applyOut(); this.dirty(); }, "r9:out", "950 Output");
      this.bindKnob($("#r9-contrast"), () => this.st.contrast, v => { this.st.contrast = v; this.applyContrast(); this.dirty(); }, "r9:contrast", "950 Contrast");
      this.bindControl($("#r9-control"));

      // disquete: clicar abre o seletor de arquivos; soltar um arquivo carrega
      const drive = this.el.drive;
      drive.addEventListener("click", () => { if (this.on) this.pick("audio/*,.wav,.aif,.aiff,.mp3,.ogg,.flac,.m4a,.json", fs => this.loadFile(fs[0])); });
      drive.addEventListener("dragenter", e => { e.preventDefault(); if (this.on) drive.classList.add("drop"); });
      drive.addEventListener("dragover", e => { e.preventDefault(); e.dataTransfer.dropEffect = this.on ? "copy" : "none"; });
      drive.addEventListener("dragleave", () => drive.classList.remove("drop"));
      drive.addEventListener("drop", e => {
        e.preventDefault(); e.stopPropagation();
        drive.classList.remove("drop");
        const f = (e.dataTransfer.files || [])[0];
        if (f && this.on) this.loadFile(f);
      });
      this.el.file.addEventListener("change", e => {
        const files = Array.from(e.target.files || []);
        e.target.value = "";
        if (files.length && this.onFiles) this.onFiles(files);
      });

      // o teclado do computador vai para o 950 depois de um clique nele
      document.addEventListener("pointerdown", e => {
        this.focused = root.contains(e.target);
        root.classList.toggle("focus", this.focused && this.on);
      });
      this.applyContrast();
      this.lcd(["", ""]);
    }

    bindKnob(el, get, set, id, name) {
      const draw = () => { el.querySelector("i").style.transform = `rotate(${-135 + get() * 270}deg)`; };
      el.rjDraw = draw;
      if (id) this.host.learn.add(id, el, name, "value", { get, set: v => { if (this.host.on) { set(v); draw(); } } });
      let y0 = 0, v0 = 0;
      el.addEventListener("pointerdown", e => { e.preventDefault(); el.setPointerCapture(e.pointerId); y0 = e.clientY; v0 = get(); el.dataset.drag = "1"; });
      el.addEventListener("pointermove", e => { if (!el.dataset.drag) return; set(clamp(v0 + (y0 - e.clientY) / 160, 0, 1)); draw(); });
      ["pointerup", "pointercancel"].forEach(ev => el.addEventListener(ev, () => { delete el.dataset.drag; }));
      el.addEventListener("wheel", e => { e.preventDefault(); set(clamp(get() - Math.sign(e.deltaY) * 0.03, 0, 1)); draw(); }, { passive: false });
      el.addEventListener("keydown", e => {
        const d = { ArrowUp: 0.03, ArrowRight: 0.03, ArrowDown: -0.03, ArrowLeft: -0.03 }[e.key];
        if (d == null) return;
        e.preventDefault(); e.stopPropagation(); set(clamp(get() + d, 0, 1)); draw();
      });
      draw();
    }

    /** CONTROL: encoder sem fim. Girar rapido acelera os passos. */
    bindControl(el) {
      let y = 0, acc = 0, angle = 0, last = 0, speed = 1, wheel = 0;
      const ind = el.querySelector("i");
      const step = dir => {
        const now = performance.now(), dt = now - last;
        last = now;
        speed = dt < 35 ? Math.min(speed * 1.3, 250) : dt < 90 ? clamp(speed * 1.05, 1, 40) : 1;
        angle += dir * 9;
        ind.style.transform = `rotate(${angle}deg)`;
        this.turn(dir, Math.round(speed));
      };
      // MIDI: um encoder manda varios passos de uma vez quando gira rapido, e a aceleracao vem junto
      this.host.learn.add("r9:control", el, "950 Control", "encoder", {
        step: d => { if (!this.host.on) return; for (let i = 0; i < Math.min(Math.abs(d), 24); i++) step(Math.sign(d)); },
      });
      el.addEventListener("pointerdown", e => { e.preventDefault(); el.setPointerCapture(e.pointerId); y = e.clientY; acc = 0; el.dataset.drag = "1"; });
      el.addEventListener("pointermove", e => {
        if (!el.dataset.drag) return;
        acc += y - e.clientY; y = e.clientY;
        while (acc >= 6) { step(1); acc -= 6; }
        while (acc <= -6) { step(-1); acc += 6; }
      });
      ["pointerup", "pointercancel"].forEach(ev => el.addEventListener(ev, () => { delete el.dataset.drag; }));
      el.addEventListener("wheel", e => {
        e.preventDefault();
        wheel += e.deltaY;
        while (wheel <= -24) { step(1); wheel += 24; }
        while (wheel >= 24) { step(-1); wheel -= 24; }
      }, { passive: false });
      el.addEventListener("keydown", e => {
        const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
        if (d == null) return;
        e.preventDefault(); e.stopPropagation(); step(d);
      });
    }

    pick(accept, fn) {
      const inp = this.el.file;
      inp.accept = accept;
      this.onFiles = fn;
      const ua = navigator.userActivation;
      if (ua && !ua.isActive) window.addEventListener("pointerup", () => inp.click(), { once: true });
      else inp.click();
    }

    /* =========================================================== liga/desliga */

    async boot() {
      if (this.on || !this.host.on) return;
      this.on = true;
      this.el.root.classList.add("on");
      this.engine.ensure();
      this.applyOut();
      this.lcd(["RJ-950  MIDI DIGITAL SAMPLER       " + VERSION, "LOADING OPERATING SYSTEM..."]);
      if (!this.loaded) {
        this.loaded = true;
        try {
          const saved = await this.host.store.get(STORE_KEY);
          if (saved) this.useState(this.deserialize(saved));
        } catch (e) { console.warn("Memoria do RJ-950 de outra versao", e); }
      }
      await wait(650);
      if (!this.on) return;
      this.lcd(["RJ-950  MIDI DIGITAL SAMPLER       " + VERSION, "MEMORY 2.25MB   " + this.st.samples.length + " SAMPLES   8 VOICES"]);
      await wait(550);
      if (!this.on) return;
      this.setMode("play");
    }

    powerOff() {
      this.on = false;
      this.stopAll();
      this.closeMic();
      this.saveNow();
      this.flashUntil = 0;
      this.el.root.classList.remove("on", "focus");
      this.lcd(["", ""]);
      this.renderLEDs();
      this.applyOut();
    }

    useState(st) {
      this.stopAll();
      this.st = st;
      this.cache.clear(); this.peaks.clear();
      this.cur = 0;
      $$(".knob", this.el.root).forEach(k => k.rjDraw && k.rjDraw());
      this.applyContrast(); this.applyOut(); this.applyRec(); this.applyMonitor();
    }

    /* =========================================================== memoria */

    used() {
      const seen = new Set();
      let n = 0;
      this.st.samples.forEach(s => { if (!seen.has(s.data)) { seen.add(s.data); n += this.st.data[s.data].pcm.length; } });
      return n;
    }

    freeWords() { return Math.max(0, MEM - this.used()); }

    /** Apaga os dados que nenhum sample usa mais. */
    gc() {
      const live = new Set(this.st.samples.map(s => s.data));
      Object.keys(this.st.data).forEach(k => { if (!live.has(+k)) { delete this.st.data[k]; this.peaks.delete(+k); this.cache.delete(k); this.cache.delete(k + "r"); } });
    }

    addSample(pcm, rate, name) {
      const st = this.st;
      const did = st.nextId++;
      st.data[did] = { rate, pcm };
      const s = { id: st.nextId++, name: cleanName(name), data: did, start: 0, end: pcm.length, loop: null,
        tune: 0, fine: 0, level: 99, filter: 99, reverse: false, cut: 0, att: 0, dec: 0, sus: 99, rel: 0 };
      st.samples.push(s);
      return st.samples.length - 1;
    }

    /** Primeiro pad sem som no RJ-2000 e sem sample do 950. */
    freePad() {
      for (let i = 0; i < 32; i++) if (!this.host.padUsed(i) && this.st.keys[i] == null) return i;
      return -1;
    }

    padOf(id) { return this.st.keys.indexOf(id); }

    /** Liga o sample a um pad livre e devolve o texto para o LCD. */
    autoPad(s) {
      const pd = this.freePad();
      if (pd < 0) return "NO FREE PAD: SET ONE IN EDIT PROGRAM";
      this.st.keys[pd] = s.id;
      return "ON PAD " + padName(pd) + " - HIT IT ON THE RJ-2000";
    }

    copySample() {
      const s = this.smp;
      if (!s) return;
      if (this.st.samples.length >= MAX_SAMPLES) { this.flash("MEMORY FULL: 99 SAMPLES", "DELETE A SAMPLE FIRST"); return; }
      const n = this.st.samples.filter(x => x.data === s.data).length + 1;
      const c = Object.assign({}, s, { id: this.st.nextId++, name: (s.name.replace(/ \d+$/, "").slice(0, 7) + " " + n).trim() });
      this.st.samples.splice(this.cur + 1, 0, c);
      this.cur++;
      const where = this.autoPad(c);
      this.flash("COPIED TO SMP " + pad2(this.cur + 1) + " " + c.name, where, 3000);
      this.dirty();
    }

    deleteSample() {
      const s = this.smp;
      if (!s) return;
      this.voices.filter(v => v.id === s.id).forEach(v => this.kill(v));
      this.st.samples.splice(this.cur, 1);
      this.st.keys = this.st.keys.map(k => (k === s.id ? null : k));
      this.gc();
      this.cur = clamp(this.cur, 0, Math.max(0, this.st.samples.length - 1));
      this.flash("SMP " + s.name, "DELETED");
      this.dirty();
    }

    clearAll() {
      const keep = this.st;
      const st = newState();
      ["rate", "thr", "recLen", "master", "link", "out", "recLevel", "monitor", "contrast"].forEach(k => { st[k] = keep[k]; });
      this.useState(st);
      this.flash("MEMORY", "CLEARED");
      this.dirty();
    }

    /* =========================================================== arquivos */

    async loadFile(file) {
      if (!file || !this.on) return;
      if (/\.json$/i.test(file.name)) return this.loadMemory(file);
      if (!(/^audio\//.test(file.type) || AUDIO_RE.test(file.name))) { this.flash("NOT AN AUDIO FILE", "USE WAV, AIFF, MP3, OGG, FLAC..."); return; }
      if (this.st.samples.length >= MAX_SAMPLES) { this.flash("MEMORY FULL: 99 SAMPLES", "DELETE A SAMPLE IN UTILITY"); return; }
      const rate = this.st.rate, free = this.freeWords();
      if (free < rate * 0.05) { this.flash("MEMORY FULL", "DELETE SAMPLES IN UTILITY"); return; }
      const name = cleanName(file.name.replace(/\.[^.]+$/, ""));
      this.busy(true);
      this.flash("LOADING " + name + "...", "PLEASE WAIT", 60000);
      let dec;
      try { dec = await RJ.decodeAudio(this.engine.ensure(), await file.arrayBuffer()); }
      catch (e) { console.warn(e); this.busy(false); this.flash("LOAD ERROR: " + name, "UNKNOWN FILE FORMAT"); return; }
      let pcm = RJ.dsp.process(dec.raw, dec.rate, rate, BITS);
      const cut = pcm.length > free;
      if (cut) { pcm = pcm.slice(0, free); fadeOut(pcm, rate, 0.004); }
      const idx = this.addSample(pcm, rate, name);
      const s = this.st.samples[idx];
      this.cur = idx;
      const where = this.autoPad(s);
      this.busy(false);
      this.setMode("sample", 0);
      this.flash("LOADED SMP " + pad2(idx + 1) + " " + s.name + "  " + (pcm.length / rate).toFixed(2) + "s", cut ? "MEMORY FULL: END CUT" : where, 3500);
      this.dirty();
    }

    saveMemory() {
      const blob = new Blob([this.serialize()], { type: "application/json" });
      RJ.dsp.downloadBlob(blob, "rj-950-memoria.json");
      this.flash("MEMORY SAVED", "FILE: RJ-950-MEMORIA.JSON");
    }

    async loadMemory(file) {
      this.busy(true);
      try {
        const st = this.deserialize(await file.text());
        this.useState(st);
        this.flash("MEMORY LOADED", st.samples.length + " SAMPLES");
        this.dirty();
      } catch (e) { console.warn(e); this.flash("LOAD ERROR", "NOT AN RJ-950 MEMORY FILE"); }
      this.busy(false);
      this.render();
    }

    serialize() {
      const st = this.st, data = {};
      Object.keys(st.data).forEach(k => {
        const d = st.data[k];
        if (!d.b64) d.b64 = RJ.dsp.floatToB64(d.pcm);
        data[k] = { rate: d.rate, pcm: d.b64 };
      });
      return JSON.stringify(Object.assign({}, st, { data, samples: st.samples.map(s => Object.assign({}, s)) }));
    }

    deserialize(json) {
      const d = typeof json === "string" ? JSON.parse(json) : json;
      if (!d || d.format !== "rj950") throw new Error("Nao e uma memoria do RJ-950");
      const st = newState();
      ["rate", "thr", "recLen", "master", "link", "out", "recLevel", "monitor", "contrast", "nextId"].forEach(k => { if (d[k] !== undefined) st[k] = d[k]; });
      if (!RATES.includes(st.rate)) st.rate = 32000;
      Object.keys(d.data || {}).forEach(k => { const x = d.data[k]; st.data[k] = { rate: x.rate, pcm: RJ.dsp.b64ToFloat(x.pcm), b64: x.pcm }; });
      st.samples = (d.samples || []).filter(s => st.data[s.data]).slice(0, MAX_SAMPLES).map(s => {
        const len = st.data[s.data].pcm.length;
        const start = clamp(s.start | 0, 0, Math.max(0, len - 1)), end = clamp(s.end | 0 || len, start + 1, len);
        return { id: s.id, name: cleanName(s.name), data: s.data, start, end, loop: s.loop != null ? clamp(s.loop, start, end - 1) : null,
          tune: clamp(s.tune | 0, -24, 24), fine: clamp(s.fine | 0, -50, 50), level: clamp(s.level != null ? s.level : 99, 0, 99),
          filter: clamp(s.filter != null ? s.filter : 99, 0, 99), reverse: !!s.reverse, cut: clamp(s.cut | 0, 0, 9),
          att: clamp(s.att | 0, 0, 99), dec: clamp(s.dec | 0, 0, 99), sus: clamp(s.sus != null ? s.sus : 99, 0, 99), rel: clamp(s.rel | 0, 0, 99) };
      });
      const ids = new Set(st.samples.map(s => s.id));
      st.keys = new Array(32).fill(null).map((_, i) => (d.keys && ids.has(d.keys[i]) ? d.keys[i] : null));
      st.nextId = Math.max(st.nextId, ...st.samples.map(s => s.id + 1), ...Object.keys(st.data).map(k => +k + 1), 1);
      return st;
    }

    dirty() {
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.saveNow(), 1500);
    }

    saveNow() {
      clearTimeout(this.saveTimer);
      if (!this.loaded) return;
      try { this.host.store.put(STORE_KEY, this.serialize()); } catch (e) { console.warn(e); }
    }

    busy(b) { if (this.el.busy) this.el.busy.classList.toggle("on", b); }

    /* =========================================================== som */

    ensureOut() {
      const ctx = this.engine.ensure();
      if (!this.outNode || this.outNode.context !== ctx) {
        this.outNode = ctx.createGain();
        this.outNode.gain.value = 0;
        // entra no limitador junto com o RJ-2000 (pela saida dele no host), sem passar pelo Mix Volume do SP
        this.outNode.connect(this.host.output());
        this.applyOut();
      }
      return this.outNode;
    }

    applyOut() {
      if (!this.outNode) return;
      const t = this.outNode.context.currentTime;
      this.outNode.gain.setTargetAtTime(this.on ? Math.pow(this.st.out, 2) * 1.2 : 0, t, 0.01);
    }

    applyContrast() { if (this.el) this.el.lcd.style.setProperty("--r9a", (0.3 + this.st.contrast * 0.7).toFixed(2)); }

    recGain() { return Math.pow(10, (this.st.recLevel * 48 - 12) / 20); }
    applyRec() { if (this.sampler) this.sampler.gain = this.recGain(); }

    applyMonitor() {
      if (!this.monGain) return;
      this.monGain.gain.setTargetAtTime(Math.pow(this.st.monitor, 2), this.monGain.context.currentTime, 0.02);
    }

    /**
     * Um buffer por dado de audio, na taxa do sample (a afinacao fica no playbackRate),
     * e outro ao contrario so se algum sample usar REVERSE. Inicio, fim e loop sao
     * escolhidos na hora de tocar, entao mexer no corte nao refaz nem copia o audio.
     */
    buffer(did, rev) {
      const key = did + (rev ? "r" : "");
      let buf = this.cache.get(key);
      if (buf) return buf;
      const d = this.st.data[did];
      if (!d) return null;
      const pcm = rev ? d.pcm.slice().reverse() : d.pcm;
      const ctx = this.engine.ensure();
      try {
        buf = ctx.createBuffer(1, pcm.length, d.rate);
        buf.getChannelData(0).set(pcm);
      } catch (e) {
        // navegador que nao aceita taxas baixas: reamostra para a taxa do sistema
        const r = RJ.dsp.resample(pcm, d.rate, ctx.sampleRate);
        buf = ctx.createBuffer(1, r.length, ctx.sampleRate);
        buf.getChannelData(0).set(r);
      }
      this.cache.set(key, buf);
      return buf;
    }

    play(s, when, vel = 1, pad = -1) {
      const ctx = this.engine.ensure();
      const out = this.ensureOut();
      const d = this.st.data[s.data];
      const buf = d && this.buffer(s.data, s.reverse);
      if (!buf) return null;
      const t = Math.max(when || 0, ctx.currentTime);
      // o mesmo sample corta o anterior, e samples do mesmo grupo de corte se cortam
      // (as fatias de um loop); com 8 vozes ocupadas, a mais antiga cede
      this.voices.filter(v => v.id === s.id || (s.cut && v.cut === s.cut)).forEach(v => this.release(v, t));
      const live = this.voices.filter(v => !v.dead);
      if (live.length >= VOICES) this.kill(live[0], t);
      // trecho em segundos do buffer; ao contrario, o trecho fica espelhado no buffer invertido
      const len = d.pcm.length, a = clamp(s.start, 0, len - 1), b = clamp(s.end, a + 1, len);
      const from = (s.reverse ? len - b : a) / d.rate, dur = (b - a) / d.rate;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = Math.pow(2, (s.tune + (s.fine + this.st.master) / 100) / 12);
      // loop: do ponto AT ate o fim, enquanto nao vier outro disparo (nao vale com REVERSE)
      const loop = !s.reverse && s.loop != null && s.loop >= a && s.loop < b - MIN_LEN;
      if (loop) {
        src.loop = true;
        src.loopStart = s.loop / d.rate;
        src.loopEnd = b / d.rate;
      }
      let node = src;
      if (s.filter < 99) {
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.Q.value = 0.5;                       // 2 polos, sem ressonancia
        f.frequency.value = Math.min(cutoff(s.filter), ctx.sampleRate * 0.45);
        src.connect(f);
        node = f;
      }
      // envelope do VCA: sobe no ATTACK, cai no DECAY ate o SUSTAIN e fica ate soltar o pad
      // (ou ate o sample acabar ou ser cortado); dali o RELEASE leva ao silencio
      const g = ctx.createGain();
      const peak = Math.pow(s.level / 99, 1.6) * vel, hold = peak * Math.pow((s.sus != null ? s.sus : 99) / 99, 1.6);
      const ta = t + Math.max(0.002, envTime(s.att || 0));
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, ta);
      if (hold < peak) {
        const td = envTime(s.dec || 0);
        if (td < 0.003) g.gain.setValueAtTime(hold, ta);
        else g.gain.setTargetAtTime(hold, ta, td / 4);
      }
      node.connect(g);
      g.connect(out);
      if (loop) src.start(t, from); else src.start(t, from, dur);
      const v = { id: s.id, cut: s.cut || 0, src, g, t, pad, rel: s.rel ? envTime(s.rel) : 0 };
      this.voices.push(v);
      src.onended = () => {
        this.voices = this.voices.filter(x => x !== v);
        if (this.audition === v) { this.audition = null; if (this.mode !== "rec") this.render(); }
      };
      return v;
    }

    kill(v, when) {
      if (v.dead) return;
      v.dead = true;
      const t = Math.max(when || 0, v.g.context.currentTime);
      try {
        v.g.gain.cancelScheduledValues(t);
        v.g.gain.setTargetAtTime(0, t, 0.004);
        v.src.stop(t + 0.04);
      } catch (e) { /* ja terminou */ }
    }

    /** Fim da nota com o RELEASE do sample. Sem RELEASE (OFF), corta seco como o kill. */
    release(v, when) {
      if (v.dead) return;
      if (v.rel < 0.01) { this.kill(v, when); return; }
      v.dead = true;
      const p = v.g.gain, t = Math.max(when || 0, v.g.context.currentTime);
      try {
        // segura o valor do envelope onde ele estiver e desce dali
        if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t);
        else { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); }
        p.setTargetAtTime(0, t, v.rel / 4);
        v.src.stop(t + v.rel * 1.6 + 0.05);
      } catch (e) { /* ja terminou */ }
    }

    /** O pad do RJ-2000 foi solto (ao vivo): as vozes dele vao para o RELEASE. Com RELEASE OFF, tocam ate o fim. */
    noteOff(pad) {
      if (!this.on) return;
      this.voices.filter(v => v.pad === pad && v.rel >= 0.01 && v !== this.audition).forEach(v => this.release(v));
    }

    stopAll() { this.voices.forEach(v => this.kill(v)); this.audition = null; }

    /** Nota vinda de um pad do RJ-2000 (ao vivo ou do sequenciador). */
    note(s, time, vel) {
      if (!this.on || !this.st.link) return;
      this.blinkMidi(time);
      const idle = !this.host.playing();
      if (this.mode === "program" && idle) { this.pad = s; this.render(); }
      const id = this.st.keys[s];
      if (id == null) return;
      const idx = this.st.samples.findIndex(x => x.id === id);
      if (idx < 0) return;
      // parado, tocar o pad tambem escolhe o sample para editar
      if (idle && (this.mode === "play" || this.mode === "sample") && idx !== this.cur) { this.cur = idx; this.entry = ""; this.render(); }
      this.play(this.st.samples[idx], time, vel != null ? vel : 1, s);
    }

    blinkMidi(time) {
      const led = this.el.midi, ctx = this.engine.ctx;
      const dt = ctx ? Math.max(0, (time - ctx.currentTime) * 1000) : 0;
      setTimeout(() => { led.classList.add("on"); clearTimeout(this.midiTimer); this.midiTimer = setTimeout(() => led.classList.remove("on"), 80); }, dt);
    }

    toggleAudition() {
      const s = this.smp;
      if (!s) return;
      if (this.audition && !this.audition.dead) { this.kill(this.audition); this.audition = null; return; }
      this.audition = this.play(s);
    }

    /* =========================================================== gravacao */

    async recEnt() {
      if (!this.sampler) {
        this.sampler = new RJ.Sampler(this.engine);
        this.sampler.onLevel = () => { if (this.mode === "rec" && performance.now() > this.flashUntil) this.render(); };
        this.sampler.onDone = (raw, rate, peak) => this.recDone(raw, rate, peak);
      }
      const sm = this.sampler;
      if (sm.state === "armed" || sm.state === "recording") { sm.stop(); this.render(); return; }
      if (this.st.samples.length >= MAX_SAMPLES) { this.flash("MEMORY FULL: 99 SAMPLES", "DELETE A SAMPLE IN UTILITY"); return; }
      const max = Math.min(this.st.recLen, this.freeWords() / this.st.rate);
      if (max < 0.05) { this.flash("MEMORY FULL", "DELETE SAMPLES IN UTILITY"); return; }
      if (sm.state === "off") {
        this.flash("OPENING AUDIO INPUT...", "", 8000);
        try { await sm.open(); }
        catch (e) { console.warn(e); this.flash("NO AUDIO INPUT", "ALLOW THE MICROPHONE IN THE BROWSER", 3000); return; }
        this.monGain = sm.src.context.createGain();
        this.monGain.gain.value = 0;
        sm.src.connect(this.monGain);
        this.monGain.connect(this.ensureOut());
        this.applyMonitor();
        this.flashUntil = 0;
      }
      this.applyRec();
      sm.threshold = this.st.thr / 99;
      if (this.st.thr > 0) sm.arm(max); else sm.force(max);
      this.render();
    }

    recDone(raw, rate, peak) {
      if (raw.length < rate * 0.02) { this.flash("TOO SHORT", "NOTHING RECORDED"); return; }
      const pcm = RJ.dsp.process(raw, rate, this.st.rate, BITS);
      const idx = this.addSample(pcm.slice(0, this.freeWords()), this.st.rate, "REC " + pad2(this.st.samples.length + 1));
      this.cur = idx;
      const s = this.st.samples[idx];
      const where = this.autoPad(s);
      this.flash("SAMPLED SMP " + pad2(idx + 1) + "  " + (s.end / this.st.rate).toFixed(2) + "s", peak >= 0.99 ? "OVERLOAD! TURN REC LEVEL DOWN" : where, 3000);
      this.dirty();
    }

    closeMic() {
      if (this.sampler && this.sampler.state !== "off") this.sampler.close();
      if (this.monGain) { try { this.monGain.disconnect(); } catch (e) {} this.monGain = null; }
    }

    /* =========================================================== campos */

    /** Ponto de corte no cruzamento de zero, andando na direcao do giro. */
    snap(s, pos, dir) {
      const pcm = this.st.data[s.data].pcm;
      const win = Math.round(this.st.data[s.data].rate * 0.005);
      return RJ.nearZero(pcm, clamp(pos, 1, pcm.length - 1), win, dir).pos;
    }

    timeField(get, set, lo, hi) {
      return {
        w: 6,
        show: () => secs(get(), this.st.data[this.smp.data].rate),
        inc: (d, mag) => {
          const s = this.smp, rate = this.st.data[s.data].rate;
          const p0 = get(), target = clamp(p0 + d * Math.max(1, Math.round(rate * 0.001)) * mag, lo(), hi());
          let p = this.snap(s, target, d);
          if ((d > 0 && p <= p0) || (d < 0 && p >= p0)) p = target;
          set(clamp(p, lo(), hi()));
        },
        set: str => {
          const v = parseFloat(str);
          if (!isFinite(v)) return;
          const s = this.smp, rate = this.st.data[s.data].rate;
          set(clamp(this.snap(s, Math.round(v * rate), 0), lo(), hi()));
        },
      };
    }

    numField(w, get, set, lo, hi, show) {
      return {
        w, signed: lo < 0,
        show: () => (show ? show(get()) : String(get()).padStart(w, "0")),
        inc: (d, mag) => set(clamp(get() + d * (mag >= 20 ? 5 : mag >= 6 ? 2 : 1), lo, hi)),
        set: str => { const v = parseInt(str, 10); if (isFinite(v)) set(clamp(v, lo, hi)); },
      };
    }

    toggleField(get, set) {
      return {
        w: 3,
        show: () => (get() ? " ON" : "OFF"),
        inc: d => set(d > 0),
        set: str => set(str !== "0"),
      };
    }

    selField() {
      return {
        w: 2,
        show: () => (this.smp ? pad2(this.cur + 1) : "--"),
        inc: d => { const n = this.st.samples.length; if (n) { this.cur = (this.cur + d + n) % n; this.stopAudition(); } },
        set: str => { const k = parseInt(str, 10) - 1; if (k >= 0 && k < this.st.samples.length) { this.cur = k; this.stopAudition(); } },
      };
    }

    rateField() {
      return {
        w: 4,
        show: () => khz(this.st.rate),
        inc: d => { const i = RATES.indexOf(this.st.rate); this.st.rate = RATES[clamp(i - d, 0, RATES.length - 1)]; this.dirty(); },
        set: str => {
          const v = parseFloat(str) * 1000;
          if (!isFinite(v)) return;
          this.st.rate = RATES.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), RATES[0]);
          this.dirty();
        },
      };
    }

    stopAudition() { if (this.audition) { this.kill(this.audition); this.audition = null; } }

    /** Barras com o volume do sample inteiro; fora do trecho fica apagado. */
    overview(s, loop) {
      const d = this.st.data[s.data], n = d.pcm.length;
      let pk = this.peaks.get(s.data);
      if (!pk) {
        pk = new Array(COLS).fill(0);
        for (let i = 0; i < n; i++) { const c = Math.floor(i * COLS / n), a = Math.abs(d.pcm[i]); if (a > pk[c]) pk[c] = a; }
        const m = Math.max(...pk) || 1;
        pk = pk.map(v => v / m);
        this.peaks.set(s.data, pk);
      }
      const per = n / COLS, cells = [];
      for (let i = 0; i < COLS; i++) {
        const a = i * per, b = (i + 1) * per;
        let cls = b > s.start && a < s.end ? "" : "dim";
        if (s.start >= a && s.start < b) cls += " mk-l";
        if (s.end > a && s.end <= b) cls += " mk-r";
        if (loop && s.loop != null && s.loop >= a && s.loop < b) cls += " mk-loop";
        cells.push({ h: Math.max(8, Math.round(pk[i] * 100)), cls });
      }
      return cells;
    }

    vu(width) {
      const sm = this.sampler, lv = sm ? clamp(sm.level, 0, 1) : 0, pk = sm ? clamp(sm.peak, 0, 1) : 0, thr = this.st.thr / 99;
      let s = "";
      for (let i = 0; i < width; i++) {
        const x = (i + 1) / width;
        s += lv >= x ? "█" : Math.abs(pk - x) < 0.5 / width ? "|" : thr && Math.abs(thr - x) < 0.5 / width ? ":" : " ";
      }
      return s;
    }

    /* =========================================================== paginas */

    /** Pagina atual: linhas (texto e campos) e o que o ENT faz. */
    spec() {
      const st = this.st, s = this.smp, n = st.samples.length, pg = this.page;
      const name = s ? fit(s.name, 10) : "";
      const none = (title) => ({ l1: [title + "NO SAMPLES IN MEMORY"], l2: ["LOAD ONE WITH DISK OR RECORD WITH REC"] });
      const head = () => ["SMP ", this.selField(), " " + name];
      switch (this.mode) {
        case "play": {
          if (!s) return { l1: ["PLAY    NO SAMPLES IN MEMORY"], l2: ["DROP A FILE ON THE DRIVE OR PRESS DISK"] };
          const pd = this.padOf(s.id), r = st.rate;
          return {
            l1: ["PLAY    SMP ", this.selField(), "/" + pad2(n) + " " + name + "   PAD " + (pd >= 0 ? padName(pd) : "--")],
            l2: ["FREE " + (this.freeWords() / r).toFixed(1) + "s OF " + (MEM / r).toFixed(1) + "s   RATE " + khz(r).trim() + "kHz"],
          };
        }
        case "rec": {
          const sm = this.sampler, state = sm ? sm.state : "off";
          const status = state === "armed" ? " WAITING...  " : state === "recording" ? " REC " + (sm.count / sm.engine.ctx.sampleRate).toFixed(1).padStart(4, "0") + "s   " : " ENT=RECORD  ";
          const maxLen = Math.min(st.recLen, this.freeWords() / st.rate);
          return {
            l1: ["REC  RATE ", this.rateField(), "kHz  LEN ", {
              w: 4,
              show: () => maxLen.toFixed(1).padStart(4, "0"),
              inc: (d, mag) => { st.recLen = clamp(Math.round((Math.min(st.recLen, maxLen) + d * (mag >= 6 ? 2 : 0.5)) * 2) / 2, 0.5, 99.5); this.dirty(); },
              set: str => { const v = parseFloat(str); if (isFinite(v)) { st.recLen = clamp(v, 0.5, 99.5); this.dirty(); } },
            }, "s  THR ", this.numField(2, () => st.thr, v => { st.thr = v; this.dirty(); }, 0, 99)],
            l2: [this.vu(COLS - 13) + status],
          };
        }
        case "sample": {
          if (!s) return none("EDIT SAMPLE  ");
          const rate = st.data[s.data].rate, len = st.data[s.data].pcm.length;
          if (pg === 0) return {
            first: 1,
            l1: [...head(), "  ST ", this.timeField(() => s.start, v => { s.start = v; if (s.loop != null && s.loop < v) s.loop = v; this.dirty(); }, () => 0, () => s.end - MIN_LEN),
              "  END ", this.timeField(() => s.end, v => { s.end = v; if (s.loop != null && s.loop > v - MIN_LEN) s.loop = Math.max(s.start, v - MIN_LEN); this.dirty(); }, () => s.start + MIN_LEN, () => len)],
            l2: this.overview(s),
          };
          if (pg === 1) return {
            first: 1,
            l1: [...head(), "  LOOP ", this.toggleField(() => s.loop != null, on => { s.loop = on ? (s.loop != null ? s.loop : s.start) : null; this.dirty(); }),
              "  AT ", s.loop != null ? this.timeField(() => s.loop, v => { s.loop = v; this.dirty(); }, () => s.start, () => s.end - MIN_LEN) : "------"],
            l2: this.overview(s, true),
          };
          if (pg === 2) return {
            first: 1,
            l1: [...head(), "  TUNE ", this.numField(3, () => s.tune, v => { s.tune = v; this.dirty(); }, -24, 24, signed),
              "  FINE ", this.numField(3, () => s.fine, v => { s.fine = v; this.dirty(); }, -50, 50, signed)],
            l2: ["LEVEL ", this.numField(2, () => s.level, v => { s.level = v; this.dirty(); }, 0, 99),
              "   REVERSE ", this.toggleField(() => s.reverse, on => { s.reverse = on; this.dirty(); }),
              "   LEN " + secs(s.end - s.start, rate) + "s"],
          };
          if (pg === 3) return {
            first: 1,
            l1: [...head(), "  FILTER ", this.numField(2, () => s.filter, v => { s.filter = v; this.dirty(); }, 0, 99)],
            l2: [(s.filter >= 99 ? "OPEN (NO FILTER)  " : "CUTOFF " + (cutoff(s.filter) / 1000).toFixed(cutoff(s.filter) < 1000 ? 2 : 1) + "kHz    ").slice(0, 18) + "  2-POLE LOW PASS"],
          };
          if (pg === 5) return {
            first: 1,
            l1: [...head(), "  ATTACK ", this.numField(2, () => s.att || 0, v => { s.att = v; this.dirty(); }, 0, 99),
              "  DECAY ", this.numField(2, () => s.dec || 0, v => { s.dec = v; this.dirty(); }, 0, 99)],
            l2: ["SUSTAIN ", this.numField(2, () => (s.sus != null ? s.sus : 99), v => { s.sus = v; this.dirty(); }, 0, 99),
              "  RELEASE ", this.numField(3, () => s.rel || 0, v => { s.rel = v; this.dirty(); }, 0, 99, v => (v ? " " + pad2(v) : "OFF")),
              s.rel ? "  " + envSecs(s.rel) + " AT PAD UP" : "  ONE SHOT (FULL)"],
          };
          // grupo de corte: samples no mesmo grupo cortam um ao outro (0 = desligado)
          const mates = st.samples.map((x, i) => (x !== s && s.cut && x.cut === s.cut ? pad2(i + 1) : null)).filter(Boolean);
          return {
            first: 1,
            l1: [...head(), "  CUT GROUP ", this.numField(3, () => s.cut || 0, v => { s.cut = v; this.dirty(); }, 0, 9, v => (v ? "  " + v : "OFF"))],
            l2: [!s.cut ? "OFF: PLAYS OVER THE OTHER SAMPLES" : mates.length ? fit("CUTS SMP " + mates.join(" "), COLS) : "SET THE SAME GROUP ON OTHER SAMPLES"],
          };
        }
        case "program": {
          const id = st.keys[this.pad], idx = st.samples.findIndex(x => x.id === id), m = idx >= 0 ? st.samples[idx] : null;
          return {
            first: 1,
            l1: ["PROG  PAD ", {
              w: 2, show: () => padName(this.pad),
              inc: d => { this.pad = (this.pad + d + 32) % 32; },
            }, " (" + (NOTE0 + this.pad) + ")  SMP ", {
              w: 2, show: () => (m ? pad2(idx + 1) : "--"),
              inc: d => {
                const k = clamp((idx < 0 ? -1 : idx) + d, -1, n - 1);
                st.keys[this.pad] = k < 0 ? null : st.samples[k].id;
                this.dirty();
              },
              set: str => {
                const k = parseInt(str, 10) - 1;
                if (k >= -1 && k < n) { st.keys[this.pad] = k < 0 ? null : st.samples[k].id; this.dirty(); }
              },
            }, " " + (m ? m.name : "")],
            l2: [n ? "HIT A PAD ON THE RJ-2000 TO SELECT IT" : "NO SAMPLES IN MEMORY"],
          };
        }
        case "midi":
          return {
            l1: ["MIDI   RECEIVE FROM RJ-2000  ", this.toggleField(() => st.link, on => { st.link = on; if (!on) this.stopAll(); this.dirty(); })],
            l2: ["PADS A1-D8 SEND NOTES 36-67   OMNI"],
          };
        case "utility": {
          if (pg === 2) return {
            l1: ["UTILITY  CLEAR ALL MEMORY"],
            l2: [this.confirm === "clear" ? "PRESS ENT AGAIN TO CLEAR EVERYTHING" : "ENT=CLEAR  (" + n + " SAMPLES)"],
            ent: () => { if (this.confirm === "clear") { this.confirm = null; this.clearAll(); } else this.confirm = "clear"; },
          };
          if (!s) return none("UTILITY  ");
          if (pg === 0) return {
            l1: ["UTILITY  COPY SMP ", this.selField(), " " + name],
            l2: ["ENT=COPY  (THE COPY SHARES THE MEMORY)"],
            ent: () => this.copySample(),
          };
          return {
            l1: ["UTILITY  DELETE SMP ", this.selField(), " " + name],
            l2: [this.confirm === "del" ? "PRESS ENT AGAIN TO DELETE IT" : "ENT=DELETE"],
            ent: () => { if (this.confirm === "del") { this.confirm = null; this.deleteSample(); } else this.confirm = "del"; },
          };
        }
        case "disk": {
          if (pg === 1) return {
            l1: ["DISK  SAVE MEMORY TO FILE"],
            l2: ["ENT=SAVE  (" + n + " SAMPLES, " + (this.used() / st.rate).toFixed(1) + "s)"],
            ent: () => this.saveMemory(),
          };
          if (pg === 2) return {
            l1: ["DISK  LOAD MEMORY FROM FILE"],
            l2: ["ENT=CHOOSE FILE (REPLACES THE MEMORY)"],
            ent: () => this.pick(".json", fs => this.loadMemory(fs[0])),
          };
          return {
            l1: ["DISK  LOAD AUDIO FILE   RATE ", this.rateField(), "kHz"],
            l2: ["ENT=CHOOSE FILE OR DROP IT ON THE DRIVE"],
            ent: () => this.pick("audio/*,.wav,.aif,.aiff,.mp3,.ogg,.flac,.m4a", fs => this.loadFile(fs[0])),
          };
        }
        case "tune":
          return {
            l1: ["MASTER TUNE  ", this.numField(3, () => st.master, v => { st.master = v; this.dirty(); }, -50, 50, signed), " CENTS"],
            l2: ["RJ-950 " + VERSION + "   2.25MB   8 VOICES   12 BIT"],
          };
      }
      return { l1: [""], l2: [""] };
    }

    /** Monta as duas linhas e acha a posicao de cada campo. */
    compose(sp) {
      const fields = [], rows = [];
      [sp.l1, sp.l2].forEach((parts, r) => {
        if (parts.length && typeof parts[0] === "object" && parts[0].h != null) { rows.push(parts); return; }
        let s = "";
        parts.forEach(p => {
          if (typeof p === "string") { s += p; return; }
          const i = fields.length;
          let txt = p.show();
          if (i === this.field && this.entry) txt = this.entry.length >= p.w ? this.entry.slice(-p.w) : (this.entry + "_").padStart(p.w, " ");
          fields.push(Object.assign({ r, c: s.length }, p));
          s += fit(txt, p.w);
        });
        rows.push(s);
      });
      return { rows, fields };
    }

    current() {
      const sp = this.spec(), { rows, fields } = this.compose(sp);
      this.field = fields.length ? clamp(this.field, 0, fields.length - 1) : 0;
      return { sp, rows, fields, f: fields[this.field] || null };
    }

    /* =========================================================== botoes */

    modeButton(m) {
      if (!this.on) return;
      this.engine.ensure();
      // apertar o modo de novo passa para a proxima pagina
      if (m === this.mode && PAGES[m] > 1) { this.setMode(m, (this.page + 1) % PAGES[m]); return; }
      this.setMode(m);
    }

    setMode(m, page) {
      if (this.mode === "rec" && m !== "rec") this.closeMic();
      this.mode = m;
      if (page != null) this.pages[m] = page;
      this.entry = ""; this.confirm = null; this.flashUntil = 0;
      this.field = this.spec().first || 0;
      this.render();
    }

    /** k: 0-9 . left right up down on off pb ent */
    key(k, mag = 1) {
      if (!this.on) return;
      this.engine.ensure();
      if (performance.now() < this.flashUntil) { this.flashUntil = 0; }
      if (k !== "ent") this.confirm = null;
      const { sp, fields, f } = this.current();
      if (/^[0-9.]$/.test(k)) {
        if (f && f.set && this.entry.length < 7 && !(k === "." && this.entry.includes("."))) this.entry += k;
      } else if (k === "left" || k === "right") {
        this.entry = "";
        if (fields.length) this.field = (this.field + (k === "right" ? 1 : -1) + fields.length) % fields.length;
      } else if (k === "up" || k === "down") {
        const n = PAGES[this.mode];
        if (n > 1) { this.setMode(this.mode, (this.page + (k === "up" ? 1 : -1) + n) % n); return; }
      } else if (k === "on" || k === "off") {
        if (this.entry && k === "off" && f && f.signed) this.entry = this.entry[0] === "-" ? this.entry.slice(1) : "-" + this.entry;
        else if (f && f.inc) { this.entry = ""; f.inc(k === "on" ? 1 : -1, mag); }
      } else if (k === "ent") {
        if (this.entry && f && f.set) { f.set(this.entry); this.entry = ""; }
        else if (this.mode === "rec") { this.recEnt(); return; }
        else if (sp.ent) sp.ent();
      } else if (k === "pb") {
        this.toggleAudition();
      } else if (k === "back") {
        this.entry = this.entry.slice(0, -1);
      }
      this.render();
    }

    /** CONTROL girando: muda o campo do cursor. */
    turn(dir, mag) {
      if (!this.on) return;
      const { f } = this.current();
      this.entry = "";
      this.confirm = null;
      if (f && f.inc) f.inc(dir, mag);
      this.flashUntil = 0;
      this.render();
    }

    /** Teclado do computador (depois de clicar no 950). */
    keyEvent(e) {
      if (!this.on) return false;
      const map = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "on", ArrowDown: "off", PageUp: "up", PageDown: "down",
        Enter: "ent", NumpadEnter: "ent", "+": "on", "=": "on", "-": "off", ".": ".", ",": ".", p: "pb", P: "pb", Backspace: "back" };
      if (e.key === "Escape") { if (this.entry) { this.entry = ""; this.render(); } else { this.focused = false; this.el.root.classList.remove("focus"); } return true; }
      const k = /^[0-9]$/.test(e.key) ? e.key : map[e.key];
      if (!k) return false;
      if (e.repeat && !(k === "on" || k === "off")) return true;
      this.key(k);
      return true;
    }

    /* =========================================================== desenho */

    lcd(rows, cur) {
      rows.forEach((row, r) => {
        const el = r ? this.el.l2 : this.el.l1;
        const cells = typeof row === "string" ? Array.from(fit(row, COLS)).map(ch => ({ ch })) : row;
        let html = "";
        for (let i = 0; i < COLS; i++) {
          const c = cells[i] || { ch: " " };
          const isCur = cur && cur[0] === r && i >= cur[1] && i < cur[1] + cur[2];
          const code = c.ch ? c.ch.charCodeAt(0) : 0;
          const h = c.h != null ? c.h : code >= 0x2581 && code <= 0x2588 ? (code - 0x2580) / 8 * 100 : null;
          const cls = [h != null ? "bar" : "", c.cls || "", isCur ? "cur" : ""].join(" ").trim();
          if (h != null) html += `<span class="${cls}" style="--h:${h}"></span>`;
          else html += `<span${cls ? ` class="${cls}"` : ""}>${c.ch === " " ? "&nbsp;" : esc(c.ch)}</span>`;
        }
        el.innerHTML = html;
      });
    }

    flash(a, b, ms = 1800) {
      this.flashUntil = performance.now() + ms;
      this.lcd([a, b]);
      clearTimeout(this.flashTimer);
      this.flashTimer = setTimeout(() => { this.flashUntil = 0; this.render(); }, ms);
    }

    render() {
      if (!this.el) return;
      this.renderLEDs();
      if (!this.on || performance.now() < this.flashUntil) return;
      const { rows, f } = this.current();
      this.lcd(rows, f ? [f.r, f.c, f.w] : null);
    }

    renderLEDs() {
      $$("[data-r9led]", this.el.root).forEach(el => el.classList.toggle("on", this.on && el.dataset.r9led === this.mode));
    }
  }

  RJ.S950 = S950;
})();
