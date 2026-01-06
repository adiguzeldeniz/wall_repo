const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const BG = "#000";
const FG = "#ff2a2a";

let W = 0, H = 0;
let FONT_SIZE = 64;
const FONT_FAMILY = "monospace";
const SPEED = 140; // px/s

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
  FONT_SIZE = Math.max(28, Math.round(H * 0.08));
}
window.addEventListener("resize", resize);
resize();

function setFont() {
  ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
  ctx.textBaseline = "middle";
}

async function loadSentences() {
  const r = await fetch("./sentences.txt", { cache: "no-store" });
  if (!r.ok) throw new Error(`sentences.txt fetch failed: ${r.status}`);
  const t = await r.text();
  const lines = t.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  return lines.length ? lines : ["(sentences.txt empty)"];
}

let sentences = ["loading…"];
let idx = 0;
let text = sentences[0];
let x = 0;
let textW = 0;

function pick(i) {
  setFont();
  text = sentences[i % sentences.length];
  textW = ctx.measureText(text).width;
  x = W + 20;
}

let last = performance.now();
function frame(now) {
  const dt = (now - last) / 1000;
  last = now;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  setFont();
  ctx.fillStyle = FG;

  x -= SPEED * dt;
  if (x < -textW) {
    idx = (idx + 1) % sentences.length;
    pick(idx);
  }

  ctx.fillText(text, x, H / 2);
  requestAnimationFrame(frame);
}

(async () => {
  try {
    sentences = await loadSentences();
  } catch (e) {
    sentences = [`(error) ${e.message}`];
  }
  idx = 0;
  pick(idx);
  requestAnimationFrame(frame);
})();
