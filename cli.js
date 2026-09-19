#!/usr/bin/env node
// CLI entrypoint: process / validate / package subcommands.

const path = require("path");
const { processCharacter } = require("./src/pipeline");
const { validateCharacter } = require("./src/validator");
const { packageCharacter } = require("./src/packager");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  if (command === "process") {
    if (!args.source || !args["pet-id"]) {
      throw new Error(
        "Usage: node cli.js process --source <img> --pet-id <id> --display-name <name> --description <text> [--row-map idle,walk,sleep,...] [--clarity pixel|crisp]"
      );
    }
    const result = await processCharacter({
      source: args.source,
      outDir: args["out-dir"] || "characters",
      id: args["pet-id"],
      displayName: args["display-name"] || args["pet-id"],
      description: args.description || "A custom DeskForge pet.",
      rowMap: args["row-map"],
      clarity: args.clarity === "crisp" ? "crisp" : "pixel",
    });
    console.log(JSON.stringify({
      charDir: result.charDir,
      sourceRowCount: result.sourceRowCount,
      animations: result.animationNames,
      layout: result.layout,
      valid: result.validation.valid,
      errors: result.validation.errors,
      warnings: result.validation.warnings,
    }, null, 2));
    if (!result.validation.valid) process.exitCode = 1;
    return;
  }

  if (command === "validate") {
    const dir = rest[0];
    if (!dir) throw new Error("Usage: node cli.js validate <character-dir>");
    const result = await validateCharacter(path.resolve(dir));
    console.log(JSON.stringify(result, null, 2));
    if (!result.valid) process.exitCode = 1;
    return;
  }

  if (command === "package") {
    const dir = rest[0];
    if (!dir) throw new Error("Usage: node cli.js package <character-dir>");
    const validation = await validateCharacter(path.resolve(dir));
    if (!validation.valid) {
      console.error(JSON.stringify(validation, null, 2));
      throw new Error("Refusing to package an invalid character (see errors above)");
    }
    const result = packageCharacter(path.resolve(dir));
    console.log(JSON.stringify({ zipPath: result.zipPath, sizeKB: Math.round(result.size / 1024) }, null, 2));
    return;
  }

  throw new Error('Usage: node cli.js <process|validate|package> ...');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
