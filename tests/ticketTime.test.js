import { describe, expect, it } from "vitest";
import { dateToTime, getDefaultScheduledTime, timeToDate } from "../src/utils/ticketTime";

describe("dateToTime", () => {
  it("formats a Date or a Firestore Timestamp as HH:MM", () => {
    const date = new Date(2026, 9, 12, 7, 5);

    expect(dateToTime(date)).toBe("07:05");
    expect(dateToTime({ toDate: () => date })).toBe("07:05");
  });

  it("returns an empty string for a missing or invalid value", () => {
    expect(dateToTime(null)).toBe("");
    expect(dateToTime(new Date("x"))).toBe("");
  });
});

describe("getDefaultScheduledTime", () => {
  it("returns now + 30 minutes as HH:MM", () => {
    expect(getDefaultScheduledTime(new Date(2026, 9, 12, 12, 10))).toBe("12:40");
  });

  it("rolls over the hour and zero-pads", () => {
    expect(getDefaultScheduledTime(new Date(2026, 9, 12, 8, 45))).toBe("09:15");
  });

  it("caps the time at 23:59 instead of wrapping past midnight", () => {
    expect(getDefaultScheduledTime(new Date(2026, 9, 12, 23, 29))).toBe("23:59");
    expect(getDefaultScheduledTime(new Date(2026, 9, 12, 23, 30))).toBe("23:59");
    expect(getDefaultScheduledTime(new Date(2026, 9, 12, 23, 50))).toBe("23:59");
    expect(getDefaultScheduledTime(new Date(2026, 9, 12, 23, 59, 30))).toBe("23:59");
  });
});

describe("timeToDate", () => {
  const now = new Date(2026, 9, 12, 18, 0);

  it("returns a Date on today's day with the given time", () => {
    const date = timeToDate("19:45", now);

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(9);
    expect(date.getDate()).toBe(12);
    expect(date.getHours()).toBe(19);
    expect(date.getMinutes()).toBe(45);
  });

  it("returns null for missing or invalid values", () => {
    expect(timeToDate("", now)).toBeNull();
    expect(timeToDate(undefined, now)).toBeNull();
    expect(timeToDate("24:00", now)).toBeNull();
    expect(timeToDate("12:60", now)).toBeNull();
    expect(timeToDate("noon", now)).toBeNull();
  });
});
