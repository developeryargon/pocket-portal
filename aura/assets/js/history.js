import { saveState, go } from "./common.js";

const KEY = "aura_soma_history_v1";
const statusEl = document.getElementById("status");
const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");

function topColors(scores, n = 2) {
  return Object.entries(scores || {})
    .map(([k, v]) => [k, Number(v) || 0])
    .sort((a, b) => b[1] - a[1])
    .filter(x => x[1] > 0)
    .slice(0, n)
    .map(x => x[0]);
}


function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

function saveHistory(arr) {
  localStorage.setItem(KEY, JSON.stringify(arr));
}

function fmt(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function downloadText(name, text, mime = "application/json") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function toCSV(items) {
  const headers = ["ts","mode","mainColor","subColor","bottle_id","bottle_name","top_color","bottom_color","memo","scores_json"];
  const rows = items.map(it => {
    const b = it.bottle || {};
    const vals = [
      it.ts,
      it.mode || "",
      it.mainColor || "",
      it.subColor || "",
      b.bottle_id || "",
      b.name || "",
      b.top_color || "",
      b.bottom_color || "",
      (it.memo || "").replace(/\r?\n/g, " ").slice(0, 200),
      JSON.stringify(it.scores || {}).replace(/"/g, '""')
    ];
    return vals.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function openItem(index) {
  const arr = loadHistory();
  const it = arr[index];
  if (!it) return;

  // result が描画できる最低限を state に再注入
  saveState({
    step: "result",
    bottle: it.bottle || null,
    scores: it.scores || {},
    answeredAt: it.ts,
  });

  // ✅ 常に /aura/result.html
  go("result.html");
}

function deleteItem(index) {
  const arr = loadHistory();
  if (!arr[index]) return;
  arr.splice(index, 1);
  saveHistory(arr);
  if (statusEl) statusEl.textContent = "削除しました";
  render();
}

function render() {
  const arr = loadHistory();
  listEl.innerHTML = "";
  emptyEl.style.display = arr.length ? "none" : "block";

  arr.forEach((it, idx) => {
    const b = it.bottle || {};
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
        <div>
          ${(() => {
  const b = it.bottle || {};
  const t = (it.mainColor || it.subColor)
    ? [it.mainColor || "", it.subColor || ""]
    : topColors(it.scores, 2);
  const main = t[0] || b.top_color || "—";
  const sub  = t[1] || b.bottom_color || "—";
  return `<div style="font-weight:900;font-size:16px">${main} / ${sub}</div>`;
})()}
          <div class="small" style="margin-top:4px">${fmt(it.ts)} / モード: ${it.mode || "—"}</div>
          <div class="small" style="margin-top:6px">
            ボトル: ${(b.name || "—")} ${(b.bottle_id ? `(${b.bottle_id})` : "")}<br>
            色: ${(b.top_color || "—")} / ${(b.bottom_color || "—")}
          </div>
          ${it.memo ? `<div class="small" style="margin-top:8px">メモ: ${escapeHtml(it.memo).replace(/\n/g,"<br>")}</div>` : ""}
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;min-width:170px">
          <button class="btn" data-act="open" data-idx="${idx}">これを開く</button>
          <button class="btn" data-act="delete" data-idx="${idx}">削除</button>
        </div>
      </div>
    `;
    listEl.appendChild(div);
  });

  // イベント委譲
  listEl.querySelectorAll("button[data-act]").forEach(btn => {
    btn.onclick = () => {
      const act = btn.getAttribute("data-act");
      const i = Number(btn.getAttribute("data-idx"));
      if (act === "open") openItem(i);
      if (act === "delete") deleteItem(i);
    };
  });
}

// ---- 上部ボタン：全部 go() に統一 ----
document.getElementById("goResult").onclick = () => go("result.html");
document.getElementById("goStart").onclick  = () => go("index.html");

document.getElementById("clearAll").onclick = () => {
  if (!confirm("履歴をすべて削除します。よろしいですか？")) return;
  localStorage.removeItem(KEY);
  if (statusEl) statusEl.textContent = "全削除しました";
  render();
};

document.getElementById("exportJson").onclick = () => {
  const arr = loadHistory();
  downloadText(`aura_history_${Date.now()}.json`, JSON.stringify(arr, null, 2), "application/json");
  if (statusEl) statusEl.textContent = "JSONを書き出しました";
};

document.getElementById("exportCsv").onclick = () => {
  const arr = loadHistory();
  const csv = toCSV(arr);
  downloadText(`aura_history_${Date.now()}.csv`, csv, "text/csv");
  if (statusEl) statusEl.textContent = "CSVを書き出しました";
};

render();

