// Global test setup — no DB connection in Phase 8.1
// DB integration setup will be added in Phase 8.2

import { vi } from "vitest";

// Silence winston logs during tests
vi.mock("../server/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
