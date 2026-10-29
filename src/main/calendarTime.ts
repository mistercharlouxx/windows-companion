export type CalendarEventInput = { title: string; start: string; end: string; description?: string; location?: string };

function dateFromHint(hint: string, reference: Date) {
  const explicit = hint.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (explicit) return { year: Number(explicit[1]), month: Number(explicit[2]) - 1, day: Number(explicit[3]) };
  const date = new Date(reference);
  if (/\btomorrow\b/i.test(hint)) date.setDate(date.getDate() + 1);
  else if (!/\btoday\b/i.test(hint)) throw new Error('The event needs a specific date, such as today, tomorrow, or 2026-10-29.');
  return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() };
}

export function normalizeEventDateTime(value: string, hint: string, reference = new Date()) {
  if (!value) throw new Error('The event is missing a start or end time.');
  if (/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) { const parsed = new Date(value); if (!Number.isNaN(parsed.getTime())) return parsed.toISOString(); }
  const time = value.match(/^(\d{1,2}):(\d{2})$/); if (!time) throw new Error(`"${value}" is not a valid event date or time.`);
  const hour = Number(time[1]); const minute = Number(time[2]); if (hour > 23 || minute > 59) throw new Error(`"${value}" is not a valid time.`);
  const date = dateFromHint(hint, reference); return new Date(date.year, date.month, date.day, hour, minute, 0, 0).toISOString();
}

export function normalizeCalendarEvent(event: CalendarEventInput, hint = '', reference = new Date()): CalendarEventInput {
  if (!event.title?.trim()) throw new Error('The event needs a title.');
  const start = normalizeEventDateTime(event.start, hint, reference); const end = normalizeEventDateTime(event.end, hint, reference);
  if (Date.parse(end) <= Date.parse(start)) throw new Error('The event end time must be after its start time.');
  return { ...event, title: event.title.trim(), start, end };
}
