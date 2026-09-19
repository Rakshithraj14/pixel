// Orchestrates Phases 2-5: source PNG -> background removal -> frame
// detection -> normalization -> atlas -> pet.json -> preview -> validation.

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const { removeBackground } = require("./background-removal");
const { findComponents, groupIntoRows } = require("./frame-detection");
const { extractFrame, normalizeRowScale } = require("./frame-normalization");
const { buildAtlas } = require("./atlas-builder");
const { generatePetJson } = require("./json-generator");
const { renderPreview } = require("./preview-image");
const { validateCharacter } = require("./validator");
const { resolveRowMap, alignmentFor } = require("./animation-map");

async function processCharacter(opts) {
  const {
    source,
    outDir,
    id,
    displayName,
    description,
    rowMap,
    clarity = "pixel",
    fps = {},
    personality = {},
  } = opts;

  const charDir = path.join(outDir, id);
  const sourceDir = path.join(charDir, "source");
  fs.mkdirSync(sourceDir, { recursive: true });

  const savedSource = path.join(sourceDir, "source.png");
  await sharp(source).png().toFile(savedSource);

  const transparentPath = path.join(charDir, ".transparent-source.png");
  await removeBackground(savedSource, transparentPath);

  const components = await findComponents(transparentPath);
  if (components.length === 0) {
    throw new Error("No usable poses detected in source image after background removal");
  }
  const sourceRows = groupIntoRows(components);
  const animationNames = resolveRowMap(rowMap, sourceRows.length);
  if (animationNames.length === 0) {
    throw new Error("Could not map any detected source rows to animations");
  }

  const kernel = clarity === "crisp" ? sharp.kernel.lanczos3 : sharp.kernel.nearest;
  const transparentMeta = await sharp(transparentPath).metadata();

  const rows = [];
  for (let i = 0; i < animationNames.length; i++) {
    const name = animationNames[i];
    const rects = sourceRows[i];
    const rawFrames = await Promise.all(rects.map((r) => extractFrame(transparentPath, r, transparentMeta)));
    const frames = await normalizeRowScale(rawFrames, kernel);
    rows.push({ name, alignment: alignmentFor(name), frames, fps: fps[name], loop: undefined });
  }

  const atlasPngPath = path.join(charDir, "spritesheet.png");
  const atlasWebpPath = path.join(charDir, "spritesheet.webp");
  const layout = await buildAtlas(rows, atlasPngPath, atlasWebpPath);

  const pet = generatePetJson({ id, displayName, description, layout, rows, personality });
  fs.writeFileSync(path.join(charDir, "pet.json"), JSON.stringify(pet, null, 2) + "\n");

  const previewPath = path.join(charDir, "preview.png");
  await renderPreview(atlasPngPath, rows, layout, previewPath);

  fs.unlinkSync(transparentPath);

  const validation = await validateCharacter(charDir);

  return {
    charDir,
    pet,
    layout,
    sourceRowCount: sourceRows.length,
    animationNames,
    validation,
  };
}

module.exports = { processCharacter };
