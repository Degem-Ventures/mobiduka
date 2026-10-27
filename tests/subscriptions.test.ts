import assert from "node:assert/strict";
import test from "node:test";
import { effectiveSubscriptionStatus, SUBSCRIPTION_GRACE_DAYS } from "../lib/subscriptions.ts";

const now = new Date("2026-10-26T12:00:00.000Z");

test("trial is active before its exact end time and expired at the boundary", () => {
  assert.equal(effectiveSubscriptionStatus({
    status: "TRIAL",
    trialEndsAt: new Date(now.getTime() + 1),
    currentPeriodEndsAt: null,
    graceEndsAt: null,
  }, now), "TRIAL");

  assert.equal(effectiveSubscriptionStatus({
    status: "TRIAL",
    trialEndsAt: now,
    currentPeriodEndsAt: null,
    graceEndsAt: null,
  }, now), "EXPIRED");
});

test("paid subscriptions get the configured grace period after period end", () => {
  const periodEndsAt = new Date(now.getTime() - 1);
  const graceEndsAt = new Date(periodEndsAt.getTime() + SUBSCRIPTION_GRACE_DAYS * 24 * 60 * 60 * 1000);
  assert.equal(effectiveSubscriptionStatus({
    status: "ACTIVE",
    trialEndsAt: null,
    currentPeriodEndsAt: periodEndsAt,
    graceEndsAt: null,
  }, now), "GRACE");
  assert.equal(effectiveSubscriptionStatus({
    status: "GRACE",
    trialEndsAt: null,
    currentPeriodEndsAt: periodEndsAt,
    graceEndsAt,
  }, graceEndsAt), "EXPIRED");
});

test("revoked and missing subscription records fail closed", () => {
  assert.equal(effectiveSubscriptionStatus(null, now), "MISSING");
  assert.equal(effectiveSubscriptionStatus({
    status: "REVOKED",
    trialEndsAt: null,
    currentPeriodEndsAt: new Date(now.getTime() + 1000),
    graceEndsAt: null,
  }, now), "REVOKED");
});
