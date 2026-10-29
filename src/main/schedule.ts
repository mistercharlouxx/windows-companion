export type ScheduleEvent = { id?: string | null; title: string; start?: string | null; end?: string | null };
export function detectConflicts(events: ScheduleEvent[]) {
  const timed = events.filter(event => event.start?.includes('T') && event.end?.includes('T')).map(event => ({ ...event, startMs: Date.parse(event.start!), endMs: Date.parse(event.end!) })).filter(event => Number.isFinite(event.startMs) && Number.isFinite(event.endMs)).sort((a, b) => a.startMs - b.startMs);
  const conflicts: { first: ScheduleEvent; second: ScheduleEvent }[] = [];
  for (let i = 0; i < timed.length; i++) for (let j = i + 1; j < timed.length && timed[j].startMs < timed[i].endMs; j++) conflicts.push({ first: timed[i], second: timed[j] });
  return conflicts;
}
