export const formatDisplayDate = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

export const parseDate = (dateString: string): Date | null => {
  const parts = dateString.split("-");
  if (parts.length !== 3) return null;
  const dayStr = parts[0]!;
  const monthStr = parts[1]!;
  const yearStr = parts[2]!;
  const day = parseInt(dayStr, 10);
  const month = parseInt(monthStr, 10) - 1; // Month is 0-based
  const year = parseInt(yearStr, 10);
  if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year))
    return null;
  const date = new Date(year, month, day);
  // Check if the date is valid (e.g., Feb 30 doesn't exist)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  )
    return null;
  return date;
};
