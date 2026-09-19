// Background removal.
//
// codex-pets' original approach special-cased green/magenta/checkerboard
// with five separate pixel classifiers and fell through to a no-op for any
// other flat color (exactly what broke on a taupe reference sheet). This
// replaces all of that with one generalized flood fill: sample the actual
// corner color, then grow the background region from the border by distance
// from that color, which handles solid colors and chroma screens alike
// without color-specific heuristics. A distance-based alpha ramp (instead of
// a hard cutoff) keeps anti-aliased edges from fringing.
//
// ponytail: checkerboard "fake transparency" backgrounds aren't handled —
// a single sampled color can't represent an alternating pattern. Add a
// checkerboard-specific detector if/when a source image needs it.

const sharp = require("sharp");

const GLOBAL_TOLERANCE = 40;
const ALPHA_EXISTING_THRESHOLD = 0.2; // fraction of pixels already transparent

function dist(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function averageCorners(data, w, h) {
  const corners = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ];
  let r = 0, g = 0, b = 0;
  for (const [x, y] of corners) {
    const i = (y * w + x) * 4;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  return { r: r / 4, g: g / 4, b: b / 4 };
}

function hasExistingAlpha(data, total) {
  let transparent = 0;
  for (let p = 0; p < total; p++) {
    if (data[p * 4 + 3] < 245) transparent++;
  }
  return transparent / total > ALPHA_EXISTING_THRESHOLD;
}

// Flood-fills the background starting from the border and writes an alpha
// channel: 0 for pixels matching the sampled background color, ramping up
// toward the original alpha for pixels that are only a partial match
// (anti-aliased edges), and untouched for anything outside the region.
async function removeBackground(sourcePath, outFile) {
  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const total = w * h;

  if (hasExistingAlpha(data, total)) {
    // Already has real transparency — just snap near-transparent pixels to
    // fully transparent so downstream component detection doesn't pick up
    // faint noise.
    for (let p = 0; p < total; p++) {
      const i = p * 4;
      if (data[i + 3] < 12) {
        data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0;
      }
    }
    await sharp(data, { raw: info }).png().toFile(outFile);
    return { width: w, height: h, mode: "alpha" };
  }

  const bg = averageCorners(data, w, h);
  const seen = new Uint8Array(total);
  const queue = [];

  const seed = (x, y) => {
    const p = y * w + x;
    const i = p * 4;
    if (dist(data[i], data[i + 1], data[i + 2], bg.r, bg.g, bg.b) < GLOBAL_TOLERANCE) {
      seen[p] = 1;
      queue.push(p);
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x, 0);
    seed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    seed(0, y);
    seed(w - 1, y);
  }

  const tryEnqueue = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const p = y * w + x;
    if (seen[p]) return;
    const i = p * 4;
    if (dist(data[i], data[i + 1], data[i + 2], bg.r, bg.g, bg.b) >= GLOBAL_TOLERANCE) return;
    seen[p] = 1;
    queue.push(p);
  };
  for (let q = 0; q < queue.length; q++) {
    const p = queue[q];
    const x = p % w;
    const y = Math.floor(p / w);
    tryEnqueue(x + 1, y);
    tryEnqueue(x - 1, y);
    tryEnqueue(x, y + 1);
    tryEnqueue(x, y - 1);
  }

  // Only the outer edge of the tolerance band gets a soft ramp (true
  // anti-aliased blend pixels); ordinary background variation within the
  // inner band goes fully transparent, so natural noise in a "flat" area
  // doesn't leave faint opaque bridges that reconnect components.
  const RAMP_INNER_FRACTION = 0.5;
  const innerBound = GLOBAL_TOLERANCE * RAMP_INNER_FRACTION;
  for (let p = 0; p < total; p++) {
    if (!seen[p]) continue;
    const i = p * 4;
    const d = dist(data[i], data[i + 1], data[i + 2], bg.r, bg.g, bg.b);
    const alpha = d <= innerBound ? 0 : Math.min(255, Math.round(((d - innerBound) / (GLOBAL_TOLERANCE - innerBound)) * 255));
    data[i + 3] = alpha;
    if (alpha === 0) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
    }
  }

  await sharp(data, { raw: info }).png().toFile(outFile);
  return { width: w, height: h, mode: "flat", backgroundColor: bg };
}

module.exports = { removeBackground };
