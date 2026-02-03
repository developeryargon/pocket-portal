import { loadState, resetState, go } from "./common.js";

const $ = (id) => document.getElementById(id);

const bottleNameEl = $("bottleName");
const bottleColorsEl = $("bottleColors");
const topColorsEl = $("topColors");

const meaningShortEl = $("meaningShort");
const meaningLongEl = $("meaningLong");
const shadowEl = $("shadow");
const actionEl = $("action");

const memoEl = $("memo");
const statusEl = $("status");

const btnSavePng = $("savePng");
const btnSaveHistory = $("saveHistory");
const btnRestart = $("restart");

const canvas = $("c");

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function topColors(scores, n = 2) {
  return Object.entries(scores || {})
    .map(([k, v]) => [k, toNum(v)])
    .sort((a, b) => b[1] - a[1])
    .filter(x => x[1] > 0)
    .slice(0, n)
    .map(x => x[0]);
}

function colorRGB(name) {
  const map = {
    Blue:   [80, 140, 255],
    Gold:   [255, 210, 90],
    Violet: [180, 110, 255],
    Green:  [90, 230, 170],
    Red:    [255, 90, 120],
    Pink:   [255, 130, 200],
    Yellow: [255, 245, 120],
    Black:  [25, 30, 45],
    White:  [230, 235, 255],
  };
  return map[name] || [120, 160, 255];
}

function fitCanvasToCss(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width * dpr));
  const h = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return { w, h, dpr };
}

function drawAura(main, sub) {
  if (!canvas) return;
  const { w, h } = fitCanvasToCss(canvas);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);

  const m = colorRGB(main);
  const s = sub ? colorRGB(sub) : m;

  // 背景
  ctx.fillStyle = "rgb(7,10,18)";
  ctx.fillRect(0, 0, w, h);

  // メインの放射
  const r = Math.min(w, h) * 0.55;
  const g1 = ctx.createRadialGradient(w*0.5, h*0.55, 0, w*0.5, h*0.55, r);
  g1.addColorStop(0.0, `rgba(${m[0]},${m[1]},${m[2]},0.38)`);
  g1.addColorStop(0.55, `rgba(${m[0]},${m[1]},${m[2]},0.12)`);
  g1.addColorStop(1.0, `rgba(${m[0]},${m[1]},${m[2]},0.00)`);
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, w, h);

  // サブのリング
  ctx.save();
  ctx.translate(w*0.5, h*0.55);
  ctx.scale(0.78, 1.0);
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 9; i++) {
    const rr = (Math.min(w,h) * 0.10) + i*(Math.min(w,h)*0.045);
    const a = 0.14 - i*0.012;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${s[0]},${s[1]},${s[2]},${Math.max(0, a)})`;
    ctx.lineWidth = Math.max(1, (Math.min(w,h)*0.006) - i*0.15);
    ctx.arc(0, 0, rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // 粒子
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 240; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const rr = 0.6 + Math.random() * 2.2;
    const a = 0.05 + Math.random() * 0.10;
    ctx.fillStyle = `rgba(${m[0]},${m[1]},${m[2]},${a})`;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // ラベル
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `${Math.floor(Math.min(w,h)*0.06)}px system-ui, sans-serif`;
  ctx.fillText(`${main}${sub ? " / " + sub : ""}`, Math.floor(w*0.06), Math.floor(h*0.16));
}

function downloadPngFromCanvas(canvas) {
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
    bottle: state.bottle || null,
    scores: state.scores || {},
    top: state.top || [],
    memo: memo || ""
  });
  localStorage.setItem(KEY, JSON.stringify(arr));
}

(async function init() {
  try {
    const state = loadState();

    if (statusEl) {
      statusEl.textContent =
        `state:${state ? "OK" : "NULL"} bottle:${state?.bottle ? "OK" : "NG"} scores:${state?.scores ? "OK" : "NG"}`;
    }

    if (!state || !state.bottle || !state.scores) {
      go("index.html"); // /aura/index.html に固定されている前提
      return;
    }

    const bottle = state.bottle;
    const top = topColors(state.scores, 2);
    const main = top[0] || bottle.top_color || "Blue";
    const sub = top[1] || bottle.bottom_color || "";

    state.top = top;

    // 左側表示
    if (bottleNameEl) bottleNameEl.textContent = `${bottle.name || "—"}${bottle.bottle_id ? ` (${bottle.bottle_id})` : ""}`;
    if (bottleColorsEl) bottleColorsEl.textContent = `${bottle.top_color || "—"} / ${bottle.bottom_color || "—"}`;
    if (topColorsEl) topColorsEl.textContent = sub ? `${main} / ${sub}` : `${main}`;

    // 文章（仮）
    if (meaningShortEl) meaningShortEl.textContent = "色が、形になる。";
    if (meaningLongEl) meaningLongEl.textContent = "今は答えを急がず、体感として受け取る段階です。";
    if (shadowEl) shadowEl.textContent = "説明しようとしすぎない。";
    if (actionEl) actionEl.textContent = "深呼吸を1回。";

    // オーラ描画
    drawAura(main, sub);
    window.addEventListener("resize", () => drawAura(main, sub));

    // PNG
    if (btnSavePng) {
      btnSavePng.onclick = () => {
        if (!canvas) return alert("canvasが見つかりません");
        downloadPngFromCanvas(canvas);
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

    // 最初から
    if (btnRestart) {
      btnRestart.onclick = () => {
        resetState();
        go("index.html");
      };
    }
  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.textContent = "result.js でエラー（Console参照）";
  }
})();
