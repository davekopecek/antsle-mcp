// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 Dave Kopecek

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { AntmanError, type AntmanClient } from "../client.js";
import type { Config } from "../config.js";

export interface ToolContext {
  server: McpServer;
  client: AntmanClient;
  config: Config;
}

interface ToolSpec<S extends z.ZodRawShape> {
  title: string;
  description: string;
  input?: S;
  /** Tool only reads state. Read-only tools are the only ones registered when ANTSLE_READ_ONLY is set. */
  readOnly?: boolean;
  /** Tool can destroy data or interrupt running antlets. */
  destructive?: boolean;
}

function render(data: unknown): string {
  if (data === null || data === undefined) return "OK (empty response)";
  return typeof data === "string" ? data : JSON.stringify(data, null, 2);
}

function errorResult(err: unknown): CallToolResult {
  let text: string;
  if (err instanceof AntmanError) {
    text = `${err.message}\n${render(err.body)}`;
    // antMan's Clojure backend reports a missing antlet, snapshot, etc. as a 500 with this error.
    if (JSON.stringify(err.body ?? "").includes("(not (map? nil))")) {
      text += "\nantMan returns this error when the named item does not exist. Check the name with a list tool.";
    }
  } else if (err instanceof Error) {
    text = err.name === "TimeoutError" ? `Request timed out: ${err.message}` : err.message;
    // fetch() reports network failures as "fetch failed" with the real reason (ECONNREFUSED, DNS, TLS) in cause.
    if (err.cause instanceof Error) text += `: ${err.cause.message}`;
  } else {
    text = String(err);
  }
  return { content: [{ type: "text", text }], isError: true };
}

/**
 * Registers a tool whose handler returns raw API data. The data is rendered as JSON text,
 * and errors (including antMan's {success:false, errors, message} bodies) become isError results.
 */
export function defineTool<S extends z.ZodRawShape>(
  ctx: ToolContext,
  name: string,
  spec: ToolSpec<S>,
  run: (args: z.infer<z.ZodObject<S>>) => Promise<unknown>,
): void {
  const readOnly = spec.readOnly ?? false;
  if (ctx.config.readOnly && !readOnly) return;

  ctx.server.registerTool(
    name,
    {
      title: spec.title,
      description: spec.description,
      inputSchema: spec.input ?? ({} as S),
      annotations: {
        title: spec.title,
        readOnlyHint: readOnly,
        destructiveHint: readOnly ? false : (spec.destructive ?? false),
        openWorldHint: false,
      },
    },
    (async (args: z.infer<z.ZodObject<S>>): Promise<CallToolResult> => {
      try {
        return { content: [{ type: "text", text: render(await run(args)) }] };
      } catch (err) {
        return errorResult(err);
      }
    }) as Parameters<McpServer["registerTool"]>[2],
  );
}

export const antletName = z.string().min(1).describe("Antlet name (dname), as shown by antsle_list_antlets");
