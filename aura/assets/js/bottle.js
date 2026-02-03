import { loadState, saveState, clamp, go } from "./common.js";
import { loadCSV } from "./csv.js";

/**
 * bottle.js
 * - pickedColor を元に bottles.csv から候補3つを提示
 * - Canvasは「光・粒子・リング」だけ描画（ボトルPNGは bottle.html の #bottleImg に表示）
 * - 候補タップで chosen を確定し、#bottleImg の src を assets/img/bottles/*.png に差し替え
 * - 「このボトルで進む」で state.bottle を保存して questions.html へ
 */

const state = loadState();
if (!state) {
  go("index.html");
}

const pickedColor = state.pickedColor || "Blue";

const pickedEl = document.getElementById("picked");
if (pickedEl) pickedEl.textContent = pickedColor;

const canvas = document.getElementById("c");
const ctx = canvas?.getContext("2d");

const bottleImgEl = document.getElementById("bottleImg"); // bottle.html 側で重ねる画像
const leadEl = document.getElementById("lead");
const listEl = document.getElementById("list");
const noteEl = document.getElementById("note");
const toQBtn = document.getElementById("toQ");
const backBtn = document.getElementById("back");

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

/** bottles.csv から image を解決
 * - 優先: CSVの image があればそれ
 * - 無ければID/名前から推測（今回の3種に合わせて固定マッピングも用意）
 */
function resolveBottleImagePath(b) {
  const img = toStr(b.image);
  if (img) {
    // 既に assets/img/... 形式で入っている前提。相対も許容。
    return img.startsWith("assets/") ? `./${img}` : img.startsWith("./") ? img : `./${img}`;
  }

  const id = toStr(b.bottle_id).toLowerCase();
  const name = toStr(b.name).toLowerCase();

  // ✅ 今回作成した3つを確実に当てる（最優先）
  // id が B003/B002/B004 などでも、name のキーワードでも拾えるように。
  const map = [
    { keys: ["heart spring", "heart-spring", "b003", "heart_spring"], path: "./assets/img/bottles/heart-spring.png" },
    { keys: ["shadow bloom", "shadow-bloom", "b002", "shadow_bloom"], path: "./assets/img/bottles/shadow-bloom.png" },
    { keys: ["solar edge", "solar-edge", "b004", "solar_edge"], path: "./assets/img/bottles/solar-edge.png" },
  ];

  for (const m of map) {
    if (m.keys.some(k => name.includes(k) || id.includes(k))) return m.path;
  }

  // 最後の保険（見つからない場合は空）
  return "";
}

// 列名揺れ吸収（CSVヘッダが違っても拾う）
function normalizeBottleRow(r) {
  const obj = {};
  for (const [k, v] of Object.entries(r || {})) {
    const kk = toStr(k).replace(/^\uFEFF/, "").trim(); // BOM
    obj[kk] = toStr(v);
  }

  const bottle_id = obj.bottle_id || obj.id || obj.bottleId || obj.code || "";
  const name = obj.name || obj.title || obj.bottle_name || "";
  const top_color = obj.top_color || obj.top || obj.topColor || obj.top_colour || "";
  const bottom_color = obj.bottom_color || obj.bottom || obj.bottomColor || obj.bottom_colour || "";
  const image = obj.image || obj.img || obj.image_url || obj.url || "";
  const keywords = obj.keywords || obj.tags || "";

  return { bottle_id, name, top_color, bottom_color, image, keywords };
}

function scoreBottle(b, picked) {
  let s = 0;
  if (b.top_color === picked) s += 4;
  if (b.bottom_color === picked) s += 3;

  const friendly = {
    Blue: ["Violet", "Green", "White"],
    Gold: ["Yellow", "Orange", "Red"],
    Violet: ["Blue", "Black", "Pink"],
    Green: ["Blue", "Yellow", "Pink"],
    Red: ["Gold", "Yellow", "Pink"],
    Pink: ["Violet", "Red", "White"],
    Yellow: ["Gold", "Green", "Red"],
    Black: ["Violet", "Blue", "Red"],
    White: ["Blue", "Pink", "Gold"],
  };

  const near = friendly[picked] || [];
  if (near.includes(b.top_color)) s += 1;
  if (near.includes(b.bottom_color)) s += 1;

  if ((b.keywords || "").length > 0) s += 0.2;
  return s;
}

/* ---------- UI ---------- */

function setBottleImage(b) {
  if (!bottleImgEl) return;

  const src = resolveBottleImagePath(b);
  if (!src) {
    // 画像が無い場合は非表示（Canvasの簡易ボトルが見える想定）
    bottleImgEl.classList.remove("isOn", "isFloat");
    bottleImgEl.src = "";
    return;
  }

  bottleImgEl.src = src;

  // 読み込み後にフェードイン
  bottleImgEl.onload = () => {
    bottleImgEl.classList.add("isOn", "isFloat");
  };
}

function renderList() {
  if (!listEl) return;
  listEl.innerHTML = "";

  if (!candidates.length) {
    const p = document.createElement("div");
    p.className = "small";
    p.textContent = "候補がありません（bottles.csvの内容を確認してください）";
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

      if (noteEl) {
        noteEl.textContent = `確定候補: ${b.bottle_id || "(no id)"}（${b.name || "(no name)"}）`;
      }

      // ✅ PNGボトル画像を当てはめ
      setBottleImage(b);
    };

    listEl.appendChild(btn);
  });

  // 最初は「選択前」なので画像は消しておく
  if (bottleImgEl) {
    bottleImgEl.classList.remove("isOn", "isFloat");
    bottleImgEl.src = "";
  }

  if (toQBtn) toQBtn.disabled = true;
}

/* ---------- Canvas: 光・粒子 ---------- */

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

  // 背景
  ctx.fillStyle = "rgb(7,10,18)";
  ctx.fillRect(0, 0, W, H);

  const pickedRgb = COLOR_RGB[pickedColor] || [120, 160, 255];

  // 背景のにじみ
  const bg = ctx.createRadialGradient(W * 0.55, H * 0.55, 0, W * 0.55, H * 0.55, H * 0.95);
  bg.addColorStop(0, `rgba(${pickedRgb[0]},${pickedRgb[1]},${pickedRgb[2]},0.18)`);
  bg.addColorStop(1, `rgba(${pickedRgb[0]},${pickedRgb[1]},${pickedRgb[2]},0.00)`);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 粒子
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

  // 選択後：まとわりつくリング強化
  if (chosen) {
    const topC = COLOR_RGB[chosen.top_color] || pickedRgb;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const cx = W * 0.50, cy = H * 0.55;
    const rMax = Math.min(W, H) * 0.58;

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

/* ---------- init ---------- */

(async function init() {
  try {
    if (toQBtn) toQBtn.disabled = true;

    // CSV
    const raw = await loadCSV("assets/data/bottles.csv");
    bottles = (Array.isArray(raw) ? raw : [])
      .map(normalizeBottleRow)
      .filter(b => b.name && b.top_color && b.bottom_color);

    if (!bottles.length && leadEl) {
      leadEl.textContent = "bottles.csv が読めていないか、列名が一致していません。ヘッダを確認してください。";
    }

    const scored = bottles
      .map(b => ({ b, s: scoreBottle(b, pickedColor) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 3)
      .map(x => x.b);

    candidates = scored.length ? scored : bottles.slice(0, 3);
    renderList();

    // ループ開始
    drawCeremony();
    window.addEventListener("resize", () => {
      // resize時に一度だけ粒子位置をラップし直し（完全初期化はしない）
      fitCanvasToCss();
    });

  } catch (err) {
    if (leadEl) leadEl.textContent = "データ読み込みに失敗しました。NetworkでCSVが200か確認してください。";
    console.error(err);
  }
})();

/* ---------- buttons ---------- */

if (toQBtn) {
  toQBtn.onclick = () => {
    if (!chosen) return;

    // ✅ result や history と整合する形で保存
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

/* ---------- helpers ---------- */

function roundRect(ctx, x, y, w, h, r) {
  r = clamp(r, 0, Math.min(w, h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
