export const STORE_KEY = "aura_soma_state_v1";


export function basePath() {
  // Cloudflare Pages /aura/ 固定
  return "/aura/";
}

export function go(page) {
  location.href = basePath() + page;
}

// state系（既存があればそのまま残してOK）
export function saveState(obj) {
  localStorage.setItem("aura_state_v1", JSON.stringify(obj));
}

export function loadState() {
  try {
    return JSON.parse(localStorage.getItem("aura_state_v1"));
  } catch {
    return null;
  }
}

export function resetState() {
  localStorage.removeItem("aura_state_v1");
}

// util（既に使っているものがあれば残す）
export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function pickTopColors(scores, n = 2) {
  return Object.entries(scores || {})
    .sort((a, b) => (b[1] || 0) - (a[1] || 0))
    .slice(0, n)
    .map(x => x[0]);
}
