import { saveState } from "./common.js";

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const W = canvas.width, H = canvas.height;

// ここを増やすほど“奥行き”が出る
const PALETTE = [
  { name:"Blue",   rgb:[80,140,255] },
  { name:"Gold",   rgb:[255,210,90] },
  { name:"Violet", rgb:[180,110,255] },
  { name:"Green",  rgb:[90,230,170] },
  { name:"Red",    rgb:[255,90,120] },
  { name:"Black",  rgb:[20,25,40] },
  { name:"Pink",   rgb:[255,130,200] },
  { name:"Yellow", rgb:[255,245,120] },
];

let t = 0;
let selected = null;

function rand(a,b){ return a + Math.random()*(b-a); }

const clouds = Array.from({length:90}).map(()=>({
  x: rand(0,W), y: rand(0,H),
  r: rand(120,320),
  v: rand(0.2,1.2),
  p: PALETTE[Math.floor(Math.random()*PALETTE.length)],
  a: rand(0.03,0.10),
}));

function draw() {
  t += 0.012;

  // 背景
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = "rgb(7,10,18)";
  ctx.fillRect(0,0,W,H);

  // 霧（重ね塗り）
  for (const c of clouds) {
    c.x += Math.cos(t * c.v) * 0.6;
    c.y += Math.sin((t+1.7) * c.v) * 0.4;
    if (c.x < -c.r) c.x = W + c.r;
    if (c.x > W + c.r) c.x = -c.r;
    if (c.y < -c.r) c.y = H + c.r;
    if (c.y > H + c.r) c.y = -c.r;

    const [r,g,b] = c.p.rgb;
    const grad = ctx.createRadialGradient(c.x,c.y,0,c.x,c.y,c.r);
    grad.addColorStop(0, `rgba(${r},${g},${b},${c.a})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c.x,c.y,c.r,0,Math.PI*2);
    ctx.fill();
  }

  // 選択表示
  if (selected) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const [r,g,b] = selected.rgb;
    const x = selected.x, y = selected.y;
    for (let i=0;i<6;i++){
      ctx.strokeStyle = `rgba(${r},${g},${b},${0.10 - i*0.012})`;
      ctx.lineWidth = 10 + i*10;
      ctx.beginPath();
      ctx.arc(x,y,40 + i*18,0,Math.PI*2);
      ctx.stroke();
    }
    ctx.restore();
  }

  requestAnimationFrame(draw);
}
draw();

canvas.addEventListener("pointerdown", (e)=>{
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (W / rect.width);
  const y = (e.clientY - rect.top) * (H / rect.height);

  // “掴み”は、近い霧の色を採用（それっぽい）
  let best = null, bestD = 1e9;
  for (const c of clouds) {
    const dx = c.x - x, dy = c.y - y;
    const d = dx*dx + dy*dy;
    if (d < bestD) { bestD = d; best = c.p; }
  }
  selected = { ...best, x, y };

  document.getElementById("hint").textContent = `選択: ${selected.name}`;
  document.getElementById("next").disabled = false;
});

document.getElementById("next").onclick = ()=>{
  // “トップカラー”として保存（後で質問スコアに混ぜる）
  saveState({
    step: "bottle",
    pickedColor: selected.name,
    scores: { [selected.name]: 3 } // 初期ブースト
  });
  location.href = "./bottle.html";
};

document.getElementById("back").onclick = ()=> history.back();

