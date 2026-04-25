import { describe, it, expect } from "vitest";
import { NIFTY50, toSlug, fromSlug } from "@/lib/nifty50";

describe("nifty50 slug helpers", () => {
  it("toSlug strips .NS suffix", () => {
    expect(toSlug("RELIANCE.NS")).toBe("RELIANCE");
  });

  it("toSlug strips .BO suffix", () => {
    expect(toSlug("RELIANCE.BO")).toBe("RELIANCE");
  });

  it("toSlug preserves & and - characters", () => {
    expect(toSlug("BAJAJ-AUTO.NS")).toBe("BAJAJ-AUTO");
    expect(toSlug("M&M.NS")).toBe("M&M");
  });

  it("fromSlug maps known slug to canonical .NS symbol", () => {
    expect(fromSlug("RELIANCE")).toBe("RELIANCE.NS");
    expect(fromSlug("TCS")).toBe("TCS.NS");
  });

  it("fromSlug is case-insensitive", () => {
    expect(fromSlug("reliance")).toBe("RELIANCE.NS");
  });

  it("fromSlug falls back to {UPPER}.NS for unknown slug", () => {
    expect(fromSlug("UNKNOWNXYZ")).toBe("UNKNOWNXYZ.NS");
  });

  it("round-trips: fromSlug(toSlug(sym)) === sym for every Nifty 50 symbol", () => {
    for (const { symbol } of NIFTY50) {
      expect(fromSlug(toSlug(symbol))).toBe(symbol);
    }
  });
});
