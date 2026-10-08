import test from "node:test";
import assert from "node:assert/strict";
import { adjustWalking } from "../lib/itinerary-walking.ts";

test("each day changes an actual walking block while preserving meals and input", () => {
  const times = ["09:30–11:30", "11:00–12:00", "13:30–15:00", "13:30–16:30", "10:00–12:00"];
  for (const [index, time] of times.entries()) {
    const stops = [{ time, title: "Original activity", detail: "Original description" }, { time: "12:00–13:00", title: "Lunch", detail: "Lunch detail", meal: "Lunch", cost: "¥1,500" }, { time: "18:00–19:00", title: "Chosen dinner", detail: "Dinner detail", meal: "Dinner", cost: "¥2,000" }];
    const result = adjustWalking(`0${index + 1}`, stops, "reduced");
    assert.notEqual(result[0].title, stops[0].title);
    assert.equal(result[1], stops[1]);
    assert.equal(result[2], stops[2]);
    assert.equal(stops[0].title, "Original activity");
    assert.equal(adjustWalking(`0${index + 1}`, stops, "standard"), stops);
  }
});

test("unrecognized blocks remain unchanged and repeated application is stable", () => {
  const stops = [{ time: "00:00", title: "Other activity", detail: "Keep it" }];
  assert.deepEqual(adjustWalking("01", stops, "reduced"), stops);
  const first = adjustWalking("02", [{ time: "11:00–12:00", title: "Shopping", detail: "Walk" }], "reduced");
  assert.deepEqual(adjustWalking("02", first, "reduced"), first);
});

test("AI-specific low-walking alternatives override fixed template blocks", () => {
  const stops = [{ time: "10:30–11:30", title: "Generated visit", detail: "Original", lowWalkingTitle: "Generated seated break", lowWalkingDetail: "Rest nearby" }];
  const result = adjustWalking("01", stops, "reduced");
  assert.equal(result[0].title, "Generated seated break");
  assert.equal(result[0].detail, "Rest nearby");
  assert.equal(adjustWalking("01", stops, "standard")[0].title, "Generated visit");
});
