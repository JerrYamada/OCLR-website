import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = vi.hoisted(() => ({
  grants: [] as { role: string; editionSlug: string | null }[],
  remote: false,
  read: false,
}));
vi.mock("@/lib/auth/user", () => ({ requireUser: async () => ({ osuId: 1 }) }));
vi.mock("@/lib/auth/staff", () => ({ staffAccess: async () => mock.grants }));
vi.mock("@/lib/data-source", () => ({ remoteMode: () => mock.remote }));
vi.mock("@/lib/read-channel", () => ({ inReadChannel: () => mock.read }));
import { backupActor } from "@/lib/admin-backups";
describe("global backup authorization", () => {
  beforeEach(() => {
    mock.grants = [];
    mock.remote = false;
    mock.read = false;
  });
  it("requires an explicit global Admin on every request", async () => {
    for (const grants of [
      [],
      [{ role: "admin", editionSlug: "s11" }],
      [{ role: "developer", editionSlug: null }],
      [{ role: "referee", editionSlug: null }],
    ]) {
      mock.grants = grants;
      await expect(backupActor()).rejects.toMatchObject({ status: 403 });
    }
    mock.grants = [{ role: "admin", editionSlug: null }];
    await expect(backupActor()).resolves.toMatchObject({ osuId: 1 });
    mock.grants = [];
    await expect(backupActor()).rejects.toMatchObject({ status: 403 });
  });
  it("rejects remote and Developer read channels even with cumulative Admin grants", async () => {
    mock.grants = [{ role: "admin", editionSlug: null }];
    mock.remote = true;
    await expect(backupActor()).rejects.toMatchObject({ status: 403 });
    mock.remote = false;
    mock.read = true;
    await expect(backupActor()).rejects.toMatchObject({ status: 403 });
  });
});
