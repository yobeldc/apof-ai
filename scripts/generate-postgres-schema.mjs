#!/usr/bin/env node
/**
 * Derives `prisma/schema.production.prisma` (PostgreSQL) from the single
 * source of truth `prisma/schema.prisma` (SQLite, used for local dev).
 *
 * Prisma requires the datasource `provider` to be a static string literal, so
 * one schema file cannot target both databases. Rather than hand-maintaining
 * two ~300-line copies of the same models (drift risk), this script swaps only
 * the `datasource` block and writes the rest byte-for-byte identical.
 *
 * Run automatically before production `generate`/`migrate deploy`:
 *   node scripts/generate-postgres-schema.mjs
 *
 * The output file IS committed (needed so `prisma migrate dev`/`diff` and CI
 * have a stable target), but this script is the source of truth — if you
 * change models, edit prisma/schema.prisma and re-run this script.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(__dirname, "..", "prisma", "schema.prisma");
const destPath = path.join(__dirname, "..", "prisma", "schema.production.prisma");

const src = readFileSync(srcPath, "utf8");

const HEADER = `// AUTO-GENERATED from prisma/schema.prisma by scripts/generate-postgres-schema.mjs.
// Do NOT hand-edit — edit prisma/schema.prisma (the models) instead, then re-run:
//   node scripts/generate-postgres-schema.mjs
// This is the PostgreSQL-targeting schema used for production (Docker build,
// \`prisma migrate deploy\`). Local development continues to use the plain
// prisma/schema.prisma (SQLite, zero-setup).
`;

const datasourceRe = /datasource\s+db\s*\{[^}]*\}/;
if (!datasourceRe.test(src)) {
  console.error("Could not find a `datasource db { ... }` block in prisma/schema.prisma");
  process.exit(1);
}

const withHeader = src.replace(/^\/\/[^\n]*\n(\/\/[^\n]*\n)*/, ""); // drop the sqlite-specific header comment
const swapped = withHeader.replace(
  datasourceRe,
  `datasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}`,
);

writeFileSync(destPath, HEADER + "\n" + swapped, "utf8");
console.log(`Wrote ${path.relative(process.cwd(), destPath)} (provider: postgresql)`);
