// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 Dave Kopecek

import { z } from "zod";
import { seg } from "../client.js";
import { antletName, defineTool, type ToolContext } from "./define.js";

const snapshotName = z.string().min(1).describe("Snapshot name, as shown by antsle_list_snapshots");

export function registerSnapshotTools(ctx: ToolContext): void {
  const { client } = ctx;

  defineTool(
    ctx,
    "antsle_list_snapshots",
    {
      title: "List snapshots",
      description: "List ZFS snapshots for an antlet, with creation time and space used.",
      input: { antlet: antletName },
      readOnly: true,
    },
    ({ antlet }) => client.get(`/api/antlets/${seg(antlet)}/snapshots`),
  );

  defineTool(
    ctx,
    "antsle_create_snapshot",
    {
      title: "Create snapshot",
      description: "Take a ZFS snapshot of an antlet.",
      input: {
        antlet: antletName,
        name: z.string().min(1).describe("Name for the new snapshot"),
      },
    },
    ({ antlet, name }) => client.post(`/api/antlets/${seg(antlet)}`, { name }),
  );

  defineTool(
    ctx,
    "antsle_restore_snapshot",
    {
      title: "Restore snapshot",
      description:
        "Roll an antlet back to a snapshot, discarding changes made since. The antlet should be shut down first " +
        "and started again afterwards.",
      input: { antlet: antletName, snapshot: snapshotName },
      destructive: true,
    },
    ({ antlet, snapshot }) => client.post(`/api/antlets/${seg(antlet)}/snapshots/restore/${seg(snapshot)}`),
  );

  defineTool(
    ctx,
    "antsle_delete_snapshot",
    {
      title: "Delete snapshot",
      description: "Permanently delete one snapshot of an antlet.",
      input: { antlet: antletName, snapshot: snapshotName },
      destructive: true,
    },
    ({ antlet, snapshot }) => client.delete(`/api/antlets/${seg(antlet)}/snapshots/${seg(snapshot)}`),
  );
}
