import { loadState, saveState, resetState, pickTopColors, go } from "./common.js";
import { loadCSV } from "./csv.js";

/**
 * 目的：
 * - questions.csv が読み込めること（100〜200件でもOK）
 * - 毎回ランダムに10問を出す（ただし途中リロードでも同じ10問を維持）
 * - q.text / q.a_text / q.b_text が必ず表示されること
 * - BOM/空白/大小/列名揺れでも壊れないこと
 * - 回答でスコア加算され、10問後 result.html に遷移すること
 */

let state = loadState();

// 手順抜けを補正（bottle未選択など）
if (!state.bottle) {
  go("index.html");
}

const qText = document.getElementById("qText");
const aBtn = document.getElementById("aBtn");
const bBtn = document.getElementById("bBtn");
const progress = document.getElementById("progress");
const bar = document.getElementById("bar");
const hint = document.getElementById("hint");

let questions = [];         // このセッションで使う10問
let idx = 0;
const QUESTIONS_COUNT = 5;

// scores を引き継ぎ。無ければ空で開始
let scores =
  (state.scores && typeof state.scores === "object") ? { ...state.scores } : {};

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
 */
function applyAnswer(row, which /* "a" or "b" */) {
  if (!row) return;

  const prefix = which.toLowerCase() + "_";

  for (const [kRaw, vRaw] of Object.entries(row)) {
    const k = normalizeKey(kRaw);

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
 * ※何度も戻って来た時に増え続けないよう、フラグで一回だけ
 */
function bootstrapFromBottleOnce() {
  if (state._bootstrappedFromBottle) return;

  const top = state.bottle?.top_color;
  const bottom = state.bottle?.bottom_color;
  if (top) scores[top] = (toNum(scores[top]) + 2);
  if (bottom) scores[bottom] = (toNum(scores[bottom]) + 2);

  state._bootstrappedFromBottle = true;
  saveState({ ...state, scores }); // state側にも一応反映
}
bootstrapFromBottleOnce();

/**
 * Fisher-Yates shuffle（元配列を壊さない）
 */
function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function render() {
  const total = questions.length || QUESTIONS_COUNT;

  // 表示は 1 / 10 形式にする
  const shown = Math.min(idx + 1, total);
  progress.textContent = `${shown} / ${total}`;
  bar.style.width = `${Math.round((shown / total) * 100)}%`;

  const q = questions[idx];
  if (!q) return;

  const text = getField(q, "text", ["question", "q", "prompt"]);
  const aText = getField(q, "a_text", ["a", "choice_a", "option_a", "aText"]);
  const bText = getField(q, "b_text", ["b", "choice_b", "option_b", "bText"]);

  qText.textContent = text || "（質問テキストが空です：questions.csv の text 列を確認）";
  aBtn.textContent = aText || "A";
  bBtn.textContent = bText || "B";

  const top2 = pickTopColors(scores, 2);
  hint.textContent = top2.length ? `気配：${top2.join(" / ")}` : "";
}

function next() {
  idx++;

  if (idx >= questions.length) {
    saveState({
      ...state,
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
document.getElementById("restart").onclick = () => {
  resetState();
  go("index.html");
};

/**
 * 10問の抽出戦略：
 * - state.sessionQuestions があればそれを使う（リロードしても同じ10問）
 * - 無ければ、CSV全件を読み込んでシャッフル→10件抽出→stateに保存
 */
async function prepareQuestions() {
  // 既にセッション用の10問が保存されているなら再利用
  if (Array.isArray(state.sessionQuestions) && state.sessionQuestions.length === QUESTIONS_COUNT) {
    return state.sessionQuestions;
  }

  const raw = await loadCSV("assets/data/questions.csv");
  const all = Array.isArray(raw) ? raw : [];

  if (all.length === 0) return [];

  // 10問だけ抽出（全件が10未満でも落ちないように）
  const picked = shuffle(all).slice(0, Math.min(QUESTIONS_COUNT, all.length));

  // stateに保存（同じセッション中のリロードで固定される）
  state = { ...state, sessionQuestions: picked };
  saveState(state);

  return picked;
}

(async function init() {
  questions = await prepareQuestions();

  if (questions.length === 0) {
    qText.textContent = "questions.csv が空、または読み込みに失敗しました";
    aBtn.disabled = true;
    bBtn.disabled = true;
    return;
  }

  // もし text が全部空なら、ヘッダ不一致の可能性が高いので警告
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

