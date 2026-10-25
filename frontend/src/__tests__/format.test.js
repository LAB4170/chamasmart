import { describe, test, expect } from "vitest";
import { currentUserId, sumAmounts, formatKES } from "../utils/format";

describe("currentUserId", () => {
  test("reads userId, user_id or id in that order", () => {
    expect(currentUserId({ userId: 3, id: 9 })).toBe(3);
    expect(currentUserId({ user_id: 4 })).toBe(4);
    expect(currentUserId({ id: 5 })).toBe(5);
  });
  test("returns null with no user", () => {
    expect(currentUserId(null)).toBeNull();
    expect(currentUserId({})).toBeNull();
  });
});

describe("money helpers", () => {
  test("sumAmounts adds numeric strings", () => {
    expect(sumAmounts([{ amount: "1500.00" }, { amount: 1500 }, { amount: "0.50" }])).toBeCloseTo(3000.5, 2);
  });
  test("formatKES shows the amount with separators", () => {
    expect(formatKES(18000)).toMatch(/18,000/);
  });
});
