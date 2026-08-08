export function dayKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatDue(date: Date | null | undefined, timezone: string): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function parseDueInput(input: string, timezone: string): Date | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed || trimmed === "skip" || trimmed === "-" || trimmed === "none") {
    return null;
  }

  const today = dayKey(new Date(), timezone);

  if (trimmed === "today") {
    return new Date(`${today}T12:00:00.000Z`);
  }

  if (trimmed === "tomorrow") {
    const base = new Date(`${today}T12:00:00.000Z`);
    base.setUTCDate(base.getUTCDate() + 1);
    return base;
  }

  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const parsed = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }

  const fallback = new Date(trimmed);
  if (Number.isNaN(fallback.getTime())) return null;
  return fallback;
}

export function isDueSoon(dueAt: Date, withinHours: number): boolean {
  return dueAt.getTime() <= Date.now() + withinHours * 60 * 60 * 1000;
}

export function formatShortDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
  }).format(date);
}
