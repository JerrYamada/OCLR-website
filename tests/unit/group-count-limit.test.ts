import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  groupConfigurationInputSchema,
  groupConfigurationSchema,
} from "../../src/lib/competition-model";
const configuration = (count: number) => ({
  version: "saved",
  groups: Array.from({ length: count }, (_, index) => ({
    key: `group-${index}`,
    name: `Group ${index}`,
    teamIds: [randomUUID(), randomUUID()],
  })),
});
describe("group count limit", () => {
  it("accepts four groups but rejects five on the write contract", () => {
    expect(
      groupConfigurationInputSchema.safeParse(configuration(4)).success,
    ).toBe(true);
    expect(
      groupConfigurationInputSchema.safeParse(configuration(5)).success,
    ).toBe(false);
  });
  it("keeps existing larger saved configurations readable without truncation", () => {
    const saved = configuration(5);
    expect(groupConfigurationSchema.parse(saved)).toEqual(saved);
  });
});
