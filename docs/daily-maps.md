# Daily itinerary maps

Leaflet 1.9.4 renders one map per day. Map tiles are fetched only when a day enters the viewport, directly from https://tile.openstreetmap.org with browser caching and visible OSM attribution. No offline prefetching, geolocation or API secret is required. Public OSM tiles are best-effort, suitable for this low-traffic coursework prototype; use a production tile provider if traffic grows.

Coordinates in `lib/daily-route.ts` are WGS84 decimal degrees, stored as latitude/longitude. Curated landmark and neighborhood reference points were checked against https://photon.komoot.io/api/ (OpenStreetMap data) on 2026-10-08. Meiji's main shrine was selected rather than the stadium; current Azabudai Borderless was selected rather than the former Odaiba location. These are not verified entrances. OSM data attribution: https://www.openstreetmap.org/copyright.

AI stops can return a validated `locationId` from this catalog; existing sample stops use title matching. Meals always use the daily neighborhood anchors, not selected restaurant addresses. Unknown hotels/activities are not invented or plotted. Generic rest blocks may reuse the preceding location and are labeled approximate. Nearby alternative activities may need organizer review.

Numbers correspond to the displayed stop order. Identical coordinates share a pin. Dashed straight connectors are schematic visit-order lines, not routed geometry, travel times or distances. Per-leg Google Maps URLs provide walking/transit routing externally; identical endpoints have no direction link. Unknown stops break navigation links. The website does not verify transit schedules or walking limits.

Map tiles: https://operations.osmfoundation.org/policies/tiles/
Navigation URLs: https://developers.google.com/maps/documentation/urls/get-started

Mobile maps default to page scrolling with explicit zoom controls. Gestures are opt-in. The keyboard-accessible ordered list remains available if maps fail. State remains local to the open itinerary, with no new storage or URL state.
