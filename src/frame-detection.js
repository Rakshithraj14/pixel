// Frame detection (roadmap.md §10-12): alpha-connected components, grouped
// into source rows by vertical position, sorted left-to-right within a row.
// Ported from codex-pets' build_codex_pet_atlas.js, which already got this
// part right, plus a basic aspect-ratio guard to reject stray artifacts
// (text/watermark slivers, disconnected shadow lines) per §11.

const sharp = require("sharp");

const MIN_SIZE = 24;
const MIN_PIXELS = 1000;
const MAX_ASPECT_RATIO = 6; // reject slivers wider/taller than this ratio

function rect(x, y, w, h) {
  return { left: Math.round(x), top: Math.round(y), width: Math.round(w), height: Math.round(h) };
}

async function findComponents(transparentSourcePath) {
  const { data, info } = await sharp(transparentSourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const seen = new Uint8Array(w * h);
  const components = [];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const alpha = (idx) => data[idx * 4 + 3];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (seen[idx] || alpha(idx) < 20) continue;
      const stack = [idx];
      seen[idx] = 1;
      let minx = x, maxx = x, miny = y, maxy = y, count = 0;

      while (stack.length) {
        const p = stack.pop();
        count++;
        const px = p % w;
        const py = Math.floor(p / w);
        if (px < minx) minx = px;
        if (px > maxx) maxx = px;
        if (py < miny) miny = py;
        if (py > maxy) maxy = py;
        for (const [dx, dy] of dirs) {
          const nx = px + dx;
          const ny = py + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const ni = ny * w + nx;
          if (!seen[ni] && alpha(ni) >= 20) {
            seen[ni] = 1;
            stack.push(ni);
          }
        }
      }

      if (count < MIN_PIXELS) continue;
      const width = maxx - minx + 1;
      const height = maxy - miny + 1;
      if (width < MIN_SIZE || height < MIN_SIZE) continue;
      const aspect = Math.max(width / height, height / width);
      if (aspect > MAX_ASPECT_RATIO) continue; // likely a text/watermark sliver
      components.push(rect(minx, miny, width, height));
    }
  }

  return components.sort((a, b) => a.top - b.top || a.left - b.left);
}

function centerY(c) {
  return c.top + c.height / 2;
}

function groupIntoRows(components) {
  const sorted = components.slice().sort((a, b) => centerY(a) - centerY(b) || a.left - b.left);
  const groups = [];
  const rowGap = 80;

  for (const c of sorted) {
    const cy = centerY(c);
    const prev = groups[groups.length - 1];
    if (!prev || cy - prev.centerY > rowGap) {
      groups.push({ centerY: cy, items: [c] });
    } else {
      prev.items.push(c);
      prev.centerY = prev.items.reduce((sum, i) => sum + centerY(i), 0) / prev.items.length;
    }
  }

  return groups.map((g) => g.items.slice().sort((a, b) => a.left - b.left));
}

module.exports = { findComponents, groupIntoRows };
