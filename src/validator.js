// Validator: hard pass/fail checks instead of
// loose diagnostics, with clear, specific error messages.

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const REQUIRED_TOP_FIELDS = ["id", "displayName", "description", "version", "formatVersion", "sprite", "animations"];
const REQUIRED_SPRITE_FIELDS = ["path", "frameWidth", "frameHeight", "columns", "rows"];

async function checkCells(spritePath, pet, warnings, errors) {
  const { data, info } = await sharp(spritePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { frameWidth: cw, frameHeight: ch, columns, rows } = pet.sprite;
  const usedCols = new Array(rows).fill(0);
  Object.values(pet.animations).forEach((a) => {
    if (Number.isInteger(a.row) && a.row >= 0 && a.row < rows) {
      usedCols[a.row] = Math.max(usedCols[a.row], a.frames || 0);
    }
  });

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      let alphaSum = 0;
      let edgeAlpha = 0;
      for (let y = r * ch; y < (r + 1) * ch; y++) {
        for (let x = c * cw; x < (c + 1) * cw; x++) {
          const a = data[(y * info.width + x) * 4 + 3];
          alphaSum += a;
          if (a >= 8 && (x === c * cw || x === (c + 1) * cw - 1 || y === r * ch || y === (r + 1) * ch - 1)) {
            edgeAlpha++;
          }
        }
      }
      const used = c < usedCols[r];
      if (!used && alphaSum > 0) {
        errors.push(`cell (row ${r}, col ${c}) is unused but not fully transparent`);
      }
      if (used && alphaSum === 0) {
        warnings.push(`cell (row ${r}, col ${c}) is referenced by an animation but is fully empty`);
      }
      if (used && edgeAlpha > 0) {
        warnings.push(`cell (row ${r}, col ${c}) has content touching the cell edge (possible clipping)`);
      }
    }
  }
}

async function validateCharacter(charDir) {
  const errors = [];
  const warnings = [];

  const jsonPath = path.join(charDir, "pet.json");
  if (!fs.existsSync(jsonPath)) {
    errors.push(`pet.json not found at ${jsonPath}`);
    return { valid: false, errors, warnings };
  }

  let pet;
  try {
    pet = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  } catch (e) {
    errors.push(`pet.json is not valid JSON: ${e.message}`);
    return { valid: false, errors, warnings };
  }

  for (const field of REQUIRED_TOP_FIELDS) {
    if (pet[field] === undefined) errors.push(`pet.json missing required field "${field}"`);
  }

  if (pet.sprite) {
    for (const field of REQUIRED_SPRITE_FIELDS) {
      if (pet.sprite[field] === undefined) errors.push(`pet.json sprite missing required field "${field}"`);
    }
    if (pet.sprite.frameWidth <= 0) errors.push("sprite.frameWidth must be > 0");
    if (pet.sprite.frameHeight <= 0) errors.push("sprite.frameHeight must be > 0");
  }

  const spritePath = pet.sprite && pet.sprite.path ? path.join(charDir, pet.sprite.path) : null;
  if (!spritePath || !fs.existsSync(spritePath)) {
    errors.push(`referenced sprite file not found: ${pet.sprite ? pet.sprite.path : "(none)"}`);
    return { valid: errors.length === 0, errors, warnings };
  }

  const meta = await sharp(spritePath).metadata();
  if (meta.format !== "webp") errors.push(`spritesheet must be WebP, found "${meta.format}"`);
  if (!meta.hasAlpha) errors.push("spritesheet must have an alpha channel (RGBA)");

  if (pet.sprite.frameWidth > 0 && pet.sprite.columns > 0) {
    const expectedW = pet.sprite.frameWidth * pet.sprite.columns;
    if (meta.width !== expectedW) {
      errors.push(`spritesheet width ${meta.width} does not match frameWidth*columns (${expectedW})`);
    }
  }
  if (pet.sprite.frameHeight > 0 && pet.sprite.rows > 0) {
    const expectedH = pet.sprite.frameHeight * pet.sprite.rows;
    if (meta.height !== expectedH) {
      errors.push(`spritesheet height ${meta.height} does not match frameHeight*rows (${expectedH})`);
    }
  }

  if (pet.animations) {
    for (const [name, anim] of Object.entries(pet.animations)) {
      if (!Number.isInteger(anim.row) || anim.row < 0 || anim.row >= (pet.sprite.rows || 0)) {
        errors.push(
          `animation "${name}" references row ${anim.row}, but spritesheet only contains ${pet.sprite.rows} rows (0-${pet.sprite.rows - 1})`
        );
      }
      if (!Number.isInteger(anim.frames) || anim.frames < 1 || anim.frames > (pet.sprite.columns || 0)) {
        errors.push(`animation "${name}" has frames=${anim.frames}, but spritesheet only has ${pet.sprite.columns} columns`);
      }
      if (!(anim.fps > 0)) errors.push(`animation "${name}" has invalid fps (${anim.fps}); must be > 0`);
      if (typeof anim.loop !== "boolean") errors.push(`animation "${name}" missing boolean "loop"`);
    }
  }

  if (errors.length === 0 && pet.animations) {
    await checkCells(spritePath, pet, warnings, errors);
  }

  return { valid: errors.length === 0, errors, warnings };
}

module.exports = { validateCharacter };
