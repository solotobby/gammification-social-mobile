/**
 * Timestamp formatting for the messages surfaces. Two different jobs:
 * the list wants a stamp that locates a thread in time at a glance, the
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

/** Midnight at the start of the given moment's day, in the device's timezone. */
function startOfDay(epochMs: number): number {
  const date = new Date(epochMs);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * The stamp on a conversation row, the way chat apps have taught people to
 * read an inbox:
 *
 * - today → the clock time, 24-hour ("20:19")
 * - yesterday → "Yesterday"
 * - within the last week → the weekday ("Monday")
 * - older → the date ("17 Sep", with the year once it isn't this one)
 *
 * Counted in calendar days, not elapsed hours: a message from 23:50 last night
 * is "Yesterday" at 00:10, not "20m". "The last week" is the six days before
 * yesterday, so a weekday name never repeats and can't be mistaken for next
 * week's.
 */
export function listStamp(epochMs: number, now = Date.now()): string {
  const days = Math.round((startOfDay(now) - startOfDay(epochMs)) / DAY);
  const date = new Date(epochMs);

  if (days <= 0) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  if (days === 1) return 'Yesterday';
  if (days < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === new Date(now).getFullYear() ? {} : { year: 'numeric' }),
  });
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
