import { loadState, saveState, clamp, go } from "./common.js";
import { loadCSV } from "./csv.js";

/**
 * bottle.js（24本対応・最終安定版）
 * - bottles.csv は 24本すべて読む
 * - 候補はスコア上位3つだけ表示
 * - 画像は /aura/ を基準に絶対パスで表示
 */

const state = loadState();
if (!state || !state.pickedColor) go("index.html");

const pickedColor = state.pickedColor;

const pickedEl = document.getElementById("picked");
const leadEl   = document.getElementById("lead");
const listEl   = document.getElementById("list");
const noteEl   = document.getElementById("note");
const toQBtn   = document.getElementById("toQ");
const backBtn  = document.getElementById("back");

if (pickedEl) pickedEl.textContent = pickedColor;

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const bottleImgEl = document.getElementById("bottleImg");

let W = canvas.width;
let H = canvas.height;

let bottles = [];
let candidates = [];
let chosen = null;
let t = 0;

const COLOR_RGB = {
  Blue: [80,140,255],
  Gold: [255,210,90],
  Violet: [180,110,255],
  Green: [90,230,170],
  Red: [255,90,120],
  Pink: [255,130,200],
  Yellow: [255,245,120],
  Black: [25,30,45],
  White: [230,235,255],
};

const rand = (a,b)=>a+Math.random()*(b-a);
const toStr = v => (v ?? "").toString().trim();

/* ---------------- CSV 正規化 ---------------- */

function normalizeBottleRow(r){
  const o = {};
  for(const [k,v] of Object.entries(r)){
    o[toStr(k).replace(/^\uFEFF/,"")] = toStr(v);
  }
  return {
    bottle_id: o.bottle_id || o.id || "",
    name: o.name || "",
    top_color: o.top_color || "",
    bottom_color: o.bottom_color || "",
    image: o.image || "",
  };
}

/* ---------------- 画像パス（★重要） ---------------- */

function resolveBottleImagePath(image){
  if(!image) return "";
  // /aura/ を起点にする（Pagesで確実）
  return `/aura/${image.replace(/^\.?\//,"")}`;
}

function setBottleImage(b){
  if(!bottleImgEl) return;

  bottleImgEl.classList.remove("isOn","isFloat");

  const src = resolveBottleImagePath(b.image);
  if(!src){
    bottleImgEl.src = "";
    return;
  }

  bottleImgEl.onload = ()=>{
    bottleImgEl.classList.add("isOn","isFloat");
  };
  bottleImgEl.onerror = ()=>{
    console.warn("Bottle image load failed:", src);
    bottleImgEl.src = "";
  };

  bottleImgEl.src = src;
}

/* ---------------- スコア ---------------- */

function scoreBottle(b){
  let s = 0;
  if(b.top_color === pickedColor) s += 5;
  if(b.bottom_color === pickedColor) s += 4;
  if(b.image) s += 1;
  return s;
}

/* ---------------- UI ---------------- */

function renderList(){
  listEl.innerHTML = "";

  candidates.forEach(b=>{
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.style.minWidth = "240px";
    btn.style.textAlign = "left";
    btn.innerHTML = `
      <div style="font-weight:900">${b.name}</div>
      <div class="small">${b.top_color} / ${b.bottom_color}</div>
    `;
    btn.onclick = ()=>{
      chosen = b;
      toQBtn.disabled = false;
      noteEl.textContent = `確定候補: ${b.bottle_id} (${b.name})`;
      setBottleImage(b);
    };
    listEl.appendChild(btn);
  });

  toQBtn.disabled = true;
  bottleImgEl.src = "";
}

/* ---------------- Canvas 演出 ---------------- */

const particles = Array.from({length:180}).map(()=>({
  x:rand(0,W),y:rand(0,H),
  vx:rand(-0.4,0.4),vy:rand(-0.4,0.4),
  r:rand(1,2.5),a:rand(0.05,0.2),p:rand(0,Math.PI*2)
}));

function draw(){
  t+=0.016;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle="rgb(7,10,18)";
  ctx.fillRect(0,0,W,H);

  const c = COLOR_RGB[pickedColor];

  ctx.globalCompositeOperation="screen";
  for(const p of particles){
    p.x+=p.vx; p.y+=p.vy;
    if(p.x<0)p.x+=W;if(p.x>W)p.x-=W;
    if(p.y<0)p.y+=H;if(p.y>H)p.y-=H;
    const tw=0.5+0.5*Math.sin(t+p.p);
    ctx.fillStyle=`rgba(${c[0]},${c[1]},${c[2]},${p.a*tw})`;
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.r*(0.8+tw),0,Math.PI*2);
    ctx.fill();
  }
  ctx.globalCompositeOperation="source-over";

  requestAnimationFrame(draw);
}

/* ---------------- init ---------------- */

(async function init(){
  const raw = await loadCSV("assets/data/bottles.csv");
  bottles = raw.map(normalizeBottleRow);

  candidates = bottles
    .map(b=>({b,s:scoreBottle(b)}))
    .sort((a,b)=>b.s-a.s)
    .slice(0,3)
    .map(x=>x.b);

  renderList();
  draw();
})();

/* ---------------- buttons ---------------- */

toQBtn.onclick = ()=>{
  if(!chosen) return;
  saveState({ step:"questions", bottle: chosen });
  go("questions.html");
};

backBtn.onclick = ()=>history.back();
