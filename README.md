# antsle-mcp

An [MCP](https://modelcontextprotocol.io) server for managing an [antsle](https://antsle.com) server (antMan on edgeLinux / antsleOS) through the antMan REST API.

With it, an AI assistant like Claude Code can list, create, start, stop, snapshot and clone antlets, and inspect templates, networking, backups and the host, by talking to antMan the same way the web UI does.

> antsle describes the antMan REST API as experimental, so it may change between antMan releases. This server was built against antMan API 1.0.0.

## Requirements

- Node.js 20 or newer
- An antsle running antMan, reachable from the machine running the server, either at `https://<your-antsle-host>` (your antsle.us address) or on your LAN at `http://<name>.local:3000`
- An antMan username and password

## Install for Claude Code

### Option 1: clone and use a `.env` file (recommended)

Keeps your credentials in a local `.env` file instead of in your Claude Code config.

```bash
git clone https://github.com/davekopecek/antsle-mcp.git
cd antsle-mcp
npm install                      # also builds dist/

cp .env.example .env
chmod 600 .env
$EDITOR .env                     # set ANTSLE_URL, ANTSLE_USERNAME, ANTSLE_PASSWORD

claude mcp add antsle --scope user -- node "$(pwd)/dist/index.js"
```

The server reads `.env` from its own folder, so it works wherever Claude Code launches it.

### Option 2: run straight from GitHub with npx

No clone. npm installs and builds the package on first run, and you pass the credentials as environment variables:

```bash
claude mcp add antsle --scope user \
  -e ANTSLE_URL=https://<your-antsle-host> \
  -e ANTSLE_USERNAME=<username> \
  -e ANTSLE_PASSWORD='<password>' \
  -- npx -y github:davekopecek/antsle-mcp
```

Claude Code stores these values in plain text in `~/.claude.json`.

### Check it

```bash
claude mcp list          # antsle should show as connected
```

Inside Claude Code, run `/mcp` to see the server and its tools, then ask something like "list my antlets".

To try it without write access first, add `ANTSLE_READ_ONLY=true` to `.env`, or pass `-e ANTSLE_READ_ONLY=true`.

`--scope user` makes the server available in all your projects. Use `--scope project` to share it through a project's `.mcp.json`, or leave the flag off to add it to the current project only.

### Updating

```bash
cd antsle-mcp && git pull && npm install
```

Then restart Claude Code. With Option 2, npx fetches the latest commit when its cache expires. Run `npx clear-npx-cache` to force an update.

## Other MCP clients

Any stdio MCP client works. For example, in Claude Desktop's `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "antsle": {
      "command": "node",
      "args": ["/path/to/antsle-mcp/dist/index.js"]
    }
  }
}
```

With a `.env` file in the clone, no `env` block is needed. Otherwise add `"env": { "ANTSLE_URL": "...", ... }`.

## Configuration

Set these in `.env` (copy `.env.example`) or as environment variables from your MCP client. Variables from the client override `.env`.

| Variable | Required | Description |
|---|---|---|
| `ANTSLE_URL` | yes | `https://<your-antsle-host>` or `http://<name>.local:3000` |
| `ANTSLE_USERNAME` / `ANTSLE_PASSWORD` | yes* | antMan login. The server gets a JWT from `/api/login` and logs in again when it expires. |
| `ANTSLE_TOKEN` | yes* | Alternative to username and password: a token from `/api/login` |
| `ANTSLE_READ_ONLY` | no | `true` registers only read tools and limits `antsle_api_request` to GET |
| `ANTSLE_ENABLE_RAW_API` | no | `true` registers `antsle_api_request` |
| `ANTSLE_TIMEOUT_MS` | no | Request timeout in ms, default `60000` |
| `ANTSLE_ENV_FILE` | no | Path to a `.env` file somewhere other than the package folder |

\* Either username and password, or a token.

## Tools

| Tool | What it does | Changes things? |
|---|---|---|
| `antsle_list_antlets` | All antlets with state, IP, RAM, CPU | |
| `antsle_get_antlet` | Details for one antlet | |
| `antsle_get_antlet_state` | Current power state | |
| `antsle_set_antlet_state` | start, stop, force-stop, reboot, pause, resume | yes, destructive |
| `antsle_create_antlet` | Create an antlet from an installed template | yes |
| `antsle_update_antlet` | Change RAM, CPU, description, autostart, ZFS quota | yes |
| `antsle_clone_antlet` | New antlet from another antlet's snapshot | yes |
| `antsle_delete_antlet` | Delete an antlet (optionally forced) | yes, destructive |
| `antsle_get_antlet_dependencies` | What depends on an antlet | |
| `antsle_list_vnics` / `antsle_list_vdisks` | An antlet's network interfaces / disks | |
| `antsle_list_snapshots` | Snapshots for an antlet | |
| `antsle_create_snapshot` | Take a snapshot | yes |
| `antsle_restore_snapshot` | Roll an antlet back to a snapshot | yes, destructive |
| `antsle_delete_snapshot` | Delete a snapshot | yes, destructive |
| `antsle_list_templates` | Installed templates | |
| `antsle_list_available_templates` | Templates available to install | |
| `antsle_get_template_statuses` | Template download/install progress | |
| `antsle_install_template` | Install a template from antsle's repository | yes |
| `antsle_list_vlans` / `antsle_get_vlan_antlets` | vLANs and their members | |
| `antsle_list_port_forwards` | Port forwarding rules | |
| `antsle_list_load_balancer_rules` | Load balancing (domain routing) rules | |
| `antsle_get_system_info` | antMan/OS versions, hardware, memory, ZFS pools | |
| `antsle_list_services` | Host services | |
| `antsle_list_backups` / `antsle_list_scheduled_backups` | Backups | |
| `antsle_api_request` | Raw call to any antMan endpoint (opt-in) | depends |

Tools that change things are marked with MCP `destructiveHint` / `readOnlyHint` annotations, so clients can ask before running them.

### What's not covered

The antMan API has about 170 operations. Many exist only for the web UI (NPS surveys, billing, demo instances, UI toggles). Others are host-level actions that should stay with a human: shutdown and restart, antMan and edgeLinux upgrades, network config commits, LDAP, and ADS distributed storage. Set `ANTSLE_ENABLE_RAW_API=true` to reach any of them through `antsle_api_request`.

## antMan API reference

Every antsle serves its own API documentation:

- Spec: `https://<your-antsle-host>/swagger.json`
- Interactive UI: `https://<your-antsle-host>/swagger-ui/index.html`

`npm run fetch-spec` saves your antsle's spec to `spec/antman-swagger.json` (gitignored), which is handy when adding tools.

## Development

```bash
npm install
npm run dev        # tsc --watch
npm run inspect    # MCP Inspector against dist/index.js
```

Tools live in `src/tools/`, grouped by area. Each tool is a `defineTool(...)` call that maps its arguments onto an antMan endpoint, so adding one is usually a few lines.

## License

Copyright © 2026 Dave Kopecek

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. See [LICENSE](LICENSE).

antsle, antMan and edgeLinux are products of antsle, inc. This project is not affiliated with or endorsed by antsle.
