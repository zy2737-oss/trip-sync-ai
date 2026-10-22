import test from "node:test";
import assert from "node:assert/strict";
import { restaurantRequest, searchRestaurants } from "../lib/restaurant-search.ts";
import { searchOSMRestaurants } from "../lib/osm-restaurants.ts";

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

test("no-key restaurant directory uses a bounded Photon category query, not invented prices or hours",async()=>{
  const feature=(p={},coords=[139.796,35.711])=>({properties:{osm_type:"N",osm_id:123,name:"Named restaurant",osm_key:"amenity",osm_value:"restaurant",countrycode:"JP",city:"Tokyo",...p},geometry:{type:"Point",coordinates:coords}});
  const result=await searchOSMRestaurants("01","lunch",async(url,init)=>{
    assert.equal(url.origin,"https://photon.komoot.io");assert.equal(url.searchParams.get("include"),"osm.amenity.restaurant");assert.equal(url.searchParams.get("limit"),"3");assert.ok(url.searchParams.get("bbox"));assert.equal(url.searchParams.has("q"),false);assert.equal(init.headers.Authorization,undefined);
    return Response.json({features:[feature(),feature(),feature({osm_id:124,osm_value:"shop"}),feature({osm_id:125},[0,0]),feature({osm_id:126,name:"Second restaurant"})]});
  });
  assert.equal(result.restaurants.length,2);assert.equal(result.source,"openstreetmap");assert.ok(Date.parse(result.checkedAt));assert.equal(result.restaurants[0].mapsUrl,"https://www.openstreetmap.org/node/123");assert.deepEqual(result.restaurants[0].hours,[]);assert.equal(result.restaurants[0].priceLevel,undefined);assert.ok(result.note.includes("NOT been filtered or verified"));
  await assert.rejects(searchOSMRestaurants("06","lunch"),/Unsupported/);
  await assert.rejects(searchOSMRestaurants("01","lunch",async()=>new Response("",{status:503})),/unavailable/);
  await assert.rejects(searchOSMRestaurants("01","lunch",async()=>Response.json({bad:[]})),/Incomplete/);
});
