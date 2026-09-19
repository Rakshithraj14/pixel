// Atlas builder (roadmap.md §6, §17-18): composites normalized frames onto
// a single grid, per-character cell size (not a hardcoded global grid, per
// §6's recommendation), and exports a lossless WebP.

const sharp = require("sharp");
const { placeInCell } = require("./frame-normalization");

async function normalizeTransparentPixels(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
    }
  }
  await sharp(data, { raw: info }).png().toFile(file);
}

// rows: [{ name, alignment, frames: [{buffer, width, height}] }]
async function buildAtlas(rows, outPngPath, outWebpPath) {
  let maxW = 0;
  let maxH = 0;
  for (const row of rows) {
    for (const f of row.frames) {
      maxW = Math.max(maxW, f.width);
      maxH = Math.max(maxH, f.height);
    }
  }
  const cellWidth = maxW + Math.round(maxW * 0.12);
  const cellHeight = maxH + Math.round(maxH * 0.12);
  const columns = Math.max(...rows.map((r) => r.frames.length));
  const rowCount = rows.length;
  const atlasWidth = cellWidth * columns;
  const atlasHeight = cellHeight * rowCount;

  const blank = await sharp({
    create: { width: atlasWidth, height: atlasHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .png()
    .toBuffer();

  const overlays = [];
  rows.forEach((row, rowIndex) => {
    row.frames.forEach((frame, col) => {
      const { left, top } = placeInCell(frame, cellWidth, cellHeight, row.alignment);
      overlays.push({ input: frame.buffer, left: col * cellWidth + left, top: rowIndex * cellHeight + top });
    });
  });

  await sharp(blank).composite(overlays).png().toFile(outPngPath);
  await normalizeTransparentPixels(outPngPath);
  await sharp(outPngPath).webp({ lossless: true, quality: 100 }).toFile(outWebpPath);

  return { atlasWidth, atlasHeight, cellWidth, cellHeight, columns, rows: rowCount };
}

module.exports = { buildAtlas };
