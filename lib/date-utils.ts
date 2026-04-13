export function getWeekRange(): { weekStart: string; weekEnd: string } {
  const now = new Date();
  const day = now.getDay();
  // Calculate Sunday: if Sunday (0), use today; otherwise go back to Sunday
  const diffToSunday = day === 0 ? 0 : day;
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - diffToSunday);
  sunday.setHours(0, 0, 0, 0);

  // For GitHub API queries, extend the range to include partial days due to timezone differences
  // Add 1 day before Sunday to catch commits from UTC perspective
  const weekStartForAPI = new Date(sunday);
  weekStartForAPI.setDate(sunday.getDate() - 1);

  // Saturday of the same week
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  saturday.setHours(23, 59, 59, 999);

  // Add 1 day after Saturday
  const weekEndForAPI = new Date(saturday);
  weekEndForAPI.setDate(saturday.getDate() + 1);

  return {
    weekStart: formatDate(weekStartForAPI),
    weekEnd: formatDate(weekEndForAPI),
  };
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
