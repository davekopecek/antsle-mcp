// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 Dave Kopecek

// Read-only smoke tests against a real antsle. Never run in CI.
// Run with: ANTSLE_LIVE_TESTS=true npm run test:live   (uses your .env)
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";
import { connect, text } from "../helpers.js";

const live = process.env.ANTSLE_LIVE_TESTS === "true";

describe.runIf(live)("live antsle (read-only)", () => {
  it("lists antlets and reads system info", async () => {
    // Force read-only so a live run can never change anything.
    const mcp = await connect({ ...loadConfig(), readOnly: true, enableRawApi: false });
    for (const name of ["antsle_list_antlets", "antsle_list_templates", "antsle_get_system_info"]) {
      const result = await mcp.client.callTool({ name, arguments: {} });
      expect(result.isError, `${name}: ${text(result)}`).toBeFalsy();
    }
    await mcp.close();
  }, 60_000);
});
