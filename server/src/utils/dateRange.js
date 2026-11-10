const AppError = require("./appError");

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

const dateKeyInZone = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const parseDateKey = (value, field) => {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw new AppError(`${field} must use YYYY-MM-DD`, 400);
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new AppError(`${field} is not a valid date`, 400);
  }
  return date;
};

const addCalendarDays = (date, days) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const localMidnightToUtc = (date, timeZone) => {
  const target = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0,
    0,
    0
  );
  let guess = target;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, Number(value)]));
    const observed = Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
      values.second
    );
    guess += target - observed;
  }
  return new Date(guess);
};

const getDateRange = (query, timeZone = "Asia/Kolkata", now = new Date()) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    throw new AppError("Configured business timezone is invalid", 500);
  }

  let start;
  let end;
  let startKey;
  let endKey;
  const period = query.period || "range";

  if (query.startDate !== undefined || query.endDate !== undefined) {
    if (query.startDate === undefined || query.endDate === undefined) {
      throw new AppError("startDate and endDate must be provided together", 400);
    }
    start = parseDateKey(query.startDate, "startDate");
    end = parseDateKey(query.endDate, "endDate");
    startKey = query.startDate;
    endKey = query.endDate;
  } else {
    const todayKey = dateKeyInZone(now, timeZone);
    const today = parseDateKey(todayKey, "current date");
    if (period === "daily") {
      start = today;
      end = today;
    } else if (period === "weekly") {
      start = addCalendarDays(today, -6);
      end = today;
    } else if (period === "monthly") {
      start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      end = today;
    } else {
      throw new AppError("Provide startDate and endDate or select daily, weekly, or monthly", 400);
    }
    startKey = start.toISOString().slice(0, 10);
    endKey = end.toISOString().slice(0, 10);
  }

  if (start > end) throw new AppError("startDate must be on or before endDate", 400);
  const dayCount = (end.getTime() - start.getTime()) / 86400000 + 1;
  if (dayCount > MAX_RANGE_DAYS) {
    throw new AppError(`Date range cannot exceed ${MAX_RANGE_DAYS} days`, 400);
  }

  const exclusiveEndDate = addCalendarDays(end, 1);
  return {
    startDate: startKey,
    endDate: endKey,
    start: localMidnightToUtc(start, timeZone),
    endExclusive: localMidnightToUtc(exclusiveEndDate, timeZone),
    dayCount,
    timeZone,
  };
};

module.exports = { getDateRange, dateKeyInZone, parseDateKey, addCalendarDays };
