// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 Dave Kopecek

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Live tests against a real antsle are opt-in: ANTSLE_LIVE_TESTS=true npm run test:live
    exclude: ["test/live/**", "node_modules/**"],
    restoreMocks: true,
  },
});
