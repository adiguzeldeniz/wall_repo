cat > app.js <<'JS'
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

ctx.fillStyle = "#000";
ctx.fillRect(0,0,canvas.width,canvas.height);

ctx.fillStyle = "#ff2a2a";
ctx.font = "80px monospace";
ctx.textBaseline = "middle";
ctx.fillText("HELLO", 60, canvas.height/2);
JS
