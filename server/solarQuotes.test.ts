import { describe, it, expect, vi } from 'vitest';

// Mock the db module
vi.mock('./db', () => ({
  getLeadTranscriptByName: vi.fn(async (name: string) => {
    if (name === 'Dave Collins') {
      return {
        id: 1,
        leadName: 'Dave Collins',
        leadEmail: 'dave@angrychair.com.au',
        leadPhone: '0401 835 272',
        leadAddress: '208 Centre Dandenong Rd, Cheltenham VIC 3192',
        leadSource: 'Solar Quotes',
        leadRef: '1073194',
        fullTranscript: 'Full email body here...',
        summary: 'Interest: Solar + Battery + EV Charger. Timeframe: Immediately.',
        leadDate: 'Wed, 03 Jun 2026 21:10:19 +1000',
        createdAt: 1717480000000,
      };
    }
    return null;
  }),
  getAllLeadTranscripts: vi.fn(async () => [
    {
      id: 1,
      leadName: 'Dave Collins',
      leadEmail: 'dave@angrychair.com.au',
      leadPhone: '0401 835 272',
      leadAddress: '208 Centre Dandenong Rd, Cheltenham VIC 3192',
      leadSource: 'Solar Quotes',
      leadRef: '1073194',
      fullTranscript: 'Full email body here...',
      summary: 'Interest: Solar + Battery + EV Charger.',
      leadDate: 'Wed, 03 Jun 2026 21:10:19 +1000',
      createdAt: 1717480000000,
    },
    {
      id: 2,
      leadName: 'Tom Zed',
      leadEmail: 'sam63a3p@gmail.com',
      leadPhone: '0385436078',
      leadAddress: '4 Atherton Wy, Cranbourne West',
      leadSource: 'Solar Quotes',
      leadRef: '1073015',
      fullTranscript: 'Another email body...',
      summary: 'Interest: Battery only.',
      leadDate: 'Thu, 04 Jun 2026 10:05:08 +1000',
      createdAt: 1717480100000,
    },
  ]),
  getAllSolarQuotesImports: vi.fn(async () => []),
}));

describe('Solar Quotes Transcript Feature', () => {
  it('getLeadTranscriptByName returns transcript for known lead', async () => {
    const { getLeadTranscriptByName } = await import('./db');
    const result = await getLeadTranscriptByName('Dave Collins');
    expect(result).not.toBeNull();
    expect(result?.leadName).toBe('Dave Collins');
    expect(result?.leadRef).toBe('1073194');
    expect(result?.fullTranscript).toBeTruthy();
    expect(result?.summary).toContain('EV Charger');
  });

  it('getLeadTranscriptByName returns null for unknown lead', async () => {
    const { getLeadTranscriptByName } = await import('./db');
    const result = await getLeadTranscriptByName('Unknown Person');
    expect(result).toBeNull();
  });

  it('getAllLeadTranscripts returns all transcripts', async () => {
    const { getAllLeadTranscripts } = await import('./db');
    const results = await getAllLeadTranscripts();
    expect(results).toHaveLength(2);
    expect(results[0].leadName).toBe('Dave Collins');
    expect(results[1].leadName).toBe('Tom Zed');
  });

  it('transcript contains expected fields', async () => {
    const { getLeadTranscriptByName } = await import('./db');
    const result = await getLeadTranscriptByName('Dave Collins');
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('leadName');
    expect(result).toHaveProperty('leadEmail');
    expect(result).toHaveProperty('leadPhone');
    expect(result).toHaveProperty('leadAddress');
    expect(result).toHaveProperty('leadSource');
    expect(result).toHaveProperty('leadRef');
    expect(result).toHaveProperty('fullTranscript');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('leadDate');
    expect(result).toHaveProperty('createdAt');
  });
});
