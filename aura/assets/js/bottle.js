import { loadState, saveState, clamp } from "./common.js";
import { loadCSV } from "./csv.js";

const state = loadState();
const pickedColor = state.pickedColor || "Blue";
document.getElementById("picked").textContent = pickedColor;

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

let t = 0;
let bottles = [];
let candidates = [];
let chosen = null;

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

function rand(a,b){ return a + Math.random()*(b-a); }

const particles = Array.from({length:220}).map(()=>({
  x: rand(0,W), y: rand(0,H),
  vx: rand(-0.6,0.6), vy: rand(-0.6,0.6),
  r: rand(1.0,2.8),
  a: rand(0.08,0.25),
  phase: rand(0,Math.PI*2)
}));

function scoreBottle(b, picked) {
  // pickedColorが top/bottom に含まれるほど上位
  let s = 0;
  if (b.top_color === picked) s += 4;
  if (b.bottom_color === picked) s += 3;

  // 追加：近い系統を少し加点（最低限）
  const friendly = {
    Blue: ["Violet","Green","White"],
    Gold: ["Yellow","Orange","Red"],
    Violet: ["Blue","Black","Pink"],
    Green: ["Blue","Yellow","Pink"],
    Red: ["Gold","Yellow","Pink"],
    Pink: ["Violet","Red","White"],
    Yellow: ["Gold","Green","Red"],
    Black: ["Violet","Blue","Red"],
    White: ["Blue","Pink","Gold"],
  };
  const near = friendly[picked] || [];
  if (near.includes(b.top_color)) s += 1;
  if (near.includes(b.bottom_color)) s += 1;

  // キーワードがあれば雰囲気要因として微加点（ランダム性を減らす）
  if ((b.keywords || "").length > 0) s += 0.2;

  return s;
}

function renderList() {
  const list = document.getElementById("list");
  list.innerHTML = "";

  candidates.forEach((b) => {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.style.minWidth = "240px";
    btn.style.textAlign = "left";
    btn.innerHTML = `
      <div style="font-weight:900">${b.name}</div>
      <div class="small">${b.top_color} / ${b.bottom_color}</div>
    `;
    btn.onclick = () => {
      chosen = b;
      document.getElementById("toQ").disabled = false;
      document.getElementById("note").textContent = `確定候補: ${b.bottle_id}（${b.name}）`;
    };
    list.appendChild(btn);
  });
}

function drawCeremony() {
  t += 0.016;

  // 背景
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = "rgb(7,10,18)";
  ctx.fillRect(0,0,W,H);

  // 選択色の“気配”を出す
  const pickedRgb = COLOR_RGB[pickedColor] || [120,160,255];
  const bg = ctx.createRadialGradient(W*0.55, H*0.55, 0, W*0.55, H*0.55, H*0.95);
  bg.addColorStop(0, `rgba(${pickedRgb[0]},${pickedRgb[1]},${pickedRgb[2]},0.18)`);
  bg.addColorStop(1, `rgba(${pickedRgb[0]},${pickedRgb[1]},${pickedRgb[2]},0.00)`);
  ctx.fillStyle = bg;
  ctx.fillRect(0,0,W,H);

  // 粒子
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0) p.x += W;
    if (p.x > W) p.x -= W;
    if (p.y < 0) p.y += H;
    if (p.y > H) p.y -= H;

    const tw = 0.5 + 0.5*Math.sin(t + p.phase);
    ctx.fillStyle = `rgba(${pickedRgb[0]},${pickedRgb[1]},${pickedRgb[2]},${p.a*tw})`;
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.r*(0.8+tw),0,Math.PI*2);
    ctx.fill();
  }
  ctx.restore();

  // “ボトル”の抽象表現（画像がなくても儀式になる）
  // 画像があれば後で重ねられる
  const cx = W*0.50, cy = H*0.55;
  const bw = W*0.18, bh = H*0.48;

  // ボトルのガラス
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 3;

  roundRect(ctx, cx-bw/2, cy-bh/2, bw, bh, 26);
  ctx.stroke();

  // 中身（上下色）
  const topC = chosen ? (COLOR_RGB[chosen.top_color] || pickedRgb) : pickedRgb;
  const botC = chosen ? (COLOR_RGB[chosen.bottom_color] || [30,40,60]) : [20,25,40];

  const fillH = bh*0.78;
  const fillY = cy + bh*0.5 - fillH - 18;

  // 下
  ctx.fillStyle = `rgba(${botC[0]},${botC[1]},${botC[2]},0.55)`;
  roundRect(ctx, cx-bw/2+8, fillY+fillH*0.5, bw-16, fillH*0.5, 18);
  ctx.fill();

  // 上
  ctx.fillStyle = `rgba(${topC[0]},${topC[1]},${topC[2]},0.55)`;
  roundRect(ctx, cx-bw/2+8, fillY, bw-16, fillH*0.5, 18);
  ctx.fill();

  // ハイライト
  ctx.globalCompositeOperation = "screen";
  const hl = ctx.createLinearGradient(cx-bw/3, fillY, cx+bw/3, fillY);
  hl.addColorStop(0, "rgba(255,255,255,0)");
  hl.addColorStop(0.5, "rgba(255,255,255,0.18)");
  hl.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hl;
  roundRect(ctx, cx-bw/2+14, fillY, 18, fillH, 12);
  ctx.fill();

  // 選択時リング
  if (chosen) {
    ctx.globalCompositeOperation = "screen";
    const ring = ctx.createRadialGradient(cx, cy, 0, cx, cy, bh*0.55);
    ring.addColorStop(0, `rgba(${topC[0]},${topC[1]},${topC[2]},0.00)`);
    ring.addColorStop(0.5, `rgba(${topC[0]},${topC[1]},${topC[2]},0.10)`);
    ring.addColorStop(1, `rgba(${topC[0]},${topC[1]},${topC[2]},0.00)`);
    ctx.fillStyle = ring;
    ctx.fillRect(0,0,W,H);
  }

  ctx.restore();

  requestAnimationFrame(drawCeremony);
}
drawCeremony();

function roundRect(ctx, x, y, w, h, r) {
  r = clamp(r, 0, Math.min(w,h)/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

// CSV読み込み→候補生成
(async function init(){
  bottles = await loadCSV("/assets/data/bottles.csv");

  // スコア順で上位3つ
  const scored = bottles
    .map(b => ({ b, s: scoreBottle(b, pickedColor) }))
    .sort((a,b)=> b.s - a.s)
    .slice(0, 3)
    .map(x => x.b);

  // もしデータが少なければ、そのまま全部
  candidates = scored.length ? scored : bottles.slice(0,3);

  renderList();
})().catch(err=>{
  document.getElementById("lead").textContent = "データ読み込みに失敗しました。CSVパスを確認してください。";
  console.error(err);
});

// 次へ
document.getElementById("toQ").onclick = ()=>{
  if (!chosen) return;

  saveState({
    step: "questions",
    bottle: {
      bottle_id: chosen.bottle_id,
      name: chosen.name,
      top_color: chosen.top_color,
      bottom_color: chosen.bottom_color,
      image: chosen.image
    }
  });
  location.href = "/questions.html";
};

document.getElementById("back").onclick = ()=> history.back();
