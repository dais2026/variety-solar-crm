import { describe, expect, it } from "vitest";

/**
 * Test SMS Broadcast API credentials by checking the account balance.
 * The balance endpoint returns "OK:<balance>" on success or "ERROR:<reason>" on failure.
 */
describe("SMS Broadcast API", () => {
  it("validates credentials by fetching account balance", async () => {
    const username = process.env.SMS_BROADCAST_USERNAME;
    const password = process.env.SMS_BROADCAST_PASSWORD;

    expect(username).toBeTruthy();
    expect(password).toBeTruthy();

    const params = new URLSearchParams({
      username: username!,
      password: password!,
      action: "balance",
    });

    const response = await fetch(
      `https://api.smsbroadcast.com.au/api-adv.php?${params.toString()}`
    );

    expect(response.ok).toBe(true);

    const text = await response.text();
    // Successful response starts with "OK:" followed by balance number
    expect(text.startsWith("OK:")).toBe(true);

    const balance = parseFloat(text.split(":")[1]);
    expect(balance).toBeGreaterThanOrEqual(0);
  });
});
