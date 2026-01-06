// app.js (Pi-optimized)

const BG = "#000";
const FG = "#ff2a2a";
const FONT_FAMILY = `'Space Mono', monospace`;
const FONT_SIZE = 56;          // tune
const SPEED = 140;             // px/sec
const PAUSE_MS = 700;          // pause between sentences
const FPS_CAP = 30;            // big win on Pi

// IMPORTANT: force DPR=1 to avoid 4K-ish rendering on high-DPI displays
const DPR = 1;

async function loadSentences() {
  const resp = await fetch("./sentences.txt", { cache: "no-store" });
  const text = await resp.text();
  return text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

function makeTextSprite(ctx, text) {
  // render once to an offscreen canvas
  ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
  const padX = 24;
  const padY = 18;
  const w = Math.ceil(ctx.measureText(text).width + padX * 2);
  const h = Math.ceil(FONT_SIZE + padY * 2);

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;

  const g = c.getContext("2d", { alpha: true, desynchronized: true });
  g.clearRect(0, 0, w, h);
  g.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
  g.textBaseline = "middle";
  g.fillStyle = FG;

  // no shadows / glow (too expensive on Pi). If you want glow later, we can add a cheap fake.
  g.fillText(text, padX, h / 2);

  return { canvas: c, w, h, text };
}

function resizeCanvas(canvas, ctx) {
  const w = Math.floor(window.innerWidth * DPR);
  const h = Math.floor(window.innerHeight * DPR);
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return { w, h };
}

function fillBG(ctx, w, h) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);
}

(async function main() {
  const canvas = document.getElementById("c");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", {
    alpha: false,
    desynchronized: true,
  });

  const sentences = await loadSentences();
  if (!sentences.length) return;

  // Prepare sprites
  ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
  const sprites = sentences.map(s => makeTextSprite(ctx, s));

  let { w: W, h: H } = resizeCanvas(canvas, ctx);
  window.addEventListener("resize", () => {
    ({ w: W, h: H } = resizeCanvas(canvas, ctx));
  });

  let i = 0;
  let sprite = sprites[i];

  let x = W; // start offscreen right
  let y = Math.floor(H * 0.50 - sprite.h * 0.5);

  let pauseUntil = 0;
  let last = performance.now();

  const frameMinDt = 1000 / FPS_CAP;

  function nextSentence() {
    i = (i + 1) % sprites.length;
    sprite = sprites[i];
    x = W;
    y = Math.floor(H * 0.50 - sprite.h * 0.5);
  }

  function loop(now) {
    const dt = now - last;

    // cap FPS
    if (dt < frameMinDt) {
      requestAnimationFrame(loop);
      return;
    }
    last = now;

    fillBG(ctx, W, H);

    if (now < pauseUntil) {
      // just draw current sprite, no movement
      ctx.drawImage(sprite.canvas, x, y);
      requestAnimationFrame(loop);
      return;
    }

    x -= (SPEED * dt) / 1000;

    // draw
    ctx.drawImage(sprite.canvas, x, y);

    // when fully off-screen left, pause then switch
    if (x + sprite.w < 0) {
      pauseUntil = now + PAUSE_MS;
      nextSentence();
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
