/**
 * Timestamp formatting for the messages surfaces. Two different jobs:
 * the list wants the shortest thing that still locates a thread in time, the
 * thread wants a clock time on every bubble and a date divider per day.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "3:56 PM" — the time printed inside a bubble. */
export function clockTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Compact age for a conversation row: "now", "24m", "5h", "2d", then a date.
 * Deliberately short — the row also carries a name and a message preview, and
 * a full date there pushes the preview into an ellipsis.
 */
export function shortAge(epochMs: number): string {
  const delta = Date.now() - epochMs;
  if (delta < MINUTE) return 'now';
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h`;
  if (delta < 7 * DAY) return `${Math.floor(delta / DAY)}d`;
  return new Date(epochMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** "Today" / "Yesterday" / "12 Sep" — the divider above a day's messages. */
export function dayLabel(epochMs: number): string {
  const date = new Date(epochMs);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
  });
}
