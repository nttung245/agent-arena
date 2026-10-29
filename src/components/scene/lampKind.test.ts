import { describe, expect, it } from "vitest";
import { getLampKind, isLampPlaceable } from "@/components/scene/lampKind";

describe("getLampKind", () => {
  it("maps graveyard practicals to their light profiles", () => {
    expect(getLampKind("graveyard__pumpkin_carved")).toBe("pumpkin");
    expect(getLampKind("graveyard__pumpkin_tall_carved")).toBe("pumpkin");
    expect(getLampKind("graveyard__lightpost")).toBe("lightpost");
    // "lantern_candle" contains both words; the lantern profile wins.
    expect(getLampKind("graveyard__lantern_candle")).toBe("lantern");
    expect(getLampKind("graveyard__candle")).toBe("candle");
    expect(isLampPlaceable("graveyard__pumpkin")).toBe(false);
  });

  it("keeps resolving existing lamps", () => {
    expect(getLampKind("floor_lamp")).toBe("floor");
    expect(getLampKind("desk_lamp")).toBe("desk");
    expect(getLampKind("beacon")).toBe("beacon");
    expect(getLampKind("graveyard__gravestone_round")).toBeNull();
  });
});
