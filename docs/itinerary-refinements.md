# Itinerary review refinements

## Map and single timeline

Five lazy Leaflet maps retain the same WGS84 catalog pins, Web Mercator tile renderer, screen-stable numbered markers and schematic visit-order connectors. The duplicate map-stop list is removed. Each day has exactly one numbered activity timeline with details, source disclosure and previous-leg external directions. Selecting a marker navigates to that activity; selecting an activity's number focuses the map. Shared pins retain combined numbers; unknown/custom locations are never invented. Route-distance checks are in a secondary collapsed disclosure, not above the timeline. No geolocation permissions or device sensors are used.

OSM tile source remains `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, with visible attribution and native browser caching. Root metadata continues `no-referrer` to protect private recovery/session navigation. The tile image's own `referrerPolicy: origin` sends only the true origin, per https://operations.osmfoundation.org/policies/tiles/ . No proxy, identity spoofing, cache busting, repeated auto retries or tile prefetch. On first tile error the failed layer is removed, keeping pins and schedule usable; retry is explicit. Portrait uses a 288px map and 44px activity targets; gestures remain locked by default for page scrolling, with explicit gesture/reset controls. Desktop uses a 320px map. No duplicated narrow-screen timeline.

## Restaurants

Google Places requires `GOOGLE_PLACES_API_KEY`, not currently configured. The existing Google adapter remains for later configuration. No-key lookup now uses the existing Photon provider's documented `include=osm.amenity.restaurant` category search, three results, English-preferred names and fixed neighborhood bounding box (center +/-0.008 longitude, +/-0.006 latitude). Documentation: https://github.com/komoot/photon/blob/master/docs/api-v1.md . Only valid named Japanese restaurant OSM objects within the requested box become candidates. No hours, prices, ratings, current trading status, cuisine suitability or budget compliance are invented. Optional day-4 dinner branches share one directory lookup instead of identical no-price candidate lists.

`GET /api/restaurants` requires the existing group's device credential and group code. Cache is shared public data for 24h per day/meal, independent of requested price band because OSM does NOT verify it. Original query dates are retained. Member quota 30/hour; shared Photon budget 120 uncached/hour and 1.1sec minimum spacing also covers custom-place searches. Failed refresh preserves previously dated candidates. No alternate-provider cycling. Overpass was investigated but not shipped; its public endpoints were unavailable from this environment and Photon category search was successfully verified instead.

## Currency and edits

Meal estimates explicitly label JPY / Japanese yen, not CNY/RMB. There is no live currency conversion.

`POST /api/groups/:code/revise` accepts request 3–800 chars, expected profile revision, expected draft generation timestamp and saved dinner decision. Organizer-only, same-origin protection, existing generation quota (3/group/10min) and generation lease apply. Payload to DeepSeek includes only anonymous profiles, current saved draft and request. Free text cannot authorize external actions, bookings or relaxing saved constraints. Full output is revalidated for five days, non-overlap, lunch/dinner, custom IDs, omission flags and organizer dinner override. Budget/walking feasibility still requires human review: prompt constraints are not measured compliance guarantees.

Successful revisions replace the latest draft, advance a monotonic generated timestamp and clear acceptance. Failed calls retain the old plan and release the lease. Profile edits during generation cannot publish stale results. New acceptance requests include the generation timestamp so an older browser cannot accept a newly revised plan without refreshing. Legacy acceptance requests remain backward compatible. No new database migration is needed.
