// preview.png: a labeled contact sheet of the atlas, so a
// human can eyeball each animation row without decoding pet.json by hand.

const sharp = require("sharp");

const GUTTER = 110;
const BACKDROP = { r: 32, g: 32, b: 30, alpha: 255 };

async function renderPreview(atlasPngPath, rows, layout, outPath) {
  const meta = await sharp(atlasPngPath).metadata();

  const labels = rows
    .map((row, i) => {
      const y = i * layout.cellHeight + layout.cellHeight / 2 + 5;
      return `<text x="8" y="${y}" font-family="monospace" font-size="16" fill="#e5e5e5">${row.name}</text>`;
    })
    .join("\n");
  const svg = `<svg width="${GUTTER}" height="${meta.height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#20201e"/>
    ${labels}
  </svg>`;
  const labelImage = await sharp(Buffer.from(svg)).png().toBuffer();

  const canvas = await sharp({
    create: { width: GUTTER + meta.width, height: meta.height, channels: 4, background: BACKDROP },
  })
    .png()
    .toBuffer();

  await sharp(canvas)
    .composite([
      { input: labelImage, left: 0, top: 0 },
      { input: atlasPngPath, left: GUTTER, top: 0 },
    ])
    .png()
    .toFile(outPath);
}

module.exports = { renderPreview };
