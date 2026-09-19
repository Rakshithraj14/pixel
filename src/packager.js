// Packager: zip root contains exactly pet.json +
// spritesheet.webp, under the 5MB limit. Shells out to the system `zip`
// binary (already installed) instead of pulling in a zip library.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const MAX_ZIP_BYTES = 5 * 1024 * 1024;

function packageCharacter(charDir) {
  const zipPath = path.join(charDir, "character.zip");
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

  execFileSync("zip", ["-j", "character.zip", "pet.json", "spritesheet.webp"], { cwd: charDir });

  const size = fs.statSync(zipPath).size;
  if (size > MAX_ZIP_BYTES) {
    throw new Error(`character.zip is ${(size / 1024 / 1024).toFixed(2)}MB, over the ${MAX_ZIP_BYTES / 1024 / 1024}MB limit`);
  }
  return { zipPath, size };
}

module.exports = { packageCharacter };
