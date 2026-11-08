import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("auth callback redirect", () => {
  it("keeps a backslash-prefixed next path on the same origin", async () => {
    const response = await GET(new Request("http://localhost:3000/auth/callback?next=%2F%5Cevil.test"));
    expect(new URL(response.headers.get("location")!).origin).toBe("http://localhost:3000");
  });
});
