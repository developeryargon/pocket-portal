import { loadState, resetState, go } from "./common.js";

const $ = (id) => document.getElementById(id);

// DOM（無くても落ちない）
const titleEl = $("title");
const bottleEl = $("bottle");
const bottleColorsEl = $("bottleColors");
const auraEl = $("aura");
const meaningShort = $("meaningShort");
const meaningLong = $("meaningLong");
const cautionEl = $("caution");
const actionEl = $("action");
const memoEl = $("memo");
const statusEl = $("status");

// ボタン（無くても落ちない）
const btnSavePNG = $("savePNG");
const btnSaveHistory = $("saveHistory");
const btnGoHistory = $("goHistory");
const btnRestart = $("restart");

// 画面の「カード」領域（PNG保存対象）
const cardId = "aura-card"; // result.html側のIDと一致させる

function topColors(scores, n = 2) {
  const entries = Object.entries(scores || {})
    .map(([k, v]) => [k, Number(v) || 0])
    .sort((a, b) => b[1] - a[1])
    .filter(x => x[1] > 0);

  return entries.slice(0, n).map(x => x[0]);
}

function setText(el, text) {
  if (!el) return;
  el.textContent = text;
}

function downloadPNGFromCanvas(canvas) {
  const a = document.createElement("a");
  a.download = `aura_${Date.now()}.png`;
  a.href = canvas.toDataURL("image/png");
  a.click();
}

function saveHistory(state, memo) {
  const KEY = "aura_soma_history_v1";
  const arr = JSON.parse(localStorage.getItem(KEY) || "[]");
  arr.unshift({
    ts: Date.now(),
    mode: state.mode || "",
    mainColor: state.mainColor || "",
    subColor: state.subColor || "",
    bottle: state.bottle || null,
    scores: state.scores || {},
    memo: memo || ""
  });
  localStorage.setItem(KEY, JSON.stringify(arr));
}

(async function init() {
  try {
    const state = loadState();

    // ---- デバッグ表示（原因切り分け用。必要なら後で消せる） ----
    if (statusEl) {
      statusEl.textContent =
        `state: ${state ? "OK" : "NULL"} / bottle: ${state?.bottle ? "OK" : "NG"} / scores: ${state?.scores ? "OK" : "NG"}`;
    }
    // ------------------------------------------------------------

    // stateが欠けていたら最初へ（/aura固定）
    if (!state || !state.bottle || !state.scores) {
      go("index.html");
      return;
    }

    const bottle = state.bottle;
    const scores = state.scores;

    // 主要色
    const top2 = topColors(scores, 2);
    const main = top2[0] || bottle.top_color || "Blue";
    const sub = top2[1] || bottle.bottom_color || "";

    // stateへ保持（履歴/表示に使う）
    state.mainColor = main;
    state.subColor = sub;

    // 表示
    setText(titleEl, "統合");
    setText(bottleEl, `${bottle.name || "—"}${bottle.bottle_id ? ` (${bottle.bottle_id})` : ""}`);
    setText(bottleColorsEl, `${bottle.top_color || "—"} / ${bottle.bottom_color || "—"}`);
    setText(auraEl, sub ? `${main} / ${sub}` : `${main}`);

    // 仮テキスト（ここは colors.csv 連動に後で差し替え可能）
    setText(meaningShort, "色が、形になる。");
    setText(meaningLong, "今は答えを急がず、体感として受け取る段階です。");
    setText(cautionEl, "説明しようとしすぎない。");
    setText(actionEl, "深呼吸を1回。");

    // PNG保存：export.jsに依存しない
    if (btnSavePNG) {
      btnSavePNG.onclick = () => {
        // まずカード内canvas、無ければページ内canvas
        const card = document.getElementById(cardId);
        const canvas = (card && card.querySelector("canvas")) || document.querySelector("canvas");
        if (!canvas) {
          alert("PNG保存できるcanvasが見つかりません。");
          return;
        }
        downloadPNGFromCanvas(canvas);
      };
    }

    // 履歴保存
    if (btnSaveHistory) {
      btnSaveHistory.onclick = () => {
        const memo = memoEl ? memoEl.value : "";
        saveHistory(state, memo);
        if (statusEl) statusEl.textContent = "履歴に保存しました";
      };
    }

    // 履歴へ
    if (btnGoHistory) {
      btnGoHistory.onclick = () => go("history.html");
    }

    // 最初から
    if (btnRestart) {
      btnRestart.onclick = () => {
        resetState();
        go("index.html"); // /aura/index.html に固定
      };
    }
  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.textContent = "result.js でエラーが発生しました（Console参照）";
  }
})();
