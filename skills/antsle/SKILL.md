---
name: antsle
description: Use when the user asks about their antsle, antMan, edgeLinux or antlets (their homelab VMs and containers) - listing, starting, stopping, creating, cloning, resizing or deleting antlets, snapshots, templates, vLANs, port forwards, backups or host status. Use the antsle MCP tools instead of SSH or guessing.
---

# Working with an antsle through the antsle MCP

The `antsle` MCP server talks to antMan's REST API, the same API the web UI uses. Prefer its tools over SSH, the web UI or shell commands for anything antlet-related.

## When to use it

- Any question about antlets: what exists, what's running, IPs, RAM/CPU, disks, network interfaces
- Lifecycle changes: start, stop, reboot, create, clone, resize, delete
- Snapshots, templates, vLANs, port forwards, load balancer rules, backups
- Host health: antMan/OS versions, memory, ZFS pools, services

If the antsle tools are missing, say so and point the user to `/mcp` rather than falling back to SSH.

## Ground rules

1. **Look before you change.** Start with read tools (`antsle_list_antlets`, `antsle_get_antlet`, `antsle_get_antlet_state`) to confirm the antlet exists and what state it is in.
2. **Refer to antlets by name, confirm by name.** Before any change, restate the antlet name, the action and the expected result, and wait for a clear yes. Never act on a name you inferred or partially matched.
3. **Snapshot before risky changes.** Before `antsle_update_antlet`, `antsle_restore_snapshot` or anything that alters disks or config, offer to take a snapshot with `antsle_create_snapshot` and name it descriptively (e.g. `pre-resize-2026-10-15`).
4. **Destructive tools need explicit confirmation every time:** `antsle_delete_antlet`, `antsle_delete_snapshot`, `antsle_restore_snapshot`, and `antsle_set_antlet_state` with stop, force-stop or reboot. Approval for one does not carry over to the next.
5. **Check dependencies before deleting.** Run `antsle_get_antlet_dependencies` first and report anything that depends on the antlet.
6. **Prefer graceful over forced.** Use `stop` before `force-stop`, and only force-stop if the user agrees after a stop fails.
7. **Leave host-level actions to the human.** Do not use `antsle_api_request` for host shutdown or restart, antMan or edgeLinux upgrades, network config commits, LDAP or ADS storage. Explain what the user would do in the antMan UI instead.
8. **Read-only mode is a feature.** If write tools are missing, the server is in read-only mode. Tell the user rather than working around it with `antsle_api_request`.

## Common workflows

### Status overview
`antsle_list_antlets` → summarize as a short table (name, state, IP, RAM, CPU). Add `antsle_get_system_info` if the user asks about host health or capacity.

### Clone an antlet for testing
1. `antsle_list_snapshots` on the source; if there is no recent snapshot, offer to create one.
2. Confirm the new antlet's name.
3. `antsle_clone_antlet` from the chosen snapshot.
4. `antsle_set_antlet_state` → start, then `antsle_get_antlet` to report its IP.

### Resize (RAM/CPU)
1. `antsle_get_antlet` for current values and state.
2. Offer a snapshot.
3. `antsle_update_antlet` with the new values; tell the user if a restart is needed for the change to apply, and confirm before rebooting.

### Install a template, then create from it
1. `antsle_list_available_templates` → confirm which one.
2. `antsle_install_template`.
3. Poll `antsle_get_template_statuses` until it reports installed (don't create an antlet before then).
4. `antsle_create_antlet` from the installed template.

### Roll back
1. `antsle_list_snapshots` → confirm the exact snapshot with the user.
2. Offer a fresh snapshot of the current state first, since a restore discards it.
3. `antsle_restore_snapshot`.

## Reporting back

After any change, re-read the antlet's state and report what changed in one or two lines. If a call fails, show the error from antMan plainly; don't retry destructive calls automatically.
