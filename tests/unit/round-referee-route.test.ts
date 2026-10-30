import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../src/lib/http";
const mocks = vi.hoisted(() => ({ user: vi.fn(), save: vi.fn() }));
vi.mock("../../src/lib/auth/user", () => ({ requireUser: mocks.user }));
vi.mock("../../src/lib/round-referee-policy", () => ({
  saveRoundRefereePolicy: mocks.save,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { POST } from "../../src/app/api/admin/tournaments/[edition]/rounds/[roundId]/referee-policy/route";
const roundId = "00000000-0000-4000-8000-000000000001";
const actor = { osuId: 1, username: "Synthetic Admin" };
const command = { expectedRevision: 0, policy: { steps: [], commands: null } };
const context = { params: Promise.resolve({ edition: "synthetic", roundId }) };
const request = (origin: string) =>
  new Request(
    `http://localhost:3000/api/admin/tournaments/synthetic/rounds/${roundId}/referee-policy`,
    {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify(command),
    },
  );
beforeEach(() => {
  vi.stubEnv("APP_URL", "http://localhost:3000");
  mocks.user.mockResolvedValue(actor);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
describe("round referee policy route", () => {
  it("rejects cross-origin writes before authorization or persistence", async () => {
    expect((await POST(request("https://other.example"), context)).status).toBe(
      403,
    );
    expect(mocks.user).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("binds a valid save to the signed-in actor, edition and round", async () => {
    mocks.save.mockResolvedValue({ revision: 1, policy: command.policy });
    const response = await POST(request("http://localhost:3000"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.save).toHaveBeenCalledWith(
      actor,
      "synthetic",
      roundId,
      command,
    );
  });
  it("preserves permission failures and version conflicts", async () => {
    for (const status of [403, 409]) {
      mocks.save.mockRejectedValue(
        new HttpError(status, "Synthetic protected rule"),
      );
      expect(
        (await POST(request("http://localhost:3000"), context)).status,
      ).toBe(status);
    }
  });
});
