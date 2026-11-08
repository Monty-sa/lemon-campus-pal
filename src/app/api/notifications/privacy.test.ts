import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./in-app/route";
import { POST } from "./subscribe/route";
import { getServerSupabase } from "@/lib/cloud/server";
import { getVerifiedUser } from "@/lib/cloud/auth";

vi.mock("@/lib/cloud/server", () => ({ getServerSupabase: vi.fn() }));
vi.mock("@/lib/cloud/auth", () => ({ getVerifiedUser: vi.fn() }));

afterEach(() => vi.clearAllMocks());

describe("notification privacy", () => {
  it("does not query server notifications for an unauthenticated device ID", async () => {
    const from = vi.fn();
    vi.mocked(getServerSupabase).mockResolvedValue({ from } as never);
    vi.mocked(getVerifiedUser).mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/notifications/in-app?deviceId=another-device"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ notifications: [] });
    expect(from).not.toHaveBeenCalled();
  });

  it("scopes authenticated notification reads to verified user ID", async () => {
    const query = {
      select: vi.fn(), order: vi.fn(), limit: vi.fn(), eq: vi.fn(), or: vi.fn(),
      then: (resolve: (value: unknown) => void) => resolve({ data: [{ id: "own" }], error: null }),
    };
    query.select.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    const from = vi.fn().mockReturnValue(query);
    vi.mocked(getServerSupabase).mockResolvedValue({ from } as never);
    vi.mocked(getVerifiedUser).mockResolvedValue({ id: "u-1" } as never);

    const response = await GET(new Request("http://localhost/api/notifications/in-app?deviceId=another-device"));

    expect(response.status).toBe(200);
    expect(query.eq).toHaveBeenCalledWith("user_id", "u-1");
    expect(query.or).not.toHaveBeenCalled();
  });

  it("keeps guest push subscription credentials out of shared storage", async () => {
    const from = vi.fn();
    vi.mocked(getServerSupabase).mockResolvedValue({ from } as never);
    vi.mocked(getVerifiedUser).mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/notifications/subscribe", {
      method: "POST",
      body: JSON.stringify({ deviceId: "guest-device-123", endpoint: "https://push.example.test/one", keys: { p256dh: "key", auth: "auth" } }),
    }));

    expect(await response.json()).toEqual({ status: "acknowledged_local_only" });
    expect(from).not.toHaveBeenCalled();
  });
});
