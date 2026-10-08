import test from "node:test";
import assert from "node:assert/strict";
import { buildDailyRoute, directionsUrl } from "../lib/daily-route.ts";

test("maps landmark order and meal areas without inventing hotels", () => {
  const route = buildDailyRoute("01", [
    { time: "09:00", title: "Sensō-ji", detail: "Visit" },
    { time: "12:00", title: "Lunch", detail: "Meal", meal: "Lunch" },
    { time: "14:00", title: "Museum", detail: "Visit", locationId: "museum" },
    { time: "18:00", title: "Unknown hotel", detail: "Return" },
  ]);
  assert.deepEqual(route.map(s => s.number), [1,2,3,4]);
  assert.deepEqual(route.map(s => s.locationId), ["sensoji", "asakusa", "museum", undefined]);
  assert.equal(route[1].approximate, true);
  assert.equal(directionsUrl(route[2], route[3], "walking"), undefined);
  assert.equal(new URL(directionsUrl(route[0], route[1], "transit")).searchParams.get("travelmode"), "transit");
});

test("every day's meals use the specified neighborhood and repeated points have no fake leg", () => {
  const expected = [["asakusa","ueno"],["harajuku","shibuya"],["azabudai","roppongi"],["tsukiji","ginza"],["shimokitazawa","shinjuku"]];
  expected.forEach((pair, i) => {
    const r = buildDailyRoute(`0${i+1}`, [{ time:"12:00", title:"Lunch", detail:"Meal", meal:"Lunch" }, { time:"18:00", title:"Dinner", detail:"Meal", meal:"Dinner" }]);
    assert.deepEqual(r.map(s => s.locationId), pair);
    assert.equal(directionsUrl(r[0], r[0], "walking"), undefined);
  });
});
