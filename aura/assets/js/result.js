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

/* ---------------------------
   結果文：強化パック
   - core: meaningShort
   - explain: meaningLong（subで補強）
   - shadow: 注意点
   - action: 今日の1つ
--------------------------- */

const AURA_TEXT = {
  Blue: {
    core: "外から入ってくる刺激を減らしたい状態です。",
    explain: {
      Gold:   "やることは進めたいのに、頭が先に疲れています。優先順位を「1つ」だけに絞ると戻ります。",
      Violet: "考えと気持ちが同時に動いていて、静かな時間が足りません。人の気配や情報を少し減らすだけで落ち着きます。",
      Green:  "回復力はありますが、回復の時間が短いサインです。休むというより「触るものを減らす」が効きます。",
      Red:    "勢いはあるのに、休むタイミングを逃しています。まずはスピードを落とすだけで十分です。",
      Pink:   "やさしくしたい気持ちが強い分、受け取りすぎています。境界線を1つ引くだけで楽になります。",
      Yellow: "頭の明るさはあるのに、刺激が多すぎて散っています。短時間の集中に切り替えると整います。",
      Black:  "張りつめやすい状態です。静かな場所より「音量を下げる」くらいの調整がちょうどいいです。",
      White:  "きれいに整えたい気持ちが強く出ています。完璧にしなくて大丈夫です。"
    },
    shadow: "説明しようとしすぎて、休む前に疲れやすい。",
    action: "今すぐ「通知を1つだけOFF」にする。"
  },

  Gold: {
    core: "整えて前に進みたい状態です。",
    explain: {
      Blue:   "考えが先行して、手が止まりやすくなっています。まず「1行だけ」着手すると流れます。",
      Violet: "やるべきことと本音がずれているサインです。どちらも否定せず、順番を付けると進めます。",
      Green:  "整えたいのに、体の余力が足りません。小さく整えるほど結果が出ます。",
      Red:    "勢いで進める力があります。衝動で増やしすぎないように、最後に確認を1回だけ。",
      Pink:   "人のために整えがちです。自分の都合を先に置くと、結果が早く出ます。",
      Yellow: "選択肢が多くて散りやすい状態です。条件を1つ減らすと決めやすくなります。",
      Black:  "守りを固めたい気配があります。守る範囲を狭めるほど、心は安定します。",
      White:  "白黒つけたくなりやすい状態です。いまは中間でもOKです。"
    },
    shadow: "「ちゃんとやる」を増やしすぎて、余白が消えやすい。",
    action: "今日やることを「3つ→1つ」に減らす。"
  },

  Violet: {
    core: "本音に近いところが動いている状態です。",
    explain: {
      Blue:   "気持ちを言語化しようとして疲れやすいです。言葉より体感を優先すると落ち着きます。",
      Gold:   "現実を進めたい気持ちと、内側の違和感が同居しています。どちらも正しいので順番を決めればOKです。",
      Green:  "感情は動いていますが回復の余地もあります。優しい調整で十分に戻ります。",
      Red:    "衝動が強まりやすいタイミングです。即決より「10分だけ寝かす」が効きます。",
      Pink:   "共感が強く出ています。人の気持ちと自分の気持ちを分けると楽になります。",
      Yellow: "ひらめきが出やすい反面、散りやすいです。メモに1行だけ残すと形になります。",
      Black:  "強く抱え込みやすい状態です。抱える量を減らすほど深く整います。",
      White:  "「正しくいたい」と「本音」がぶつかりやすいです。今日は本音を小さく尊重でOK。"
    },
    shadow: "感じたことを抱え込んで、外では平気に見せがち。",
    action: "メモ欄に「いま一番気になる一言」だけ書く。"
  },

  Green: {
    core: "回復と調整が必要な状態です。",
    explain: {
      Blue:   "頭で整えようとして回復が遅れています。まず体を戻すほうが早いです。",
      Gold:   "やるべきことはあるのに、余力が足りません。整えるのは明日でも間に合います。",
      Violet: "気持ちの揺れが疲れに直結しています。1人の時間を「短く」入れるだけで戻ります。",
      Red:    "勢いで押し切ると反動が来やすいです。今日はブレーキを少しだけ。",
      Pink:   "やさしさで無理しやすい状態です。断るより「遅らせる」が効きます。",
      Yellow: "頭の回転はあるのに、体が追いついていません。短い休憩を入れると一気に進みます。",
      Black:  "固めすぎて抜けにくい状態です。ほどく方向で整います。",
      White:  "きれいに戻したい気持ちが強いです。完璧より、回復優先でOKです。"
    },
    shadow: "頑張ってる自覚が薄く、限界が来てから気づきやすい。",
    action: "水を一口飲んで、肩を3回ゆっくり回す。"
  },

  // 予備（もし他色がトップに来た時も落ちない）
  Red: {
    core: "動きたい力が強い状態です。",
    explain: {
      Blue: "勢いのまま進むと頭が追いつきません。確認を1回だけ入れると安定します。"
    },
    shadow: "勢いで増やしすぎて後から疲れやすい。",
    action: "次の行動の前に「10秒停止」する。"
  },
  Pink: {
    core: "やさしさと共感が強い状態です。",
    explain: {
      Blue: "受け取る量が多いサインです。距離を少し取ると戻ります。"
    },
    shadow: "相手優先で自分の余白が消えやすい。",
    action: "返信を1件だけ「あとで」にする。"
  },
  Yellow: {
    core: "頭の明るさが出ている状態です。",
    explain: {
      Blue: "考えが散りやすいので、短く区切ると形になります。"
    },
    shadow: "選択肢を増やしすぎて迷いやすい。",
    action: "今やることを「1つ」だけ決める。"
  },
  Black: {
    core: "守りを固めたい状態です。",
    explain: {
      Blue: "緊張が抜けにくいので、少し緩めるほうが進みます。"
    },
    shadow: "全部自分で抱えようとして重くなりやすい。",
    action: "やらないことを1つ決める。"
  },
  White: {
    core: "整っていたい気持ちが強い状態です。",
    explain: {
      Blue: "完璧を求めるほど疲れます。今日は7割で十分です。"
    },
    shadow: "白黒つけたくなって余白が消えやすい。",
    action: "机の上を「1個だけ」片付ける。"
  }
};

function buildResultText(main, sub) {
  const pack = AURA_TEXT[main] || AURA_TEXT.Blue;

  const core = pack.core || "今のあなたは、少し調整が必要な状態です。";

  // subがあるなら優先、無ければ適当に1つ（あるいは空）
  let explain = "";
  if (pack.explain) {
    if (sub && pack.explain[sub]) explain = pack.explain[sub];
    else if (pack.explain.Blue) explain = pack.explain.Blue;
    else {
      const any = Object.values(pack.explain)[0];
      explain = any || "";
    }
  }

  const shadow = pack.shadow || "やりすぎない。";
  const action = pack.action || "深呼吸を1回。";

  return { core, explain, shadow, action };
}

(async function init() {
  try {
    const state = loadState();

    if (statusEl) {
      statusEl.textContent =
        `state:${state ? "OK" : "NULL"} bottle:${state?.bottle ? "OK" : "NG"} scores:${state?.scores ? "OK" : "NG"}`;
    }

    if (!state || !state.bottle || !state.scores) {
      go("index.html");
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

    // 結果文（強化）
    const { core, explain, shadow, action } = buildResultText(main, sub);
    if (meaningShortEl) meaningShortEl.textContent = core;
    if (meaningLongEl) meaningLongEl.textContent = explain || "いまは結果を急がず、体感として受け取る段階です。";
    if (shadowEl) shadowEl.textContent = shadow;
    if (actionEl) actionEl.textContent = action;

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
