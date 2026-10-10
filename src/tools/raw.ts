// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 Dave Kopecek

import { z } from "zod";
import type { HttpMethod } from "../client.js";
import { defineTool, type ToolContext } from "./define.js";

// GET endpoints in antMan that power-cycle the host or antMan itself. Blocked in read-only mode.
const HOST_POWER_PATHS = ["/api/antsle-shutdown", "/api/antsle-restart", "/api/antman-restart"];

/**
 * Raw passthrough to any antMan endpoint, for operations without a dedicated tool.
 * Only registered when ANTSLE_ENABLE_RAW_API is set. The full API is described at
 * https://<your-antsle-host>/swagger.json (npm run fetch-spec saves a local copy).
 */
export function registerRawTool(ctx: ToolContext): void {
  if (!ctx.config.enableRawApi) return;
  const { client, config } = ctx;

  defineTool(
    ctx,
    "antsle_api_request",
    {
      title: "Raw antMan API request",
      description:
        "Call any antMan REST endpoint directly, for operations without a dedicated tool (vNIC/vDisk/vLAN changes, " +
        "port forwarding rules, backups, etc.). Paths start with /api/. Prefer the dedicated antsle_* tools when one fits." +
        (config.readOnly ? " Read-only mode: only GET is allowed." : ""),
      input: {
        method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
        path: z.string().regex(/^\/api\//, "Path must start with /api/").describe("e.g. /api/antlets/myantlet/vnics"),
        body: z.unknown().optional().describe("JSON request body, if the endpoint takes one"),
      },
      // Registered even in read-only mode, but restricted to GET there.
      readOnly: config.readOnly,
      destructive: true,
    },
    async ({ method, path, body }) => {
      if (config.readOnly) {
        if (method !== "GET") throw new Error("ANTSLE_READ_ONLY is set; only GET requests are allowed");
        if (HOST_POWER_PATHS.some((p) => path.split("?")[0] === p)) {
          throw new Error(`${path} restarts or shuts down the host and is blocked in read-only mode`);
        }
      }
      return client.request(method as HttpMethod, path, body);
    },
  );
}
