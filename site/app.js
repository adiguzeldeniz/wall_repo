cat > site/app.js <<'JS'
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha: false });

const BG = "#000";
const FG = "#ff2a2a";
const FONT_FAMILY = "monospace";
let FONT_SIZE = 44;
const SPEED = 120; // px/s

let W = 0, H = 0, DPR = 1;

function resize() {
  DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  W = Math.floor(window.innerWidth * DPR);
  H = Math.floor(window.innerHeight * DPR);
  canvas.width = W;
  canvas.height = H;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(DPR, DPR);
  // adapt font a bit for different screens
  FONT_SIZE = Math.max(28, Math.round(window.innerHeight * 0.06));
}
window.addEventListener("resize", resize);
resize();

async function loadSentences() {
  const r = await fetch("./sentences.txt", { cache: "no-store" });
  const t = await r.text();
  return t.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

function measure(text) {
  ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
  return ctx.measureText(text).width;
}

function drawText(text, x, y) {
  ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
  ctx.fillStyle = FG;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

let sentences = [];
let i = 0;
let x = 0;
let current = "";
let currentW = 0;

function nextSentence() {
  current = sentences[i % sentences.length];
  i += 1;
  currentW = measure(current);
  x = window.innerWidth + 20; // start off right (CSS pixels)
}

let last = performance.now();

function frame(now) {
  const dt = (now - last) / 1000;
  last = now;

  // clear
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  // update position
  x -= SPEED * dt;

  // draw centered vertically
  drawText(current, x, window.innerHeight * 0.5);

  // loop
  if (x + currentW < -20) nextSentence();

  requestAnimationFrame(frame);
}

(async () => {
  sentences = await loadSentences();
  if (!sentences.length) sentences = ["(sentences.txt empty)"];
  nextSentence();
  requestAnimationFrame(frame);
})();
JS
