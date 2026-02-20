import { describe, expect, it } from "bun:test";
import { canAccessBookForSetupOrder } from "./setup-order-access";

describe("canAccessBookForSetupOrder", () => {
  it("allows guest checkout for unowned books", () => {
    expect(
      canAccessBookForSetupOrder({
        bookOwnerId: null,
      }),
    ).toBeTrue();
  });

  it("allows owner access", () => {
    expect(
      canAccessBookForSetupOrder({
        bookOwnerId: "user_1",
        sessionUserId: "user_1",
      }),
    ).toBeTrue();
  });

  it("denies access for different user", () => {
    expect(
      canAccessBookForSetupOrder({
        bookOwnerId: "user_1",
        sessionUserId: "user_2",
      }),
    ).toBeFalse();
  });

  it("denies guest access for owned books", () => {
    expect(
      canAccessBookForSetupOrder({
        bookOwnerId: "user_1",
      }),
    ).toBeFalse();
  });
});

