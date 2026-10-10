// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 Dave Kopecek

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

export interface Config {
  baseUrl: string;
  username?: string;
  password?: string;
  token?: string;
  readOnly: boolean;
  enableRawApi: boolean;
  timeoutMs: number;
}

function flag(name: string): boolean {
  return ["1", "true", "yes", "on"].includes((process.env[name] ?? "").trim().toLowerCase());
}

/**
 * Loads ANTSLE_* variables from a .env file. MCP clients start the server from an arbitrary
 * working directory, so the file is looked up next to the package (or at ANTSLE_ENV_FILE),
 * not in the cwd. Variables already set by the client take precedence over the file.
 */
function loadEnvFile(): void {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const path = process.env.ANTSLE_ENV_FILE ?? resolve(packageRoot, ".env");
  if (!existsSync(path)) return;
  // quiet: dotenv otherwise logs to stdout, which is the MCP stdio channel.
  const result = dotenv.config({ path, quiet: true });
  if (result.error) throw new Error(`Could not read ${path}: ${result.error.message}`);
}

export function loadConfig(): Config {
  loadEnvFile();

  const baseUrl = process.env.ANTSLE_URL?.trim();
  if (!baseUrl) {
    throw new Error("ANTSLE_URL is required, e.g. https://myantsle.antsle.us or http://myantsle.local:3000");
  }

  const username = process.env.ANTSLE_USERNAME?.trim() || undefined;
  const password = process.env.ANTSLE_PASSWORD || undefined;
  const token = process.env.ANTSLE_TOKEN?.trim() || undefined;
  if (!token && !(username && password)) {
    throw new Error("Set ANTSLE_USERNAME and ANTSLE_PASSWORD, or ANTSLE_TOKEN");
  }

  const timeoutMs = Number(process.env.ANTSLE_TIMEOUT_MS ?? 60000);

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    username,
    password,
    token,
    readOnly: flag("ANTSLE_READ_ONLY"),
    enableRawApi: flag("ANTSLE_ENABLE_RAW_API"),
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 60000,
  };
}
