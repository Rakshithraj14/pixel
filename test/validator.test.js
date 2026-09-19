const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const sharp = require("sharp");
const { validateCharacter } = require("../src/validator");

async function makeValidCharacter(dir) {
  // Frames smaller than their cell (with a transparent margin) — matches
  // what the real atlas builder produces, and avoids a real sharp/libwebp
  // quirk: a fully-opaque image (zero transparent pixels) gets its alpha
  // channel stripped by the WebP encoder as an optimization.
  const frameWidth = 8;
  const frameHeight = 8;
  const columns = 2;
  const rows = 1;
  const red = await sharp({ create: { width: 4, height: 4, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 255 } } }).png().toBuffer();
  const green = await sharp({ create: { width: 4, height: 4, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 255 } } }).png().toBuffer();

  await sharp({ create: { width: frameWidth * columns, height: frameHeight * rows, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: red, left: 2, top: 2 },
      { input: green, left: frameWidth + 2, top: 2 },
    ])
    .webp({ lossless: true })
    .toFile(path.join(dir, "spritesheet.webp"));

  const pet = {
    id: "test-pet",
    displayName: "Test Pet",
    description: "x",
    version: "1.0.0",
    formatVersion: 1,
    sprite: { path: "spritesheet.webp", frameWidth, frameHeight, columns, rows },
    animations: { idle: { row: 0, frames: 2, fps: 5, loop: true } },
  };
  fs.writeFileSync(path.join(dir, "pet.json"), JSON.stringify(pet, null, 2));
  return pet;
}

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pet-"));
}

test("validateCharacter: passes a well-formed character", async () => {
  const dir = tmpDir();
  await makeValidCharacter(dir);
  const result = await validateCharacter(dir);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("validateCharacter: catches an animation row out of range", async () => {
  const dir = tmpDir();
  const pet = await makeValidCharacter(dir);
  pet.animations.idle.row = 8;
  fs.writeFileSync(path.join(dir, "pet.json"), JSON.stringify(pet, null, 2));
  const result = await validateCharacter(dir);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("references row 8")));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("validateCharacter: catches frames exceeding columns", async () => {
  const dir = tmpDir();
  const pet = await makeValidCharacter(dir);
  pet.animations.idle.frames = 5;
  fs.writeFileSync(path.join(dir, "pet.json"), JSON.stringify(pet, null, 2));
  const result = await validateCharacter(dir);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("frames=5")));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("validateCharacter: missing pet.json fails clearly", async () => {
  const dir = tmpDir();
  const result = await validateCharacter(dir);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("pet.json not found")));
  fs.rmSync(dir, { recursive: true, force: true });
});
