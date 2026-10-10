// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 Dave Kopecek

import { z } from "zod";
import { seg } from "../client.js";
import { defineTool, type ToolContext } from "./define.js";

const TEMPLATE_CATALOG_URL = "http://central.antsle.com/api/templates";

export function registerTemplateTools(ctx: ToolContext): void {
  const { client } = ctx;

  defineTool(
    ctx,
    "antsle_list_templates",
    {
      title: "List installed templates",
      description: "List templates installed on this antsle. These names are what antsle_create_antlet accepts.",
      readOnly: true,
    },
    () => client.get("/api/templates"),
  );

  defineTool(
    ctx,
    "antsle_list_available_templates",
    {
      title: "List available templates",
      description:
        "List templates that can be downloaded and installed from antsle's template repository. " +
        "Pass a template's key to antsle_install_template.",
      readOnly: true,
    },
    async () => {
      try {
        return await client.get("/api/templates/available");
      } catch (err) {
        // antMan 3.4.x answers this endpoint with HTTP 500 "(not (map? nil))", so read antsle's public
        // catalog directly. Its keys are the ones /api/templates-install/{template-key} expects.
        const res = await fetch(TEMPLATE_CATALOG_URL, { signal: AbortSignal.timeout(ctx.config.timeoutMs) });
        if (!res.ok) throw err;
        const catalog = (await res.json()) as Array<Record<string, unknown>>;
        return {
          source: `${TEMPLATE_CATALOG_URL} (antMan's /api/templates/available failed: ${(err as Error).message})`,
          templates: catalog.map(({ key, label, description, "template-size-label": size }) => ({
            key,
            label,
            description,
            size,
          })),
        };
      }
    },
  );

  defineTool(
    ctx,
    "antsle_get_template_statuses",
    {
      title: "Get template install statuses",
      description: "Show download/install progress for templates being installed.",
      readOnly: true,
    },
    () => client.get("/api/templates-statuses"),
  );

  defineTool(
    ctx,
    "antsle_install_template",
    {
      title: "Install template",
      description:
        "Download and install a template from antsle's repository. Runs in the background; check progress with " +
        "antsle_get_template_statuses.",
      input: {
        key: z.string().min(1).describe("Template key from antsle_list_available_templates"),
      },
    },
    ({ key }) => client.post(`/api/templates-install/${seg(key)}`),
  );
}
