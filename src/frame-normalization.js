// Frame normalization. codex-pets scaled and centered every
// frame independently against its own bounding box, which lets characters
// drift in size and bounce vertically between frames. This module instead:
//   1. crops each source component tight (trim transparent padding)
//   2. scales every frame in a row toward the row's MEDIAN height, so an
//      odd detection glitch doesn't shrink/grow the character (§15)
//   3. places frames using a shared baseline (bottom-aligned) for standing
//      poses, or center alignment for poses like sleeping where "feet at
//      the bottom" isn't meaningful (§14, §16)

const sharp = require("sharp");

const SCALE_CLAMP = [0.7, 1.3]; // don't let a bad detection wildly distort a frame
const BASELINE_MARGIN_FRACTION = 0.06;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function median(nums) {
  const sorted = nums.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Crops `rect` out of `sourcePath` (with a small padding margin, clamped to
// the actual image bounds) and trims transparent padding.
async function extractFrame(sourcePath, cropRect, imageMeta) {
  const pad = 8;
  const left = Math.max(0, Math.min(imageMeta.width - 1, cropRect.left - pad));
  const top = Math.max(0, Math.min(imageMeta.height - 1, cropRect.top - pad));
  const right = Math.max(left + 1, Math.min(imageMeta.width, cropRect.left + cropRect.width + pad));
  const bottom = Math.max(top + 1, Math.min(imageMeta.height, cropRect.top + cropRect.height + pad));
  const padded = { left, top, width: right - left, height: bottom - top };
  const extracted = await sharp(sourcePath).extract(padded).png().toBuffer();
  return sharp(extracted).trim({ background: "#00000000" }).png().toBuffer();
}

// Scales every frame in a row toward the row's median height, clamped so a
// single bad detection can't distort a frame too far.
async function normalizeRowScale(frameBuffers, kernel) {
  const metas = await Promise.all(frameBuffers.map((b) => sharp(b).metadata()));
  const refHeight = median(metas.map((m) => m.height));

  return Promise.all(
    frameBuffers.map(async (buf, i) => {
      const scale = clamp(refHeight / metas[i].height, SCALE_CLAMP[0], SCALE_CLAMP[1]);
      const width = Math.max(1, Math.round(metas[i].width * scale));
      const height = Math.max(1, Math.round(metas[i].height * scale));
      const resized = await sharp(buf).resize(width, height, { fit: "fill", kernel }).png().toBuffer();
      return { buffer: resized, width, height };
    })
  );
}

// Returns {left, top} placement for a normalized frame inside a cell.
function placeInCell(frame, cellWidth, cellHeight, alignment) {
  const left = Math.max(0, Math.round((cellWidth - frame.width) / 2));
  if (alignment === "center") {
    return { left, top: Math.max(0, Math.round((cellHeight - frame.height) / 2)) };
  }
  const marginBottom = Math.round(cellHeight * BASELINE_MARGIN_FRACTION);
  const top = Math.max(0, cellHeight - marginBottom - frame.height);
  return { left, top };
}

module.exports = { extractFrame, normalizeRowScale, placeInCell, median };
