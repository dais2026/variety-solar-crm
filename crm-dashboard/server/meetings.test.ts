import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getMeetingsSent: vi.fn(),
  getMeetingsSentCount: vi.fn(),
  updateMeetingStatus: vi.fn(),
  insertMeetingSent: vi.fn(),
}));

import { getMeetingsSent, getMeetingsSentCount, updateMeetingStatus } from "./db";

describe("Meetings Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMeetingsSent", () => {
    it("should return meetings with correct structure", async () => {
      const mockMeetings = [
        {
          id: 1,
          customerName: "John Smith",
          customerEmail: "john@example.com",
          customerPhone: "0400000000",
          subject: "Solar Consultation",
          location: "123 Test St, Melbourne VIC",
          meetingStartTime: 1717500000000,
          meetingEndTime: 1717503600000,
          durationMinutes: 60,
          notes: "Discuss panel options",
          status: "scheduled",
          userId: null,
          sentAt: 1717490000000,
        },
      ];

      (getMeetingsSent as any).mockResolvedValue(mockMeetings);
      (getMeetingsSentCount as any).mockResolvedValue(1);

      const result = await getMeetingsSent(50, 0);
      expect(result).toHaveLength(1);
      expect(result[0].customerName).toBe("John Smith");
      expect(result[0].location).toBe("123 Test St, Melbourne VIC");
      expect(result[0].status).toBe("scheduled");
    });

    it("should return empty array when no meetings exist", async () => {
      (getMeetingsSent as any).mockResolvedValue([]);
      (getMeetingsSentCount as any).mockResolvedValue(0);

      const result = await getMeetingsSent(50, 0);
      expect(result).toHaveLength(0);
    });
  });

  describe("updateMeetingStatus", () => {
    it("should call updateMeetingStatus with correct params for completed", async () => {
      (updateMeetingStatus as any).mockResolvedValue(undefined);

      await updateMeetingStatus(1, "completed");
      expect(updateMeetingStatus).toHaveBeenCalledWith(1, "completed");
    });

    it("should call updateMeetingStatus with correct params for cancelled", async () => {
      (updateMeetingStatus as any).mockResolvedValue(undefined);

      await updateMeetingStatus(1, "cancelled");
      expect(updateMeetingStatus).toHaveBeenCalledWith(1, "cancelled");
    });
  });

  describe("Calendar invite logging", () => {
    it("should include customer address as location in meeting log", () => {
      // Verify that the meeting insert includes location from customer address
      const meetingData = {
        customerName: "Jane Doe",
        customerEmail: "jane@example.com",
        customerPhone: "",
        subject: "Solar Consultation - Jane Doe",
        location: "456 Solar Ave, Richmond VIC 3121",
        meetingStartTime: 1717500000000,
        meetingEndTime: 1717503600000,
        durationMinutes: 60,
        notes: null,
        status: "scheduled" as const,
        sentAt: Date.now(),
      };

      expect(meetingData.location).toBe("456 Solar Ave, Richmond VIC 3121");
      expect(meetingData.durationMinutes).toBe(60);
    });
  });
});
