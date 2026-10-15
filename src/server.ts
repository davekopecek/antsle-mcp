// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 Dave Kopecek

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AntmanClient } from "./client.js";
import type { Config } from "./config.js";
import { SERVER_INSTRUCTIONS } from "./instructions.js";
import { registerAntletTools } from "./tools/antlets.js";
import type { ToolContext } from "./tools/define.js";
import { registerNetworkTools } from "./tools/network.js";
import { registerRawTool } from "./tools/raw.js";
import { registerSnapshotTools } from "./tools/snapshots.js";
import { registerSystemTools } from "./tools/system.js";
import { registerTemplateTools } from "./tools/templates.js";

export const SERVER_VERSION = "0.1.0";

/** Builds the MCP server with all tools registered. Transport-agnostic, so tests can connect in memory. */
export function createServer(config: Config, client: AntmanClient = new AntmanClient(config)): McpServer {
  const server = new McpServer(
    { name: "antsle-mcp", version: SERVER_VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  );
  const ctx: ToolContext = { server, client, config };

  registerAntletTools(ctx);
  registerSnapshotTools(ctx);
  registerTemplateTools(ctx);
  registerNetworkTools(ctx);
  registerSystemTools(ctx);
  registerRawTool(ctx);

  return server;
}
