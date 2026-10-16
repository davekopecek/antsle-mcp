# antsle-mcp

An [MCP](https://modelcontextprotocol.io) server for managing an [antsle](https://antsle.com) server (antMan on edgeLinux / antsleOS) through the antMan REST API.

With it, an AI assistant like Claude Code can list, create, start, stop, snapshot and clone antlets, and inspect templates, networking, backups and the host, by talking to antMan the same way the web UI does.

> **This is a prerelease.** It has been tested against antMan 3.4.4 and was built against antMan API 1.0.0. antsle describes that API as experimental, so behavior may vary between antMan releases.

## Requirements

- Node.js 22 or newer
- An antsle running antMan, reachable from the machine running the server, either at `https://<your-antsle-host>` (your antsle.us address) or on your LAN at `http://<name>.local:3000`
- An antMan username and password

## Install for Claude Code

> **Read-only defaults depend on how you install it.** The Claude Code plugin enables read-only mode by default. Clone and direct `npx` installations are writable unless you set `ANTSLE_READ_ONLY=true`. In read-only mode, write tools are not registered at all.

### Option 1: install as a Claude Code plugin (recommended for Claude Code)

The repo is also a Claude Code plugin marketplace. The plugin bundles the MCP server (run with npx from GitHub) and a skill that teaches Claude how to use it safely. Inside Claude Code:

```
/plugin marketplace add davekopecek/antsle-mcp
/plugin install antsle-mcp@antsle-mcp
```

On Claude Code 2.1.275 or later, one step does both: `/plugin install antsle-mcp --marketplace davekopecek/antsle-mcp`.

When you enable the plugin, Claude Code asks for your antsle URL, username, password and whether to run read-only. Read-only is on by default; turn it off in `/config` when you want the write tools. The password goes to your system's secure credential store, not `settings.json`.

If you already added the server with Option 2 or 3, remove it (`claude mcp remove antsle -s user`) so the tools aren't registered twice.

### Option 2: clone and use a `.env` file (recommended for other MCP clients or local control)

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

### Option 3: run straight from GitHub with npx

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

With Option 2 or 3, add `ANTSLE_READ_ONLY=true` to `.env` or pass `-e ANTSLE_READ_ONLY=true` to try it without write access first. The plugin already starts in read-only mode.

`--scope user` makes the server available in all your projects. Use `--scope project` to share it through a project's `.mcp.json`, or leave the flag off to add it to the current project only.

### Updating

```bash
cd antsle-mcp && git pull && npm install
```

Then restart Claude Code. With Option 3, npx fetches the latest commit when its cache expires. Run `npx clear-npx-cache` to force an update. With Option 1, run `/plugin marketplace update antsle-mcp`; the plugin updates when its version changes.

## Safety guidance for the assistant

The server sends instructions to every MCP client when it connects: read before changing, confirm antlet names and destructive actions with the user, offer a snapshot before risky changes, check dependencies before deleting, prefer stop over force-stop, and leave host-level actions (shutdown, upgrades, network commits) to a human.

The Claude Code plugin adds the `antsle` skill (`skills/antsle/SKILL.md`, invoked as `/antsle-mcp:antsle`, though Claude loads it on its own when you ask about antlets), which expands on those rules with step-by-step workflows for status overviews, cloning, resizing, installing templates and rolling back. To use the skill without the plugin, copy `skills/antsle` into `~/.claude/skills/`.

Read-only mode (`ANTSLE_READ_ONLY=true`) is the hard guarantee: write tools are not registered at all.

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

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTSLE_URL` | yes | none | `https://<your-antsle-host>` or `http://<name>.local:3000` |
| `ANTSLE_USERNAME` / `ANTSLE_PASSWORD` | yes* | none | antMan login. The server gets a JWT from `/api/login` and logs in again when it expires. |
| `ANTSLE_TOKEN` | yes* | none | Alternative to username and password: a token from `/api/login` |
| `ANTSLE_READ_ONLY` | no | `false` | `true` registers only read tools and limits `antsle_api_request` to GET. The Claude Code plugin overrides this to `true` by default. |
| `ANTSLE_ENABLE_RAW_API` | no | `false` | `true` registers `antsle_api_request` |
| `ANTSLE_TIMEOUT_MS` | no | `60000` | Request timeout in ms |
| `ANTSLE_ENV_FILE` | no | package `.env` | Path to a `.env` file somewhere other than the package folder |

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

The antMan API has about 170 operations. Many exist only for the web UI (NPS surveys, billing, demo instances, UI toggles). Host shutdown and restart, antMan and edgeLinux upgrades, network config commits, LDAP, and ADS distributed storage have no dedicated tools and should stay with a human in antMan. The opt-in raw API can technically reach unsupported endpoints in writable mode, but the server's safety instructions tell clients not to use it for these host-level operations. Set `ANTSLE_ENABLE_RAW_API=true` to register `antsle_api_request` for other operations without dedicated tools.

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

Tools live in `src/tools/`, grouped by area. Each tool is a `defineTool(...)` call that maps its arguments onto an antMan endpoint, so adding one is usually a few lines. Add a row for it to the endpoint table in `test/tools.test.ts`.

If you change tool behavior or safety rules, update both `src/instructions.ts` (sent to every MCP client) and `skills/antsle/SKILL.md` (Claude Code) so they stay consistent.

### Testing

```bash
npm run typecheck  # src and tests
npm test           # Vitest unit and protocol tests
```

`npm test` needs no antsle and no network. It stubs `fetch` with a small fake antMan and drives the real server through an in-memory MCP client, checking tool registration, read-only mode, annotations, how each tool maps onto antMan endpoints, and error handling. GitHub Actions runs typecheck, build and tests on Node 22 and 24.

To smoke-test against your own antsle (read-only, uses your `.env`):

```bash
ANTSLE_LIVE_TESTS=true npm run test:live
```

`claude plugin validate .` checks the plugin manifests and the skill.

## License

Copyright © 2026 Dave Kopecek

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. See [LICENSE](LICENSE).

antsle, antMan and edgeLinux are products of antsle, inc. This project is not affiliated with or endorsed by antsle.
