// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 Dave Kopecek

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["test/live/**/*.test.ts"] },
});
