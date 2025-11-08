var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ArbioCoach
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = { quizBatchSize: 10, showHintsByDefault: true };
var DEFAULT_DATASTORE = { cards: {} };
var BUCKET_DELAYS = [1, 2, 4, 7, 15, 30];
var STRINGS = {
  "plugin-name": "Arbori",
  "plugin-name-short": "Arbori",
  "notice-no-cards-in-vault": "Keine Karten gefunden",
  "notice-no-cards-in-text": "Keine Karten im Text gefunden.",
  "notice-no-cards-due": "Im Moment sind keine Karten f\xE4llig.",
  "notice-quiz-done": (n) => `Fertig. ${n} Karten wiederholt.`,
  "notice-file-read-fail": "Fehler beim Lesen der aktiven Datei.",
  "notice-no-active-file": "Keine aktive Datei zum Lesen vorhanden.",
  "command-start-quiz": "Quiz starten",
  "command-create-example": "Beispielseite erstellen",
  "settings-title": "Arbori",
  "settings-batch-size-name": "Wie viele Karten pro Quiz?",
  "settings-batch-size-desc": "Maximale Anzahl von Karten pro Quiz",
  "settings-show-hints-name": "Hinweise standardm\xE4\xDFig anzeigen",
  "settings-stats-title": "\xDCbersicht",
  "settings-total-cards": "Karten insgesamt",
  "settings-review-buckets-title": "Phasen",
  "settings-bucket-name": (i) => `Phase ${i + 1}`,
  "settings-bucket-count": (n) => `${n} Karten`,
  "settings-bucket-delay": (d) => `(Wiederholung in ${d} Tagen)`,
  "quiz-title": (cur, total) => `Quiz ${cur}/${total}`,
  "quiz-show-answer": "Antwort anzeigen",
  "quiz-i-was-right": "Ich wusste es",
  "quiz-i-missed-it": "Wusste ich nicht"
};
var ArbioCoach = class extends import_obsidian.Plugin {
  settings = DEFAULT_SETTINGS;
  dataStore = DEFAULT_DATASTORE;
  async onload() {
    await this.loadSettings();
    await this.loadDataStore();
    this.addSettingTab(new ArbioSettingTab(this.app, this));
    this.addCommand({
      id: "arbio-start-quiz",
      name: STRINGS["command-start-quiz"],
      callback: () => this.startQuiz()
    });
    this.addCommand({
      id: "arbio-create-example",
      name: STRINGS["command-create-example"],
      callback: () => this.createExample()
    });
  }
  async loadSettings() {
    const s = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, s?.settings ?? s ?? {});
  }
  async saveSettings() {
    await this.saveData({ settings: this.settings, dataStore: this.dataStore });
  }
  async loadDataStore() {
    const s = await this.loadData();
    if (s?.dataStore) this.dataStore = s.dataStore;
    else if (s?.cards) this.dataStore = { cards: s.cards };
  }
  async saveDataStore() {
    await this.saveData({ settings: this.settings, dataStore: this.dataStore });
  }
  async startQuiz() {
    const files = this.app.vault.getMarkdownFiles();
    let allCards = [];
    for (const file of files) {
      try {
        const md = await this.app.vault.read(file);
        const cards = extractCards(md);
        allCards.push(...cards);
      } catch (e) {
        console.error(`Arbio: Failed to read or parse file ${file.path}`, e);
      }
    }
    if (allCards.length === 0) {
      new import_obsidian.Notice(STRINGS["notice-no-cards-in-vault"]);
      return;
    }
    this.startQuizFromCards(allCards);
  }
  startQuizFromCards(cards) {
    if (cards.length === 0) {
      new import_obsidian.Notice(STRINGS["notice-no-cards-in-text"]);
      return;
    }
    const due = cards.map((c) => ({ c, state: this.dataStore.cards[c.q] })).filter(({ c, state }) => isDue(state)).map((x) => x.c);
    const pool = due.slice(0, this.settings.quizBatchSize);
    if (pool.length === 0) {
      new import_obsidian.Notice(STRINGS["notice-no-cards-due"]);
      return;
    }
    new QuizModal(this.app, pool, (q, correct) => this.rateCard(q, correct)).open();
  }
  rateCard(q, success) {
    const now = Date.now();
    const prev = this.dataStore.cards[q] ?? { last: now, bucket: 0 };
    prev.bucket = success ? Math.min(prev.bucket + 1, BUCKET_DELAYS.length - 1) : Math.max(prev.bucket - 1, 0);
    prev.last = now;
    this.dataStore.cards[q] = prev;
    this.saveDataStore();
  }
  async createExample() {
    const content = `---
tags: arbio-beispiel
---
# Arbio Beispielseite

Diese Seite erkl\xE4rt kurz, wie du Lernkarten mit Arbio erstellst.

\`\`\`arbio
Topic: Baumidentifikation
Q: Welcher Samen sind auf diesem Bild zu sehen?
A: Gefl\xFCgelte Samen der Fraser-Tanne
Img: https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Abies_fraseri_seeds.jpg/1280px-Abies_fraseri_seeds.jpg
\`\`\`
`;
    try {
      const path = "Arbio-Beispiele.md";
      await this.app.vault.create(path, content);
      new import_obsidian.Notice(`Beispieldatei erstellt: ${path}`);
    } catch (e) {
      new import_obsidian.Notice("Fehler beim Erstellen der Beispieldatei. Vielleicht existiert sie bereits?");
    }
  }
};
var ArbioSettingTab = class extends import_obsidian.PluginSettingTab {
  plugin;
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: STRINGS["settings-title"] });
    new import_obsidian.Setting(containerEl).setName(STRINGS["settings-batch-size-name"]).setDesc(STRINGS["settings-batch-size-desc"]).addSlider((s) => s.setLimits(5, 30, 1).setValue(this.plugin.settings.quizBatchSize).onChange(async (v) => {
      this.plugin.settings.quizBatchSize = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName(STRINGS["settings-show-hints-name"]).addToggle((t) => t.setValue(this.plugin.settings.showHintsByDefault).onChange(async (v) => {
      this.plugin.settings.showHintsByDefault = v;
      await this.plugin.saveSettings();
    }));
    containerEl.createEl("h2", { text: STRINGS["settings-stats-title"] });
    const cardStates = Object.values(this.plugin.dataStore.cards);
    const totalCards = cardStates.length;
    new import_obsidian.Setting(containerEl).setName(STRINGS["settings-total-cards"]).setDesc(`${totalCards}`);
    const bucketCounts = new Array(BUCKET_DELAYS.length).fill(0);
    for (const state of cardStates) {
      if (state.bucket >= 0 && state.bucket < BUCKET_DELAYS.length) {
        bucketCounts[state.bucket]++;
      }
    }
    containerEl.createEl("h3", { text: STRINGS["settings-review-buckets-title"] });
    const bucketsEl = containerEl.createDiv({ cls: "arbio-buckets" });
    bucketCounts.forEach((count, i) => {
      const bucketEl = bucketsEl.createDiv({ cls: "arbio-bucket" });
      bucketEl.createEl("div", { text: STRINGS["settings-bucket-name"](i), cls: "arbio-bucket-name" });
      bucketEl.createEl("div", { text: STRINGS["settings-bucket-count"](count), cls: "arbio-bucket-count" });
      bucketEl.createEl("div", { text: STRINGS["settings-bucket-delay"](BUCKET_DELAYS[i]), cls: "arbio-bucket-delay" });
    });
  }
};
var QuizModal = class extends import_obsidian.Modal {
  constructor(app, cards, onRate) {
    super(app);
    this.cards = cards;
    this.onRate = onRate;
  }
  idx = 0;
  correct = 0;
  onOpen() {
    this.render();
  }
  render() {
    const { contentEl } = this;
    contentEl.empty();
    const c = this.cards[this.idx];
    contentEl.createEl("h3", { text: STRINGS["quiz-title"](this.idx + 1, this.cards.length) });
    contentEl.createEl("div", { text: c.topic, cls: "arbio-chip" });
    if (c.img) contentEl.createEl("img", { attr: { src: c.img }, cls: "arbio-q-img" });
    contentEl.createEl("p", { text: c.q });
    const ans = contentEl.createEl("div", { text: c.a, cls: "arbio-hidden" });
    const show = contentEl.createEl("button", { text: STRINGS["quiz-show-answer"] });
    show.addEventListener("click", () => ans.removeClass("arbio-hidden"));
    const yes = contentEl.createEl("button", { text: STRINGS["quiz-i-was-right"] });
    const no = contentEl.createEl("button", { text: STRINGS["quiz-i-missed-it"] });
    yes.addEventListener("click", () => {
      this.onRate(c.q, true);
      this.next();
    });
    no.addEventListener("click", () => {
      this.onRate(c.q, false);
      this.next();
    });
  }
  next() {
    this.idx++;
    if (this.idx >= this.cards.length) {
      this.close();
      new import_obsidian.Notice(STRINGS["notice-quiz-done"](this.cards.length));
    } else this.render();
  }
};
function parseCard(src) {
  const lines = src.split(/\r?\n/);
  const card = {};
  for (const line of lines) {
    const m = line.match(/^([A-Za-z]+)\s*:\s*(.*)$/);
    if (m) {
      const k = m[1].toLowerCase();
      const v = m[2].trim();
      if (k === "title") card.title = v;
      else if (k === "topic") card.topic = v;
      else if (k === "q") card.q = v;
      else if (k === "a") card.a = v;
      else if (k === "hint") card.hint = v;
      else if (k === "img") card.img = v;
    }
  }
  if (!card.topic) card.topic = "general";
  if (!card.q || !card.a) throw new Error("arbio card requires Q: and A:");
  return card;
}
function extractCards(md) {
  const re = /```arbio\s*([\s\S]*?)```/g;
  const out = [];
  let m;
  while ((m = re.exec(md)) !== null) {
    try {
      out.push(parseCard(m[1]));
    } catch (e) {
    }
  }
  return out;
}
function isDue(state) {
  if (!state) return true;
  const bucket = Math.max(0, Math.min(state.bucket ?? 0, BUCKET_DELAYS.length - 1));
  const days = BUCKET_DELAYS[bucket] ?? 1;
  const dueAt = state.last + days * 24 * 60 * 60 * 1e3;
  return Date.now() >= dueAt;
}
