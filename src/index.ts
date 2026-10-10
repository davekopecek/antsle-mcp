#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 Dave Kopecek
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AntmanClient } from "./client.js";
import { loadConfig } from "./config.js";
import { registerAntletTools } from "./tools/antlets.js";
import type { ToolContext } from "./tools/define.js";
import { registerNetworkTools } from "./tools/network.js";
import { registerRawTool } from "./tools/raw.js";
import { registerSnapshotTools } from "./tools/snapshots.js";
import { registerSystemTools } from "./tools/system.js";
import { registerTemplateTools } from "./tools/templates.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const server = new McpServer({ name: "antsle-mcp", version: "0.1.0" });
  const ctx: ToolContext = { server, client: new AntmanClient(config), config };

  registerAntletTools(ctx);
  registerSnapshotTools(ctx);
  registerTemplateTools(ctx);
  registerNetworkTools(ctx);
  registerSystemTools(ctx);
  registerRawTool(ctx);

  await server.connect(new StdioServerTransport());
  console.error(`antsle-mcp connected to ${config.baseUrl}${config.readOnly ? " (read-only)" : ""}`);
}

main().catch((err) => {
  console.error(`antsle-mcp failed to start: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
