import { subDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

const EVENT_DURATION_MS = 30 * 60_000;

function subtractCalendarDays(date: Date, days: number, timezone: string) {
  return fromZonedTime(subDays(toZonedTime(date, timezone), days), timezone);
}

export type GoogleCalendarEventKind =
  | "checkin"
  | "start"
  | "ending-7"
  | "ending-3"
  | "ending-1"
  | "end";

export type GoogleCalendarEventInput = {
  kind: GoogleCalendarEventKind;
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
};

function eventAt(input: {
  kind: GoogleCalendarEventKind;
  campaignName: string;
  campaignUrl: string;
  date: Date;
  timezone: string;
  label: string;
}): GoogleCalendarEventInput {
  return {
    kind: input.kind,
    summary: `${input.label}: ${input.campaignName}`,
    description: `Lembrete automático da Clipfy League.\n\nCompetição: ${input.campaignName}\n${input.campaignUrl}`,
    start: { dateTime: input.date.toISOString(), timeZone: input.timezone },
    end: {
      dateTime: new Date(
        input.date.getTime() + EVENT_DURATION_MS,
      ).toISOString(),
      timeZone: input.timezone,
    },
  };
}

export function buildGoogleCalendarCampaignEvents(input: {
  campaignName: string;
  campaignUrl: string;
  startDate: Date;
  endDate: Date;
  timezone: string;
}): GoogleCalendarEventInput[] {
  const definitions: Array<{
    kind: GoogleCalendarEventKind;
    label: string;
    date: Date;
  }> = [
    {
      kind: "checkin",
      label: "Prepare o check-in",
      date: subtractCalendarDays(input.startDate, 1, input.timezone),
    },
    { kind: "start", label: "Início da competição", date: input.startDate },
    {
      kind: "ending-7",
      label: "A competição termina em 7 dias",
      date: subtractCalendarDays(input.endDate, 7, input.timezone),
    },
    {
      kind: "ending-3",
      label: "A competição termina em 3 dias",
      date: subtractCalendarDays(input.endDate, 3, input.timezone),
    },
    {
      kind: "ending-1",
      label: "A competição termina amanhã",
      date: subtractCalendarDays(input.endDate, 1, input.timezone),
    },
    { kind: "end", label: "Encerramento da competição", date: input.endDate },
  ];

  return definitions
    .filter(
      ({ kind, date }) =>
        !kind.startsWith("ending-") || date >= input.startDate,
    )
    .map((definition) =>
      eventAt({
        ...definition,
        campaignName: input.campaignName,
        campaignUrl: input.campaignUrl,
        timezone: input.timezone,
      }),
    );
}
