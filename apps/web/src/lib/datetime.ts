function resolvedTz(tz?: string | null): string {
  return tz ?? process.env.APP_TZ ?? "UTC";
}

function toZonedDate(date: Date, tz: string): Date {
  // Get local date string in the target timezone
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return new Date(
    `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`
  );
}

function zonedToUtc(zonedDate: Date, tz: string): Date {
  // Create a UTC date from a date that was expressed in tz-local time
  const utcMs = Date.UTC(
    zonedDate.getFullYear(),
    zonedDate.getMonth(),
    zonedDate.getDate(),
    zonedDate.getHours(),
    zonedDate.getMinutes(),
    zonedDate.getSeconds(),
    zonedDate.getMilliseconds()
  );
  const offset = utcMs - Date.parse(new Date(utcMs).toLocaleString("en-US", { timeZone: tz }));
  return new Date(utcMs + offset);
}

export function startOfDayInTz(date: Date, tz?: string | null): Date {
  const zone = resolvedTz(tz);
  const zoned = toZonedDate(date, zone);
  zoned.setHours(0, 0, 0, 0);
  return zonedToUtc(zoned, zone);
}

/**
 * Convert a calendar date string ("yyyy-MM-dd") to the UTC instant of midnight
 * on that date in the given timezone. Unlike startOfDayInTz, this does NOT
 * interpret the input as an instant first, so it is independent of the server's
 * local timezone. The result matches userDayRange(...).gte for the same date,
 * which is required for "today" filtering to include newly created tasks.
 */
export function dateStringToUtc(dateStr: string, tz?: string | null): Date {
  const zone = resolvedTz(tz);
  const [year, month, day] = dateStr.split("-").map(Number);
  const zoned = new Date(year, (month ?? 1) - 1, day ?? 1, 0, 0, 0, 0);
  return zonedToUtc(zoned, zone);
}

export function endOfDayInTz(date: Date, tz?: string | null): Date {
  const zone = resolvedTz(tz);
  const zoned = toZonedDate(date, zone);
  zoned.setHours(23, 59, 59, 999);
  return zonedToUtc(zoned, zone);
}

export function userDayRange(
  date: Date,
  tz?: string | null
): { gte: Date; lt: Date } {
  const zone = resolvedTz(tz);
  const zoned = toZonedDate(date, zone);
  zoned.setHours(0, 0, 0, 0);
  const startUtc = zonedToUtc(zoned, zone);
  const endZoned = new Date(zoned);
  endZoned.setDate(endZoned.getDate() + 1);
  const endUtc = zonedToUtc(endZoned, zone);
  return { gte: startUtc, lt: endUtc };
}

export function weekRange(
  weekStart: Date,
  tz?: string | null
): { gte: Date; lt: Date } {
  const zone = resolvedTz(tz);
  const zoned = toZonedDate(weekStart, zone);
  zoned.setHours(0, 0, 0, 0);
  // Move to Monday of that week (weekStartsOn: 1)
  const day = zoned.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  zoned.setDate(zoned.getDate() + diff);
  const startUtc = zonedToUtc(zoned, zone);
  const endZoned = new Date(zoned);
  endZoned.setDate(endZoned.getDate() + 7);
  const endUtc = zonedToUtc(endZoned, zone);
  return { gte: startUtc, lt: endUtc };
}

/**
 * UTC half-open range [gte, lt) covering the calendar month that contains
 * `date`, in the given timezone. Mirrors weekRange. Pass the first day of the
 * target month (or any day within it) to scope month-windowed activity queries.
 */
export function monthRange(
  date: Date,
  tz?: string | null
): { gte: Date; lt: Date } {
  const zone = resolvedTz(tz);
  const zoned = toZonedDate(date, zone);
  zoned.setHours(0, 0, 0, 0);
  zoned.setDate(1);
  const startUtc = zonedToUtc(zoned, zone);
  const endZoned = new Date(zoned);
  endZoned.setMonth(endZoned.getMonth() + 1);
  const endUtc = zonedToUtc(endZoned, zone);
  return { gte: startUtc, lt: endUtc };
}

export function sameDayInTz(a: Date, b: Date, tz?: string | null): boolean {
  const zone = resolvedTz(tz);
  const az = toZonedDate(a, zone);
  const bz = toZonedDate(b, zone);
  return (
    az.getFullYear() === bz.getFullYear() &&
    az.getMonth() === bz.getMonth() &&
    az.getDate() === bz.getDate()
  );
}
