import { describe, expect, it } from "vitest";

import { initSentry, Sentry } from "./init.js";

// Spec 50, critère 2 : sans DSN, Sentry ne démarre pas et rien ne part.
describe("initSentry (spec 50)", () => {
  it("ne démarre pas sans SENTRY_DSN_SERVEUR", () => {
    expect(initSentry({})).toBe(false);
    expect(initSentry({ SENTRY_DSN_SERVEUR: "   " })).toBe(false);
    expect(Sentry.getClient()).toBeUndefined();
  });
});
