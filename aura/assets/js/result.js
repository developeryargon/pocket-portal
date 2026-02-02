import { loadState, saveState, resetState, pickTopColors } from "./common.js";
import { loadCSV } from "./csv.js";

const state = loadState();
if (!state.scores) location.href = "/index.html";

const bottleName = document.getElementById("bottleName");
const bottleColors = document.getElementById("bottleColors");
const topColorsEl = document.getElementById("topColors");

const meaningShort = document.getElementById("meaningShort");
const meaningLong = document.getElementById("meaningLong");
const shadowEl = document.getElementById("shadow");
const actionEl = document.getElementById("action");
const statusEl = document.getElementById("status");

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

const COLOR_RGB = {
  Blue:   [80,140,255],
  Gold:   [255,210,90],
  Violet: [180,110,255],
  Green:  [90,230,170],
  Red:    [255,90,120],
  Pink:   [255,130,200],
  Yellow: [255,245,120],
  Black:  [25,30,45],
  White:  [230,235,255],
};

const bottle = state.bottle || {};
bottleName.textContent = bottle.name ? `${bottle.name}（${bottle.bottle_id}`: "?";
bottleColors.textContent = bottle.top_color ? `${bottle.top_color} / ${bottle.bottom_color}` : "?";

const top2 = pickTopColors(state.scores, 2);
const mainColor = top2[0] || "Blue";
const subColor  = top2[1] || "Gold";
topColorsEl.textContent = `${mainColor} / ${subColor}`;

let mode = "heal"; // heal / awaken
let colorRows = [];

let t = 0;
const particles = Array.from({length:320}).map((_,i)=>({
  x: Math.random()*W,
  y: Math.random()*H,
  r: 1 + Math.random()*2.6,
  a: 0.06 + Math.random()*0.18,
  sp: 0.5 + Math.random()*1.2,
  ph: Math.random()*Math.PI*2,
  lane: i%2, // 主題/補助
}));

function findMeaning(color, mode) {
  const row = colorRows.find(r => r.color === color && r.mode === mode);
  // modeが無い場合は同色のどれか
  return row || colorRows.find(r => r.color === color) || null;
}

function setMeaning() {
  const m = findMeaning(mainColor, mode);
  if (!m) {
    meaningShort.textContent = "?";
    meaningLong.textContent = "";
    shadowEl.textContent = "";
    actionEl.textContent = "";
    return;
  }
  meaningShort.textContent = m.meaning_short || "";
  meaningLong.textContent = m.meaning_long || "";
  shadowEl.textContent = m.shadow || "";
  actionEl.textContent = m.action || "";
}

function drawAura() {
  t += 0.016;

  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = "rgb(7,10,18)";
  ctx.fillRect(0,0,W,H);

  const main = COLOR_RGB[mainColor] || [80,140,255];
  const sub  = COLOR_RGB[subColor]  || [255,210,90];

  // 背景の“気配”
  const bg = ctx.createRadialGradient(W*0.55, H*0.55, 0, W*0.55, H*0.55, H*0.95);
  bg.addColorStop(0, `rgba(${main[0]},${main[1]},${main[2]},0.12)`);
  bg.addColorStop(1, `rgba(${main[0]},${main[1]},${main[2]},0.00)`);
  ctx.fillStyle = bg;
  ctx.fillRect(0,0,W,H);

  // オーラリング（主題・補助）
  const cx = W*0.52, cy = H*0.53;
  const baseR = H*0.22;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let i=0;i<7;i++){
    const a = 0.12 - i*0.014;
    const r = baseR + i*18 + Math.sin(t*1.2+i)*6;

    ctx.strokeStyle = `rgba(${main[0]},${main[1]},${main[2]},${a})`;
    ctx.lineWidth = 14 + i*6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.stroke();
  }

  for (let i=0;i<5;i++){
    const a = 0.10 - i*0.016;
    const r = baseR*0.68 + i*16 + Math.cos(t*1.1+i)*6;

    ctx.strokeStyle = `rgba(${sub[0]},${sub[1]},${sub[2]},${a})`;
    ctx.lineWidth = 10 + i*5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.stroke();
  }

  // 粒子（主題/補助を交互）
  for (const p of particles) {
    const col = p.lane === 0 ? main : sub;
    const tw = 0.5 + 0.5*Math.sin(t*p.sp + p.ph);
    const vx = Math.cos(t*0.5 + p.ph) * (0.5 + tw) * 0.6;
    const vy = Math.sin(t*0.45 + p.ph) * (0.5 + tw) * 0.6;
    p.x += vx;
    p.y += vy;
    if (p.x < 0) p.x += W;
    if (p.x > W) p.x -= W;
    if (p.y < 0) p.y += H;
    if (p.y > H) p.y -= H;

    ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${p.a*tw})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r*(0.7+tw), 0, Math.PI*2);
    ctx.fill();
  }

  // 中心の“波紋”
  const ripple = 0.5 + 0.5*Math.sin(t*1.3);
  const rr = baseR*0.55 + ripple*18;
  const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
  rg.addColorStop(0, `rgba(${main[0]},${main[1]},${main[2]},0.00)`);
  rg.addColorStop(0.7, `rgba(${main[0]},${main[1]},${main[2]},0.12)`);
  rg.addColorStop(1, `rgba(${main[0]},${main[1]},${main[2]},0.00)`);
  ctx.fillStyle = rg;
  ctx.fillRect(0,0,W,H);

  ctx.restore();

  // カード用テキスト（Canvas内にも載せる）
  ctx.save();
  ctx.fillStyle = "rgba(233,238,255,0.92)";
  ctx.font = "700 32px system-ui, -apple-system, 'Noto Sans JP', sans-serif";
  ctx.fillText(`${mainColor} / ${subColor}`, 44, 72);

  ctx.fillStyle = "rgba(154,164,192,0.95)";
  ctx.font = "500 18px system-ui, -apple-system, 'Noto Sans JP', sans-serif";
  const bn = bottle.name ? `${bottle.name} (${bottle.bottle_id})` : "";
  ctx.fillText(bn, 44, 102);

  const memo = (document.getElementById("memo").value || "").slice(0, 60);
  if (memo) ctx.fillText(memo, 44, 132);

  ctx.restore();

  requestAnimationFrame(drawAura);
}
drawAura();

document.getElementById("modeHeal").onclick = ()=>{
  mode = "heal";
  setMeaning();
  statusEl.textContent = "モード：癒し";
};
document.getElementById("modeAwaken").onclick = ()=>{
  mode = "awaken";
  setMeaning();
  statusEl.textContent = "モード：覚醒";
};

document.getElementById("restart").onclick = ()=>{
  resetState();
  location.href = "/index.html";
};

// PNG保存（ブラウザのダウンロード）
document.getElementById("savePng").onclick = ()=>{
  const a = document.createElement("a");
  a.download = `aura_${Date.now()}.png`;
  a.href = canvas.toDataURL("image/png");
  a.click();
  statusEl.textContent = "PNGを保存しました（ダウンロード）";
};

// 履歴保存（localStorage）
document.getElementById("saveHistory").onclick = ()=>{
  const memo = document.getElementById("memo").value || "";
  const item = {
    ts: Date.now(),
    bottle,
    mode,
    mainColor,
    subColor,
    scores: state.scores,
    memo
  };

  const key = "aura_soma_history_v1";
  let arr = [];
  try { arr = JSON.parse(localStorage.getItem(key)) || []; } catch {}
  arr.unshift(item);
  arr = arr.slice(0, 50);
  localStorage.setItem(key, JSON.stringify(arr));

  statusEl.textContent = "履歴に保存しました（端末内）";
};

(async function init(){
  colorRows = await loadCSV("/assets/data/colors.csv");
  setMeaning();
  statusEl.textContent = "準備完了";
})().catch(err=>{
  console.error(err);
  statusEl.textContent = "colors.csv の読み込みに失敗しました";
})();
