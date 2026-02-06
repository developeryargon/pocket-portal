import { loadState, saveState, clamp, go } from "./common.js";
import { loadCSV } from "./csv.js";

/**
 * 24本 bottles.csv 前提
 * - pickedColor を元に候補3つ提示（スコア上位）
 * - canvas は光演出のみ、ボトルPNGは #bottleImg に表示
 */

const state = loadState();
if (!state) go("index.html");
if (!state.pickedColor) go("index.html");

const pickedColor = state.pickedColor || "Blue";

const pickedEl = document.getElementById("picked");
const leadEl = document.getElementById("lead");
const listEl = document.getElementById("list");
const noteEl = document.getElementById("note");
const toQBtn = document.getElementById("toQ");
const backBtn = document.getElementById("back");

if (pickedEl) pickedEl.textContent = pickedColor;

const canvas = document.getElementById("c");
const ctx = canvas?.getContext("2d");
const bottleImgEl = document.getElementById("bottleImg");

let W = canvas?.width || 1200;
let H = canvas?.height || 520;

let t = 0;
let bottles = [];
let candidates = [];
let chosen = null;

const COLOR_RGB = {
  Blue: [80, 140, 255],
  Gold: [255, 210, 90],
  Violet: [180, 110, 255],
  Green: [90, 230, 170],
  Red: [255, 90, 120],
  Pink: [255, 130, 200],
  Yellow: [255, 245, 120],
  Black: [25, 30, 45],
  White: [230, 235, 255],
};

function rand(a, b) { return a + Math.random() * (b - a); }
function toStr(v) { return (v ?? "").toString().trim(); }
function toNum(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

/** CSV 行を正規化（列名ゆれ吸収） */
function normalizeBottleRow(r) {
  const obj = {};
  for (const [k, v] of Object.entries(r || {})) {
    const kk = toStr(k).replace(/^\uFEFF/, "").trim();
    obj[kk] = toStr(v);
  }
  return {
    bottle_id: obj.bottle_id || obj.id || obj.code || "",
    name: obj.name || obj.title || obj.bottle_name || "",
    top_color: obj.top_color || obj.top || obj.topColor || "",
    bottom_color: obj.bottom_color || obj.bottom || obj.bottomColor || "",
    image: obj.image || obj.img || obj.image_url || obj.url || "",
    keywords: obj.keywords || obj.tags || ""
  };
}

/**
 * パスを /aura 配下でも確実に解決
 * - b.image は "assets/img/..." のような相対を想定
 */
function resolveImgUrl(imagePath) {
  const p = toStr(imagePath);
  if (!p) return "";
  try {
    // bottle.js(= ./assets/js/bottle.js) から見た相対として解決
    // 例: "../../assets/img/bottles/xxx.png"
    const rel = p.startsWith("./") ? p : `./${p}`;
    return new URL(rel, import.meta.url).toString();
  } catch (e) {
    console.warn("resolveImgUrl failed:", p, e);
    return p;
  }
}

function scoreBottle(b, picked) {
  let s = 0;

  // 直一致は強め
  if (b.top_color === picked) s += 5;
  if (b.bottom_color === picked) s += 4;

  // 近い色（軽く）
  const friendly = {
    Blue: ["Violet", "Green", "White"],
    Gold: ["Yellow", "Red", "White"],
    Violet: ["Blue", "Black", "Pink"],
    Green: ["Blue", "Yellow", "White"],
    Red: ["Gold", "Yellow", "Black"],
    Pink: ["Violet", "Red", "White"],
    Yellow: ["Gold", "Green", "Red"],
    Black: ["Violet", "Red", "Blue"],
    White: ["Blue", "Gold", "Pink"],
  };
  const near = friendly[picked] || [];
  if (near.includes(b.top_color)) s += 1.2;
  if (near.includes(b.bottom_color)) s += 1.0;

  // 画像があるものを優先
  if (toStr(b.image)) s += 0.8;

  // keywords ちょい加点
  if (toStr(b.keywords)) s += 0.2;

  return s;
}

function setBottleImage(b) {
  if (!bottleImgEl) return;

  bottleImgEl.classList.remove("isOn", "isFloat");

  const url = resolveImgUrl(b.image);
  if (!url) {
    bottleImgEl.src = "";
    return;
  }

  bottleImgEl.onload = () => {
    bottleImgEl.classList.add("isOn", "isFloat");
  };
  bottleImgEl.onerror = () => {
    console.warn("Bottle image load failed:", url, "original:", b.image);
    bottleImgEl.src = "";
  };

  bottleImgEl.src = url;
}

function renderList() {
  if (!listEl) return;
  listEl.innerHTML = "";

  if (!candidates.length) {
    const p = document.createElement("div");
    p.className = "small";
    p.textContent = "候補がありません（bottles.csv を確認してください）";
    listEl.appendChild(p);
    return;
  }

  candidates.forEach((b) => {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.style.minWidth = "240px";
    btn.style.textAlign = "left";
    btn.innerHTML = `
      <div style="font-weight:900">${b.name || "(no name)"}</div>
      <div class="small">${b.top_color || "?"} / ${b.bottom_color || "?"}</div>
    `;

    btn.onclick = () => {
      chosen = b;
      if (toQBtn) toQBtn.disabled = false;
      if (noteEl) noteEl.textContent = `確定候補: ${b.bottle_id || "(no id)"}（${b.name || "(no name)"}）`;
      setBottleImage(b);
    };

    listEl.appendChild(btn);
  });

  if (toQBtn) toQBtn.disabled = true;
  if (bottleImgEl) bottleImgEl.src = "";
}

/* ---- Canvas 演出 ---- */

const particles = Array.from({ length: 220 }).map(() => ({
  x: rand(0, W), y: rand(0, H),
  vx: rand(-0.6, 0.6), vy: rand(-0.6, 0.6),
  r: rand(1.0, 2.8),
  a: rand(0.08, 0.25),
  phase: rand(0, Math.PI * 2)
}));

function fitCanvasToCss() {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width * dpr));
  const h = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    W = w; H = h;
  }
}

function drawCeremony() {
  if (!canvas || !ctx) return;

  fitCanvasToCss();
  t += 0.016;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "rgb(7,10,18)";
  ctx.fillRect(0, 0, W, H);

  const pickedRgb = COLOR_RGB[pickedColor] || [120, 160, 255];

  const bg = ctx.createRadialGradient(W * 0.55, H * 0.55, 0, W * 0.55, H * 0.55, H * 0.95);
  bg.addColorStop(0, `rgba(${pickedRgb[0]},${pickedRgb[1]},${pickedRgb[2]},0.18)`);
  bg.addColorStop(1, `rgba(${pickedRgb[0]},${pickedRgb[1]},${pickedRgb[2]},0.00)`);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (const p of particles) {
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0) p.x += W; if (p.x > W) p.x -= W;
    if (p.y < 0) p.y += H; if (p.y > H) p.y -= H;

    const tw = 0.5 + 0.5 * Math.sin(t + p.phase);
    ctx.fillStyle = `rgba(${pickedRgb[0]},${pickedRgb[1]},${pickedRgb[2]},${p.a * tw})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * (0.8 + tw), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  if (chosen) {
    const topC = COLOR_RGB[chosen.top_color] || pickedRgb;
    const cx = W * 0.50, cy = H * 0.55;
    const rMax = Math.min(W, H) * 0.58;

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 9; i++) {
      const rr = rMax * (0.15 + i * 0.06);
      const a = 0.10 - i * 0.008;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${topC[0]},${topC[1]},${topC[2]},${Math.max(0, a)})`;
      ctx.lineWidth = Math.max(1, Math.min(W, H) * 0.004 - i * 0.08);
      ctx.arc(cx, cy, rr + Math.sin(t * 1.2 + i) * 2.2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  requestAnimationFrame(drawCeremony);
}

/* ---- init ---- */

(async function init() {
  try {
    if (toQBtn) toQBtn.disabled = true;

    const raw = await loadCSV("assets/data/bottles.csv");
    bottles = (Array.isArray(raw) ? raw : [])
      .map(normalizeBottleRow)
      .filter(b => b.name && b.top_color && b.bottom_color);

    if (!bottles.length && leadEl) {
      leadEl.textContent = "bottles.csv が空、またはヘッダ不一致です。";
      return;
    }

    // pickedColor に寄せて候補3つ
    candidates = bottles
      .map(b => ({ b, s: scoreBottle(b, pickedColor) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 3)
      .map(x => x.b);

    renderList();
    drawCeremony();

    window.addEventListener("resize", () => fitCanvasToCss());
  } catch (err) {
    console.error(err);
    if (leadEl) leadEl.textContent = "読み込みに失敗しました。Networkで bottles.csv が200か確認。";
  }
})();

/* ---- buttons ---- */

if (toQBtn) {
  toQBtn.onclick = () => {
    if (!chosen) return;

    saveState({
      step: "questions",
      bottle: {
        bottle_id: chosen.bottle_id,
        name: chosen.name,
        top_color: chosen.top_color,
        bottom_color: chosen.bottom_color,
        image: toStr(chosen.image),
      }
    });

    go("questions.html");
  };
}

if (backBtn) {
  backBtn.onclick = () => history.back();
}
