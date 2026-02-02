import { loadState, resetState, go } from "./common.js";
import { saveCardPNG } from "./export.js";

const titleEl = document.getElementById("title");
const bottleEl = document.getElementById("bottle");
const auraEl = document.getElementById("aura");
const meaningShort = document.getElementById("meaningShort");
const meaningLong = document.getElementById("meaningLong");
const cautionEl = document.getElementById("caution");
const actionEl = document.getElementById("action");
const memoEl = document.getElementById("memo");
const statusEl = document.getElementById("status");

(async function init() {
  try {
    const state = loadState();
    if (!state || !state.scores || !state.bottle) {
      go("index.html");
      return;
    }

    const { scores, bottle } = state;

    // 上位2色を抽出
    const sorted = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .map(x => x[0]);

    const main = sorted[0] || "Blue";
    const sub = sorted[1] || "";

    titleEl.textContent = "統合";
    bottleEl.textContent = `${bottle.name} (${bottle.bottle_id})`;
    auraEl.textContent = `${main}${sub ? " / " + sub : ""}`;

    // 意味（仮：後で colors.csv と連動させてもOK）
    meaningShort.textContent = "内側で起きている変化を、静かに受け取る。";
    meaningLong.textContent = "今は答えを急がず、感じたことをそのまま受け止める段階です。";
    cautionEl.textContent = "無理に説明しようとしないこと。";
    actionEl.textContent = "深呼吸を1回。";

    // ボタン
    document.getElementById("savePNG").onclick = () => {
      saveCardPNG("aura-card");
    };

    document.getElementById("saveHistory").onclick = () => {
      const key = "aura_soma_history_v1";
      const arr = JSON.parse(localStorage.getItem(key) || "[]");
      arr.unshift({
        ts: Date.now(),
        bottle,
        scores,
        memo: memoEl.value || ""
      });
      localStorage.setItem(key, JSON.stringify(arr));
      statusEl.textContent = "履歴に保存しました";
    };

    document.getElementById("goHistory").onclick = () => {
      go("history.html");
    };

    document.getElementById("restart").onclick = () => {
      resetState();
      go("index.html");
    };
  } catch (err) {
    console.error(err);
    statusEl.textContent = "結果表示中にエラーが発生しました";
  }
})();
