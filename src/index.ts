#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 Dave Kopecek
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const server = createServer(config);

  await server.connect(new StdioServerTransport());
  console.error(`antsle-mcp connected to ${config.baseUrl}${config.readOnly ? " (read-only)" : ""}`);
}

main().catch((err) => {
  console.error(`antsle-mcp failed to start: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
