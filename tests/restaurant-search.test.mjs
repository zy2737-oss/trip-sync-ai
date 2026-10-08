import test from "node:test";
import assert from "node:assert/strict";
import { restaurantRequest, searchRestaurants } from "../lib/restaurant-search.ts";

test("only the ten defined meals and known budgets can reach the provider", () => {
  for (const day of ["01", "02", "03", "04", "05"]) {
    for (const meal of ["lunch", "dinner"]) assert.ok(restaurantRequest(day, meal, "mid"));
  }
  for (const args of [["06", "lunch", "mid"], ["01", "breakfast", "mid"], ["01", "lunch", "secret"], ["__proto__", "lunch", "mid"]]) assert.equal(restaurantRequest(...args), null);
});

test("budget and premium dinner use distinct price filters", () => {
  assert.deepEqual(restaurantRequest("04", "dinner", "premium").priceLevels, ["PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE"]);
  assert.deepEqual(restaurantRequest("01", "lunch", "value").priceLevels, ["PRICE_LEVEL_INEXPENSIVE"]);
  assert.equal(restaurantRequest("01", "dinner", "flex").priceLevels, undefined);
});

test("maps provider data faithfully; excludes closed places and unsafe URLs", async () => {
  const rows = await searchRestaurants(restaurantRequest("01", "lunch", "mid"), "test-key", async (url, init) => {
    assert.equal(url, "https://places.googleapis.com/v1/places:searchText");
    assert.equal(init.headers["X-Goog-Api-Key"], "test-key");
    assert.equal(init.cache, "no-store");
    assert.equal(JSON.parse(init.body).pageSize, 3);
    return Response.json({ places: [
      { id: "live", displayName: { text: "Provider restaurant" }, businessStatus: "OPERATIONAL", googleMapsUri: "https://maps.google.com/place", regularOpeningHours: { weekdayDescriptions: ["Monday: 11:00–20:00"] } },
      { id: "closed", displayName: { text: "Closed restaurant" }, businessStatus: "CLOSED_TEMPORARILY" },
      { id: "unknown-hours", displayName: { text: "No hours" }, businessStatus: "OPERATIONAL", googleMapsUri: "javascript:alert(1)" },
    ] });
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, "Provider restaurant");
  assert.deepEqual(rows[0].hours, ["Monday: 11:00–20:00"]);
  assert.deepEqual(rows[1].hours, []);
  assert.equal(rows[1].mapsUrl, undefined);
  assert.equal(rows[1].priceLevel, undefined);
});

test("provider errors cannot turn into fake restaurant results", async () => {
  await assert.rejects(searchRestaurants(restaurantRequest("01", "lunch", "mid"), "test-key", async () => new Response("unavailable", { status: 403 })), /status 403/);
});
