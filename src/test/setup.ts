import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { randomUUID } from "node:crypto";
import { afterEach } from "vitest";

Object.defineProperty(globalThis, "crypto", { value: { randomUUID }, configurable: true });

afterEach(cleanup);
