import { vi } from "vitest";

// The "server-only" marker package throws on import unless the bundler sets
// the "react-server" export condition (Next.js does; Vitest doesn't), so
// every server-only module needs this stub to be importable in tests.
vi.mock("server-only", () => ({}));
