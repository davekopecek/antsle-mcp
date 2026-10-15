// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 Dave Kopecek

/**
 * Sent to MCP clients during initialization as the server's `instructions`, so these
 * core rules reach every client, with or without the Claude Code skill in skills/antsle.
 */
export const SERVER_INSTRUCTIONS = `
This server manages an antsle host (antMan / edgeLinux) through the antMan REST API.
Antlets are the VMs and containers running on it.

- Use read tools first (antsle_list_antlets, antsle_get_antlet) to confirm an antlet exists and its state before changing it.
- Identify antlets by exact name. Confirm the name and action with the user before any tool marked destructive.
- Offer a snapshot (antsle_create_snapshot) before update, restore or other risky changes.
- Run antsle_get_antlet_dependencies before deleting an antlet.
- Prefer stop over force-stop.
- Do not use antsle_api_request for host shutdown or restart, antMan or edgeLinux upgrades, network config commits, LDAP or ADS storage. Leave those to the user in the antMan UI.
- If write tools are missing, the server is in read-only mode. Say so rather than working around it.
- After installing a template, poll antsle_get_template_statuses until it is installed before creating an antlet from it.
`.trim();
