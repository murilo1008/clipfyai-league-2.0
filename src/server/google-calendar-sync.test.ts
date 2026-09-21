import { describe, expect, it } from "vitest";

import { buildGoogleCalendarCampaignEvents } from "../lib/google-calendar-events";

describe("buildGoogleCalendarCampaignEvents", () => {
  it("cria os seis lembretes esperados sem duplicar IDs lógicos", () => {
    const events = buildGoogleCalendarCampaignEvents({
      campaignName: "Campanha de teste",
      campaignUrl: "https://example.com/competitions/teste",
      startDate: new Date("2026-10-01T12:00:00.000Z"),
      endDate: new Date("2026-10-15T12:00:00.000Z"),
      timezone: "America/Sao_Paulo",
    });

    expect(events.map((event) => event.kind)).toEqual([
      "checkin",
      "start",
      "ending-7",
      "ending-3",
      "ending-1",
      "end",
    ]);
    expect(events[0]?.start.dateTime).toBe("2026-09-30T12:00:00.000Z");
    expect(
      events.every((event) => event.start.timeZone === "America/Sao_Paulo"),
    ).toBe(true);
  });

  it("não cria avisos de encerramento anteriores ao início", () => {
    const events = buildGoogleCalendarCampaignEvents({
      campaignName: "Campanha curta",
      campaignUrl: "https://example.com/competitions/curta",
      startDate: new Date("2026-10-10T12:00:00.000Z"),
      endDate: new Date("2026-10-12T12:00:00.000Z"),
      timezone: "UTC",
    });

    expect(events.map((event) => event.kind)).toEqual([
      "checkin",
      "start",
      "ending-1",
      "end",
    ]);
  });

  it("preserva o horário local ao atravessar mudança de horário de verão", () => {
    const events = buildGoogleCalendarCampaignEvents({
      campaignName: "Campanha DST",
      campaignUrl: "https://example.com/competitions/dst",
      startDate: new Date("2026-03-01T14:00:00.000Z"),
      endDate: new Date("2026-03-12T13:00:00.000Z"),
      timezone: "America/New_York",
    });

    const endingSeven = events.find((event) => event.kind === "ending-7");
    expect(endingSeven?.start.dateTime).toBe("2026-03-05T14:00:00.000Z");
  });
});
