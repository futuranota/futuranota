import { describe, expect, it } from "vitest";
import {
  classifyKofiPayment,
  handleKofiWebhook,
  parseKofiData,
  verificationTokensMatch,
} from "./kofiWebhook.js";

const TOKEN = "test-token-0001";

function payload(overrides = {}) {
  return {
    verification_token: TOKEN,
    message_id: "msg-1",
    type: "Subscription",
    email: "member@example.com",
    tier_name: "Bronze",
    is_first_subscription_payment: true,
    ...overrides,
  };
}

describe("parseKofiData", () => {
  it("reads the form field data as JSON", () => {
    const raw = new URLSearchParams({
      data: JSON.stringify(payload()),
    }).toString();
    expect(parseKofiData(null, raw).email).toBe("member@example.com");
  });

  it("reads an already parsed body.data string", () => {
    expect(parseKofiData({ data: JSON.stringify(payload()) }, null).tier_name).toBe("Bronze");
  });
});

describe("classifyKofiPayment", () => {
  it("subscribes the first Bronze payment", () => {
    expect(classifyKofiPayment(payload(), "Bronze")).toEqual({
      subscribe: true,
      email: "member@example.com",
    });
  });

  it("skips a later renewal and a one-off tip", () => {
    expect(classifyKofiPayment(payload({ is_first_subscription_payment: false }), "Bronze").reason)
      .toBe("not_first_payment");
    expect(classifyKofiPayment(payload({ type: "Donation", tier_name: null }), "Bronze").reason)
      .toBe("not_subscription");
  });
});

describe("handleKofiWebhook", () => {
  it("rejects a bad token", async () => {
    const result = await handleKofiWebhook({
      body: payload({ verification_token: "nope" }),
      env: { KOFI_VERIFICATION_TOKEN: TOKEN },
      seen: new Set(),
    });
    expect(result.status).toBe(400);
  });

  it("accepts the sample renewal without subscribing", async () => {
    const calls = [];
    const result = await handleKofiWebhook({
      body: payload({ is_first_subscription_payment: false, email: "jo.example@example.com" }),
      env: { KOFI_VERIFICATION_TOKEN: TOKEN, KOFI_TIER_NAME: "Bronze" },
      subscribe: async (email) => {
        calls.push(email);
        return { result: "success" };
      },
      seen: new Set(),
    });
    expect(result.status).toBe(200);
    expect(result.body.subscribed).toBe(false);
    expect(calls).toEqual([]);
  });

  it("subscribes the first payment once", async () => {
    const calls = [];
    const seen = new Set();
    const input = {
      body: payload(),
      env: { KOFI_VERIFICATION_TOKEN: TOKEN, KOFI_TIER_NAME: "Bronze" },
      subscribe: async (email) => {
        calls.push(email);
        return { result: "success" };
      },
      seen,
    };
    const first = await handleKofiWebhook(input);
    const second = await handleKofiWebhook(input);
    expect(first.body).toMatchObject({ received: true, subscribed: true, mailchimp: "success" });
    expect(second.body.duplicate).toBe(true);
    expect(calls).toEqual(["member@example.com"]);
  });

  it("matches the verification token", () => {
    expect(verificationTokensMatch(TOKEN, TOKEN)).toBe(true);
    expect(verificationTokensMatch("short", TOKEN)).toBe(false);
  });
});
