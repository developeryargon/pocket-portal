import { loadState, saveState, resetState, pickTopColors, go } from "./common.js";
import { loadCSV } from "./csv.js";

/**
 * 目的：
 * - questions.csv が読み込めること
 * - q.text / q.a_text / q.b_text が必ず表示されること
 * - BOM/空白/大小/列名揺れでも壊れないこと
 * - 回答でスコア加算され、10問後 result.html に遷移すること
 */

const state = loadState();

// 手順抜けを補正（bottle未選択など）
if (!state.bottle) {
  // /aura/ 直下運用でも go() が安全に飛ばす
  go("index.html");
}

const qText = document.getElementById("qText");
const aBtn = document.getElementById("aBtn");
const bBtn = document.getElementById("bBtn");
const progress = document.getElementById("progress");
const bar = document.getElementById("bar");
const hint = document.getElementById("hint");

let questions = [];
let idx = 0;

// scores を引き継ぎ。無ければ空で開始
let scores = (state.scores && typeof state.scores === "object") ? { ...state.scores } : {};

function toNum(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

function normalizeKey(k) {
  return String(k ?? "")
    .replace(/^\uFEFF/, "") // BOM
    .trim()
    .toLowerCase();
}

/**
 * CSVの列名ゆれを吸収して値を取り出す
 * 例: "a_text" / "A_TEXT" / "a text" / "a-text" / "atext" 等を拾う
 */
function getField(row, key, fallbacks = []) {
  const wanted = [key, ...fallbacks].map(x => normalizeKey(x));

  // 直接一致
  for (const [k, v] of Object.entries(row || {})) {
    const nk = normalizeKey(k);
    if (wanted.includes(nk)) {
      const s = String(v ?? "").trim();
      if (s !== "") return s;
    }
  }

  // ゆる一致（_,-,空白 を無視して比較）
  const wantedLoose = wanted.map(x => x.replace(/[_\-\s]/g, ""));
  for (const [k, v] of Object.entries(row || {})) {
    const nk = normalizeKey(k).replace(/[_\-\s]/g, "");
    if (wantedLoose.includes(nk)) {
      const s = String(v ?? "").trim();
      if (s !== "") return s;
    }
  }

  return "";
}

/**
 * 色キーを正規化:
 * - "blue" -> "Blue"
 * - "BLUE" -> "Blue"
 */
function normalizeColorName(colorKey) {
  const low = String(colorKey ?? "").trim().toLowerCase();
  if (!low) return "";
  return low.charAt(0).toUpperCase() + low.slice(1);
}

/**
 * a_*** / b_*** を読み取ってスコア加算
 * - 列名揺れ、BOM、空白を吸収
 * - a_blue, b_gold 等の形式を想定
 */
function applyAnswer(row, which /* "a" or "b" */) {
  if (!row) return;

  const prefix = which.toLowerCase() + "_";

  for (const [kRaw, vRaw] of Object.entries(row)) {
    const k = normalizeKey(kRaw);

    // a_blue / b_gold だけ拾う（"a_" で始まる）
    if (!k.startsWith(prefix)) continue;

    const colorKey = k.slice(prefix.length); // "blue" "gold" ...
    const color = normalizeColorName(colorKey);
    if (!color) continue;

    const add = toNum(vRaw);
    if (!add) continue;

    scores[color] = (toNum(scores[color]) + add);
  }
}

/**
 * ボトルの上下色を初期ブースト
 */
function bootstrapFromBottle() {
  const top = state.bottle?.top_color;
  const bottom = state.bottle?.bottom_color;
  if (top) scores[top] = (toNum(scores[top]) + 2);
  if (bottom) scores[bottom] = (toNum(scores[bottom]) + 2);
}
bootstrapFromBottle();

function render() {
  const total = questions.length || 10;
  progress.textContent = `${idx} / ${total}`;
  bar.style.width = `${Math.round((idx / total) * 100)}%`;

  const q = questions[idx];
  if (!q) return;

  // 列名の揺れを吸収
  const text = getField(q, "text", ["question", "q", "prompt"]);
  const aText = getField(q, "a_text", ["a", "choice_a", "option_a", "aText"]);
  const bText = getField(q, "b_text", ["b", "choice_b", "option_b", "bText"]);

  // 表示
  qText.textContent = text || "（質問テキストが空です：questions.csv の text 列を確認）";
  aBtn.textContent = aText || "A";
  bBtn.textContent = bText || "B";

  // ささやかなヒント
  const top2 = pickTopColors(scores, 2);
  hint.textContent = top2.length ? `気配：${top2.join(" / ")}` : "";
}

function next() {
  idx++;

  if (idx >= questions.length) {
    // 終了：結果へ
    saveState({
      step: "result",
      scores,
      answeredAt: Date.now()
    });
    go("result.html");
    return;
  }

  render();
}

// クリック
aBtn.onclick = () => {
  applyAnswer(questions[idx], "a");
  next();
};

bBtn.onclick = () => {
  applyAnswer(questions[idx], "b");
  next();
};

// 戻る・最初から
document.getElementById("back").onclick = () => history.back();
document.getElementById("restart").onclick = () => { resetState(); go("index.html"); };

(async function init() {
  // ここは /aura/ 配下運用想定：相対でOK
  const raw = await loadCSV("assets/data/questions.csv");

  // 念のため、オブジェクトに整形（BOM付きヘッダが混ざっても getField が拾う）
  questions = Array.isArray(raw) ? raw : [];

  if (questions.length === 0) {
    qText.textContent = "questions.csv が空、または読み込みに失敗しました";
    aBtn.disabled = true;
    bBtn.disabled = true;
    return;
  }

  // 10問固定
  questions = questions.slice(0, 10);

  // もし text が全部空なら、ヘッダ不一致の可能性が高いので警告を出す
  const anyText = questions.some(q => getField(q, "text", ["question", "q", "prompt"]) !== "");
  if (!anyText) {
    console.warn("questions.csv の列名が想定と違う可能性があります。ヘッダを確認してください。");
  }

  idx = 0;
  render();
})().catch(err => {
  console.error(err);
  qText.textContent = "質問データの読み込みに失敗しました（Networkで questions.csv が 200 か確認）";
  aBtn.disabled = true;
  bBtn.disabled = true;
});
