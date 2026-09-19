#!/usr/bin/env node
// Phase 6 (scoped to this repo, no DeskForge changes): a local static
// server + animated preview page, so you can see every animation actually
// play before manually copying pet.json/spritesheet.webp into DeskForge.
// Uses the same background-position-stepping technique DeskForge's own
// overlay.js uses, generalized to a grid atlas (steps both column and row).

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.argv[3]) || 4173;
const characterId = process.argv[2];

if (!characterId) {
  console.error("Usage: node preview-server.js <character-id> [port]");
  process.exit(1);
}

const charDir = path.join(__dirname, "characters", characterId);
if (!fs.existsSync(path.join(charDir, "pet.json"))) {
  console.error(`No pet.json found in ${charDir}`);
  process.exit(1);
}

const MIME = { ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".html": "text/html" };

const INDEX_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Pet preview</title>
<style>
  body { background: #1c1c1a; color: #eee; font-family: monospace; display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 32px; }
  #stage { width: 240px; height: 240px; display: flex; align-items: center; justify-content: center; background: repeating-conic-gradient(#2a2a28 0% 25%, #232321 0% 50%) 50% / 20px 20px; }
  #sprite { image-rendering: pixelated; }
  #buttons { display: flex; gap: 8px; flex-wrap: wrap; }
  button { background: #333; color: #eee; border: 1px solid #555; padding: 6px 12px; cursor: pointer; font-family: monospace; }
  button.active { background: #567; }
</style>
</head>
<body>
  <h2 id="title">Loading...</h2>
  <div id="stage"><div id="sprite"></div></div>
  <div id="buttons"></div>
<script>
async function main() {
  const pet = await (await fetch('pet.json')).json();
  document.getElementById('title').textContent = pet.displayName + ' (' + pet.id + ')';
  const sprite = document.getElementById('sprite');
  const { frameWidth, frameHeight, columns, rows } = pet.sprite;
  const displayScale = Math.min(3, Math.floor(200 / Math.max(frameWidth, frameHeight))) || 1;
  sprite.style.width = (frameWidth * displayScale) + 'px';
  sprite.style.height = (frameHeight * displayScale) + 'px';
  sprite.style.backgroundImage = 'url(' + pet.sprite.path + ')';
  sprite.style.backgroundSize = (frameWidth * columns * displayScale) + 'px ' + (frameHeight * rows * displayScale) + 'px';

  let timer = null;
  function play(name) {
    document.querySelectorAll('#buttons button').forEach(b => b.classList.toggle('active', b.dataset.name === name));
    const anim = pet.animations[name];
    if (timer) clearInterval(timer);
    let frame = 0;
    const step = () => {
      sprite.style.backgroundPosition = '-' + (frame * frameWidth * displayScale) + 'px -' + (anim.row * frameHeight * displayScale) + 'px';
      frame = anim.loop ? (frame + 1) % anim.frames : Math.min(frame + 1, anim.frames - 1);
    };
    step();
    timer = setInterval(step, 1000 / anim.fps);
  }

  const buttons = document.getElementById('buttons');
  Object.keys(pet.animations).forEach((name, i) => {
    const b = document.createElement('button');
    b.textContent = name;
    b.dataset.name = name;
    b.onclick = () => play(name);
    buttons.appendChild(b);
    if (i === 0) play(name);
  });
}
main();
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const reqPath = req.url === "/" ? "/index.html" : req.url;
  if (reqPath === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(INDEX_HTML);
    return;
  }
  const filePath = path.join(charDir, decodeURIComponent(reqPath));
  if (!filePath.startsWith(charDir) || !fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Preview: http://localhost:${PORT}/`);
});
