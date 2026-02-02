import { loadState, saveState, resetState, pickTopColors } from "./common.js";
import { loadCSV } from "./csv.js";

const state = loadState();

if (!state.bottle) {
  // 途中手順が抜けてる場合
  location.href = "/index.html";
}

const qText = document.getElementById("qText");
const aBtn = document.getElementById("aBtn");
const bBtn = document.getElementById("bBtn");
const progress = document.getElementById("progress");
const bar = document.getElementById("bar");
const hint = document.getElementById("hint");

let questions = [];
let idx = 0;

// スコア初期化：mistで作った scores を引き継ぐ
let scores = state.scores || {};
const usedColors = new Set(Object.keys(scores));

// ここで “ボトルの上下色” を初期ブーストとして入れる（儀式感）
function bootstrapFromBottle() {
  const top = state.bottle?.top_color;
  const bottom = state.bottle?.bottom_color;
  if (top) scores[top] = (Number(scores[top]) || 0) + 2;
  if (bottom) scores[bottom] = (Number(scores[bottom]) || 0) + 2;
  usedColors.add(top);
  usedColors.add(bottom);
}
bootstrapFromBottle();

function toNum(v){ return Number(v || 0) || 0; }

function applyAnswer(q, which) {
  // CSVの a_blue/a_gold... 形式を総当たりで読む
  for (const [k, v] of Object.entries(q)) {
    // 例: a_blue, b_gold
    if (!k.startsWith(which + "_")) continue;
    const color = k.slice(2); // "blue" "gold"...
    const normalized = normalizeColorKey(color);
    const add = toNum(v);
    if (!add) continue;
    scores[normalized] = (toNum(scores[normalized]) + add);
    usedColors.add(normalized);
  }
}

// "blue" -> "Blue"
function normalizeColorKey(s) {
  const low = String(s).toLowerCase();
  return low.charAt(0).toUpperCase() + low.slice(1);
}

function render() {
  const total = questions.length || 10;
  progress.textContent = `${idx} / ${total}`;
  bar.style.width = `${Math.round((idx / total) * 100)}%`;

  const q = questions[idx];
  if (!q) return;

  qText.textContent = q.text || "";
  aBtn.textContent = q.a_text || "A";
  bBtn.textContent = q.b_text || "B";

  // ささやかな“今の傾向”ヒント（言い切らない）
  const top2 = pickTopColors(scores, 2);
  hint.textContent = top2.length
    ? `気配：${top2.join(" / ")}`
    : "";
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
    location.href = "/result.html";
    return;
  }
  render();
}

aBtn.onclick = () => {
  applyAnswer(questions[idx], "a");
  next();
};

bBtn.onclick = () => {
  applyAnswer(questions[idx], "b");
  next();
};

document.getElementById("back").onclick = () => history.back();
document.getElementById("restart").onclick = () => { resetState(); location.href="/index.html"; };

(async function init(){
  questions = await loadCSV("/assets/data/questions.csv");

  // 10問に満たない場合でも動くように
  if (questions.length === 0) {
    qText.textContent = "questions.csv が空です";
    aBtn.disabled = true;
    bBtn.disabled = true;
    return;
  }

  // 10問で固定したい場合はここで slice(0,10)
  questions = questions.slice(0, 10);

  idx = 0;
  render();
})().catch(err=>{
  qText.textContent = "質問データの読み込みに失敗しました（CSVパス確認）";
  console.error(err);
});
