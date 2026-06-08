import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the dependencies
vi.mock("./_core/sdk", () => ({
  sdk: {
    authenticateRequest: vi.fn(),
  },
}));

vi.mock("./_core/env", () => ({
  ENV: {
    smsBroadcastUsername: "test_user",
    smsBroadcastPassword: "test_pass",
  },
}));

vi.mock("./db", () => ({
  getNpuSmsSentByPhone: vi.fn(),
  insertNpuSmsSent: vi.fn(),
  insertSmsLog: vi.fn(),
  getSmsTemplate: vi.fn(),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { scheduledNpuSmsHandler } from "./scheduledNpuSms";
import { sdk } from "./_core/sdk";
import { getNpuSmsSentByPhone, insertNpuSmsSent, insertSmsLog, getSmsTemplate } from "./db";

function createMockReq(overrides = {}) {
  return {
    headers: { cookie: "app_session_id=test_token" },
    url: "/api/scheduled/npu-sms",
    ...overrides,
  } as any;
}

function createMockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("scheduledNpuSmsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-cron requests with 403", async () => {
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({
      id: 1,
      openId: "user_123",
      name: "Test User",
      email: null,
      loginMethod: null,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      isCron: false,
    } as any);

    const req = createMockReq();
    const res = createMockRes();

    await scheduledNpuSmsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "cron-only" });
  });

  it("processes NPU leads and sends SMS", async () => {
    // Mock cron auth
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({
      id: -1,
      openId: "cron_123",
      name: "Manus Scheduled Task",
      email: null,
      loginMethod: null,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      isCron: true,
      taskUid: "task_abc123",
    } as any);

    // Mock CSV fetch - header + 2 leads (one NPU, one not)
    const csvData = [
      "Date,Name,Contact,Email,Address,Outcome,Source,Status,Product",
      '03.06.26,John Smith,0412345678,john@test.com,123 Test St,Called NPU,Web,Pending,PV',
      '03.06.26,Jane Doe,0498765432,jane@test.com,456 Other St,Awaiting Information,Web,Pending,PV+BATT',
    ].join("\n");

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(csvData),
      })
      // SMS send response
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("OK:12345:0412345678"),
      });

    // Not already sent
    vi.mocked(getNpuSmsSentByPhone).mockResolvedValue(null);
    vi.mocked(getSmsTemplate).mockResolvedValue("Hi {name}, we tried to reach you regarding your solar enquiry.");
    vi.mocked(insertNpuSmsSent).mockResolvedValue(undefined);
    vi.mocked(insertSmsLog).mockResolvedValue(undefined);

    const req = createMockReq();
    const res = createMockRes();

    await scheduledNpuSmsHandler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        totalNpuLeads: 1,
        sent: 1,
        skipped: 0,
      })
    );

    // Verify SMS was sent with personalised message
    expect(mockFetch).toHaveBeenCalledTimes(2); // CSV fetch + SMS send
    expect(insertNpuSmsSent).toHaveBeenCalledWith(
      expect.objectContaining({
        leadPhone: "0412345678",
        leadName: "John Smith",
      })
    );
  });

  it("skips leads that already received SMS", async () => {
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({
      id: -1,
      openId: "cron_123",
      name: "Manus Scheduled Task",
      email: null,
      loginMethod: null,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      isCron: true,
      taskUid: "task_abc123",
    } as any);

    const csvData = [
      "Date,Name,Contact,Email,Address,Outcome,Source,Status,Product",
      '03.06.26,John Smith,0412345678,john@test.com,123 Test St,Called NPU,Web,Pending,PV',
    ].join("\n");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(csvData),
    });

    // Already sent
    vi.mocked(getNpuSmsSentByPhone).mockResolvedValue({
      id: 1,
      leadPhone: "0412345678",
      leadName: "John Smith",
      smsLogId: null,
      sentAt: Date.now() - 3600000,
    });
    vi.mocked(getSmsTemplate).mockResolvedValue("Hi {name}, test message");

    const req = createMockReq();
    const res = createMockRes();

    await scheduledNpuSmsHandler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        totalNpuLeads: 1,
        sent: 0,
        skipped: 1,
      })
    );

    // Verify no SMS was sent
    expect(mockFetch).toHaveBeenCalledTimes(1); // Only CSV fetch, no SMS send
    expect(insertNpuSmsSent).not.toHaveBeenCalled();
  });

  it("handles empty sheet gracefully", async () => {
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({
      id: -1,
      openId: "cron_123",
      name: "Manus Scheduled Task",
      email: null,
      loginMethod: null,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      isCron: true,
      taskUid: "task_abc123",
    } as any);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve("Date,Name,Contact"),
    });

    const req = createMockReq();
    const res = createMockRes();

    await scheduledNpuSmsHandler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        processed: 0,
      })
    );
  });
});
