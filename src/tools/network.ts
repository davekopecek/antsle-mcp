// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 Dave Kopecek

import { z } from "zod";
import { seg } from "../client.js";
import { defineTool, type ToolContext } from "./define.js";

export function registerNetworkTools(ctx: ToolContext): void {
  const { client } = ctx;

  defineTool(
    ctx,
    "antsle_list_vlans",
    {
      title: "List vLANs",
      description: "List virtual LANs configured on the antsle.",
      readOnly: true,
    },
    () => client.get("/api/network/vlans"),
  );

  defineTool(
    ctx,
    "antsle_get_vlan_antlets",
    {
      title: "List antlets on a vLAN",
      description: "List the antlets and vNICs connected to a vLAN.",
      input: { vlan: z.string().min(1).describe("vLAN name") },
      readOnly: true,
    },
    ({ vlan }) => client.get(`/api/network/vlans/${seg(vlan)}/antlets`),
  );

  defineTool(
    ctx,
    "antsle_list_port_forwards",
    {
      title: "List port forwarding rules",
      description: "List port forwarding rules that map antsle host ports to antlet ports.",
      readOnly: true,
    },
    () => client.get("/api/pf-rules"),
  );

  defineTool(
    ctx,
    "antsle_list_load_balancer_rules",
    {
      title: "List load balancing rules",
      description: "List load balancing (reverse proxy) rules that route domains to antlets.",
      readOnly: true,
    },
    () => client.get("/api/lb-rules"),
  );
}
