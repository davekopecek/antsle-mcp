// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 Dave Kopecek

import { z } from "zod";
import { seg } from "../client.js";
import { antletName, defineTool, type ToolContext } from "./define.js";

const STATE_ACTIONS = ["start", "stop", "force-stop", "reboot", "pause", "resume"] as const;

export function registerAntletTools(ctx: ToolContext): void {
  const { client } = ctx;

  defineTool(
    ctx,
    "antsle_list_antlets",
    {
      title: "List antlets",
      description: "List all antlets (VMs and containers) with their state, IP, RAM, CPU, template and storage use.",
      readOnly: true,
    },
    () => client.get("/api/antlets"),
  );

  defineTool(
    ctx,
    "antsle_get_antlet",
    {
      title: "Get antlet",
      description: "Get full details for one antlet.",
      input: { name: antletName },
      readOnly: true,
    },
    ({ name }) => client.get(`/api/antlets/${seg(name)}`),
  );

  defineTool(
    ctx,
    "antsle_get_antlet_state",
    {
      title: "Get antlet state",
      description: "Get the current power state of an antlet (e.g. running, shutdown, paused).",
      input: { name: antletName },
      readOnly: true,
    },
    ({ name }) => client.get(`/api/antlets/${seg(name)}/state`),
  );

  defineTool(
    ctx,
    "antsle_set_antlet_state",
    {
      title: "Change antlet state",
      description:
        "Start, stop, force-stop, reboot, pause or resume an antlet. The antlet must be in a valid state for the " +
        "action (e.g. shut down before start). force-stop is a hard power-off.",
      input: {
        name: antletName,
        action: z.enum(STATE_ACTIONS),
      },
      destructive: true,
    },
    ({ name, action }) => client.post(`/api/antlets/${seg(name)}/state`, { action }),
  );

  defineTool(
    ctx,
    "antsle_create_antlet",
    {
      title: "Create antlet",
      description:
        "Create a new antlet from an installed template. Use antsle_list_templates to find template names " +
        "(e.g. 'Fedora.lxc'). Omitted optional values are chosen by antMan.",
      input: {
        name: z.string().min(1).describe("Name (dname) for the new antlet"),
        template: z.string().min(1).describe("Installed template name, e.g. 'Fedora.lxc'"),
        ram: z.number().int().positive().describe("RAM in MB, e.g. 1024"),
        cpu: z.number().int().positive().describe("Number of CPU cores"),
        antletNum: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Antlet number; determines the private IP (e.g. 33 -> 10.1.1.33)"),
        zpoolName: z.string().optional().describe("ZFS pool to create the antlet in, e.g. 'antlets'"),
        // antMan rejects creates without compression, although the spec does not mark it required.
        compression: z.string().default("off").describe("ZFS compression: 'off' (antMan's default) or 'lz4'"),
      },
    },
    ({ name, template, ram, cpu, antletNum, zpoolName, compression }) =>
      client.post("/api/antlets", {
        dname: name,
        template,
        ram,
        cpu,
        compression,
        ...(antletNum !== undefined && { "antlet-num": antletNum }),
        ...(zpoolName !== undefined && { "zpool-name": zpoolName }),
      }),
  );

  defineTool(
    ctx,
    "antsle_update_antlet",
    {
      title: "Update antlet",
      description:
        "Change an antlet's RAM, CPU, description, autostart or ZFS quota. Only the given fields change. " +
        "RAM and CPU changes usually need a restart of the antlet to take effect.",
      input: {
        name: antletName,
        ram: z.number().int().positive().optional().describe("RAM in MB"),
        cpu: z.number().int().positive().optional().describe("Number of CPU cores"),
        description: z.string().optional(),
        autostart: z.boolean().optional().describe("Start the antlet when the antsle boots"),
        zfsQuota: z.number().int().nonnegative().optional().describe("ZFS quota, in the units antMan reports"),
      },
    },
    async ({ name, ram, cpu, description, autostart, zfsQuota }) => {
      // PUT requires dname, ram and cpu, so fill unchanged values from the current antlet.
      const current = await client.get<Record<string, unknown>>(`/api/antlets/${seg(name)}`);
      return client.put(`/api/antlets/${seg(name)}`, {
        dname: name,
        ram: ram ?? current.ram,
        cpu: cpu ?? current.cpu,
        ...(description !== undefined && { description }),
        ...(autostart !== undefined && { autostart }),
        ...(zfsQuota !== undefined && { "zfs-quota": zfsQuota }),
      });
    },
  );

  defineTool(
    ctx,
    "antsle_clone_antlet",
    {
      title: "Clone antlet",
      description: "Create a new antlet from a snapshot of an existing antlet. Use antsle_list_snapshots to pick a snapshot.",
      input: {
        source: antletName.describe("Antlet to clone from"),
        snapshot: z.string().min(1).describe("Snapshot of the source antlet to clone"),
        name: z.string().min(1).describe("Name (dname) for the new antlet"),
        antletNum: z.number().int().positive().describe("Antlet number for the new antlet; determines its private IP"),
        zpoolName: z.string().default("antlets").describe("ZFS pool for the new antlet"),
        compression: z.string().default("off").describe("ZFS compression for the new antlet: 'off' or 'lz4'"),
      },
    },
    ({ source, snapshot, name, antletNum, zpoolName, compression }) =>
      client.post("/api/antlets/clone", {
        "src-antlet": { dname: source, "snapshot-name": snapshot },
        "dst-antlet": { dname: name, "antlet-num": antletNum, "zpool-name": zpoolName, compression },
      }),
  );

  defineTool(
    ctx,
    "antsle_delete_antlet",
    {
      title: "Delete antlet",
      description:
        "Permanently delete an antlet and its storage. Without force, antMan refuses if the antlet is running " +
        "or has dependents (see antsle_get_antlet_dependencies). This cannot be undone.",
      input: {
        name: antletName,
        force: z.boolean().default(false).describe("Use antMan's force-delete endpoint"),
      },
      destructive: true,
    },
    ({ name, force }) => client.delete(force ? `/api/antlets/force/${seg(name)}` : `/api/antlets/${seg(name)}`),
  );

  defineTool(
    ctx,
    "antsle_get_antlet_dependencies",
    {
      title: "Get antlet dependencies",
      description: "List what depends on an antlet (e.g. clones or templates made from its snapshots).",
      input: { name: antletName },
      readOnly: true,
    },
    ({ name }) => client.get(`/api/antlets/${seg(name)}/dependencies`),
  );

  defineTool(
    ctx,
    "antsle_list_vnics",
    {
      title: "List antlet vNICs",
      description: "List an antlet's virtual network interfaces (MAC address, model, bridge/source).",
      input: { name: antletName },
      readOnly: true,
    },
    ({ name }) => client.get(`/api/antlets/${seg(name)}/vnics`),
  );

  defineTool(
    ctx,
    "antsle_list_vdisks",
    {
      title: "List antlet vDisks",
      description: "List an antlet's virtual disks with size, bus and pool.",
      input: { name: antletName },
      readOnly: true,
    },
    ({ name }) => client.get(`/api/antlets/${seg(name)}/vdisks`),
  );
}
