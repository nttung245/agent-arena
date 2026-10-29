import { describe, expect, it } from "vitest";
import { getFireFxKind } from "@/components/scene/fireFx";

describe("getFireFxKind", () => {
  it("lights the graveyard fire basket like a campfire", () => {
    expect(getFireFxKind("graveyard__fire_basket")).toBe("campfire");
    expect(getFireFxKind("campfire")).toBe("campfire");
    expect(getFireFxKind("camping__fire")).toBe("fire");
    expect(getFireFxKind("graveyard__candle")).toBeNull();
  });
});
