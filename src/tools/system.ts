// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 Dave Kopecek

import { defineTool, type ToolContext } from "./define.js";

export function registerSystemTools(ctx: ToolContext): void {
  const { client } = ctx;

  defineTool(
    ctx,
    "antsle_get_system_info",
    {
      title: "Get system info",
      description: "Get antMan and OS versions, hardware specs, memory usage and ZFS pools in one call.",
      readOnly: true,
    },
    async () => {
      const parts = {
        antmanVersion: "/api/antman-version",
        osVersion: "/api/antsleos-version",
        hardware: "/api/system/hardware",
        memory: "/api/mem",
        zpools: "/api/list-zpools",
      };
      const entries = await Promise.all(
        Object.entries(parts).map(async ([key, path]) => {
          try {
            return [key, await client.get(path)] as const;
          } catch (err) {
            return [key, { error: err instanceof Error ? err.message : String(err) }] as const;
          }
        }),
      );
      return Object.fromEntries(entries);
    },
  );

  defineTool(
    ctx,
    "antsle_list_services",
    {
      title: "List services",
      description: "List system services on the antsle host and their status.",
      readOnly: true,
    },
    () => client.get("/api/system/list-services"),
  );

  defineTool(
    ctx,
    "antsle_list_backups",
    {
      title: "List backups",
      description: "List antlet backups.",
      readOnly: true,
    },
    () => client.get("/api/backups"),
  );

  defineTool(
    ctx,
    "antsle_list_scheduled_backups",
    {
      title: "List scheduled backups",
      description: "List antlets that have daily backups scheduled.",
      readOnly: true,
    },
    () => client.get("/api/backups/get-all-scheduled-backups"),
  );
}
