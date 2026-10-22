# Facts and route checks — source/method ledger

This feature is implemented only on the newer branch/Site version. It preserves the original demo branches, personality questionnaire and shared-group data.

## Reading path and implementation contract

Analytical task: compare estimated inter-stop travel time to displayed schedule gaps, while making evidence quality visible. Artifact: an existing Leaflet road/city map plus a directly labeled per-leg report. Leaflet owns map projection and gestures; React owns the check/report. No routing geometry is drawn: dashed map connectors still encode only visit order. Essential numbers and caveats are visible as text, not hover content. Up to five daily instances, each with two to eight stops; nothing calls routing just by loading the page. Each user-initiated check makes at most one provider matrix request. The report works without tiles or map rendering. Coordinates are WGS84; the routing API receives longitude,latitude, while Leaflet receives latitude,longitude.

On mobile, leg rows stack, controls wrap with 44-pixel hit targets, and source dates/caveats stay next to the data. Existing map gestures remain opt-in so vertical page scrolling is preserved. No geolocation, camera, sensor, animation or new map library is needed. Input changes discard the displayed result for the old input; failed rechecks retain an explicitly dated previous result when available. Reports are not copied into shared itinerary JSON or treated as an automatic plan approval.

## Source ledger

| Layer | Source and method | Status / date | Limitations |
| --- | --- | --- | --- |
| Planned time slots and meal budgets | DeepSeek or team sample; source shown inline | New generated plans record `generated_at`; older plans may not have it | Suggestions, not venue hours, prices or bookings. No daily budget validation. |
| Attraction descriptions and visit duration | Existing editorial catalog with visitor-information links | Curated reference, not automatically queried | Links alone do not validate hours/fees. Suggested dwell time is an estimate. |
| Official hours and admission | Fixed allowlist of six official sites; bounded server fetch and deterministic field extraction | UTC query time, rendered with full date/time in Tokyo; original time preserved on cache hits | No guessed fallback. Currently supports useful fields for TNM, Meiji Jingu and teamLab. Other sites/changed markup may produce partial/unknown results. No trip dates, inventory or closure-calendar validation. |
| Restaurant candidates | Existing Google Places lookup when configured | Full original query timestamp | Price bands are not menu quotes; usual hours are not exact-date availability. |
| Map pins | Existing OSM/Photon-derived Tokyo catalog | Catalog previously reviewed 2026-10-08 | Not entrance-level accuracy. Neighborhood pins and unconfirmed restaurant areas are approximate. Unknown hotels are not invented. |
| Basemap | OpenStreetMap raster tiles | Requested lazily while in view | Tile failure does not remove textual routes or reports. |
| Route distances and durations | FOSSGIS OSRM table API, separately prepared `foot` or `car` profile over OSM's road/path graph | Fresh provider query or six-hour cache with original query time; map-data version only if actually provided | Meters and seconds, not straight lines; no live traffic or train timetables. Snapping over 250 m or absent snapping metadata triggers review. |
| Map connectors | Existing straight dashed polyline | Schematic | Visit order only; never claimed as the calculated road path. |

API documentation: https://project-osrm.org/docs/v5.24.0/api/ . Provider usage/privacy: https://routing.openstreetmap.de/about.html . Attribution: © OpenStreetMap contributors, https://www.openstreetmap.org/copyright . The FOSSGIS service does not require a new account/key for this small coursework integration, but has no application SLA. Do not scale public demo traffic without arranging a suitable routing service.

Official source URLs are in `lib/attraction-facts.ts`. Only those fixed URLs may be fetched; there is no arbitrary URL, geolocation or coordinate proxy. Raw HTML is size/time bounded, never rendered as HTML and never sent to the LLM. Parsed values are text-only. Unmatched/changed fields remain unknown; errors do not become zero-price or always-open claims.

## Rate, cache and authorization contract

Group membership is checked before external lookup. Only existing catalog IDs and bounded itinerary text are accepted. Source cache entries contain public coordinates/provider facts, not names, questionnaire answers or credentials. Matrix keys are mode plus sorted catalog IDs so different users can reuse public data. Queries are user-initiated. A D1 atomic shared slot enforces a 1.1-second minimum between FOSSGIS requests, including across isolates, plus an uncached site-wide budget of 120/hour. Each member is limited to 60 checks/hour. Source pages have shared per-host spacing as well. No automatic provider retries or request bursts. Cached successful responses last six hours; failed official reads last ten minutes. Provider failures leave unknown fields rather than fabricated values.

## What a result does and does not establish

- A calculated foot/car route estimate exists between the supplied public reference pins. Network snapping and approximate endpoints are visible caveats.
- Only adjacent scheduled stops are assessed. Unknown intermediate stops are not bridged into a verified leg. A shared pin does not establish zero movement.
- Normal gaps compare next start minus previous end to the chosen mode's modeled duration. Transfer/activity blocks are marked for manual allocation rather than counting a single block multiple times as free travel time.
- Walking mode is a scenario, not inferred actual transport choice. Known routed transfer distance does not certify a full-day step cap. Car mode is not a public-transport substitute and does not include traffic/parking/access walks.
- A matching snapshot of official hours or admission is not exact-date opening validation. Dynamic ticket reference prices retain explicit dynamic-pricing qualifiers. No availability or booking claims are made.
- The UI does not automatically alter or accept the itinerary based on these checks. The organizer must review warnings and update the plan.

## Verification

Run `node --test tests/*.test.mjs`, TypeScript no-emit checks, the Sites build, and a user-driven check in the preview. Evidence tests cover unit conversion, correct transport profiles, unknown and duplicate points, mixed transfer blocks, schedule conflicts, source parsing failures, dynamic-price caveats, authorization, cache dates and shared rate limits. A production smoke test may use one temporary group, one walking matrix lookup and one official-source read, then delete only that group. Live provider checks prove connectivity and response handling, not full itinerary quality.
