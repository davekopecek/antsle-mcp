// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 Dave Kopecek
//
// Downloads the antMan API spec from your antsle to spec/antman-swagger.json (gitignored),
// as a local reference for the endpoint descriptions when adding tools.
// Usage: npm run fetch-spec   (reads ANTSLE_URL from the environment or .env)

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: resolve(root, ".env"), quiet: true });

const baseUrl = process.env.ANTSLE_URL?.trim().replace(/\/+$/, "");
if (!baseUrl) {
  console.error("Set ANTSLE_URL (in .env or the environment), e.g. https://<your-antsle-host>");
  process.exit(1);
}

const res = await fetch(`${baseUrl}/swagger.json`);
if (!res.ok) {
  console.error(`GET ${baseUrl}/swagger.json failed with HTTP ${res.status}`);
  process.exit(1);
}
const spec = await res.json();

const out = resolve(root, "spec/antman-swagger.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(spec, null, 2) + "\n");

const ops = Object.values(spec.paths ?? {}).reduce(
  (n, ops) => n + Object.keys(ops).filter((m) => m !== "parameters").length,
  0,
);
console.log(`Saved ${spec.info?.title ?? "spec"} ${spec.info?.version ?? ""} (${ops} operations) to ${out}`);
