export function defaultThreadTitle(
  agentName: string,
  date = new Date(),
  locale?: string,
  timeZone?: string,
): string {
  const dateLabel = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    timeZone,
  }).format(date);
  const timeLabel = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(date);
  return `${agentName} · ${dateLabel}, ${timeLabel}`;
}
