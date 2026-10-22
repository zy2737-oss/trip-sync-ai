# Shared groups (no registration)

TripSync uses the existing Site's Cloudflare D1 database, provisioned by the `d1: "DB"` binding in `.openai/hosting.json`. This does not require a separate database account. Hosting limits and charges, if any, follow the hosting service's policies; this change makes no paid-plan purchase.

## Data and access

- `trip_groups`: invitation code, name, current preference revision, latest generated plan, plan revision, organizer dinner decision and acceptance timestamp.
- `trip_members`: nickname, role, questionnaire, attraction choices and completion status. Access is a random 256-bit bearer credential. Only its SHA-256 hash is stored server-side. A nickname or invitation alone cannot impersonate an existing member.
- `group_rate_limits`: temporary counters with hashed identities. No raw IP is stored here.

The organizer creates a group and copies its invitation. Others open it on their own devices, enter distinct nicknames and submit their own answers. A private recovery link can transfer the same member access to another device. Never share a recovery link as the group invitation. Clearing browser storage without saving that link loses access. There is no email/password recovery or account-based history yet.

Members can see the roster, completion status, their own saved answers and the shared plan. Only the organizer can read everyone's detailed answers, generate or accept a plan, or delete the group. Writes authorize the member from its credential, never a client-supplied member ID. Every joined member must submit before generation. Groups are limited to 12 members for this prototype.

The server constructs the planning input from stored profiles, anonymizes nicknames to Traveler 1, Traveler 2, etc., and sends actual individual preferences as well as a conservative summary to DeepSeek. All six supported attraction priorities can be represented across the group. User changes or new membership invalidate the current plan. Changes during generation prevent stale publication. A database lease prevents concurrent generation. Prior generated plans stay visible with an out-of-date warning until regenerated. Only the latest plan is retained; this is not a complete history feature.

Questionnaire edits are not autosaved. Submit the profile to save it; unsent edits are lost on reload. Completed profiles and plans are durable. UI refreshes every 8 seconds while visible, with manual refresh available. Browser-local sessions are isolated from the former `tripsync.local.v1` demo and are not automatically uploaded.

The organizer can permanently delete the group and profiles after confirmation. Leaving a browser session does not delete records. The application retains group data until deletion. This coursework prototype does not guarantee step counts, transport feasibility, live pricing or availability.

## Travel style (newer version only)

The new flow has six playful style questions, all five original practical questions (pace, walking, budget, food and group style), and an attraction page. Personality scoring does not use the practical answers. Each style has four opportunities to score. Ties remain blends, including a broadly balanced result; there are no scientific or compatibility percentages.

The additive `0001` migration adds nullable style answers, a nullable first-priority attraction and an opt-in style-sharing flag. Existing members and saved answers are preserved, and earlier submissions still work. No style is invented for old profiles. New quiz submissions require one first-priority attraction among up to three must-visits. Sharing off means only the organizer sees the result with the submitted profile. Sharing on exposes the derived label to group members, never raw answers or budget/mobility data. Revoking the flag removes it from subsequent snapshots.

The server derives the style and supplies it as a soft cue with the first-priority attraction to DeepSeek, without names or raw personality answers. Explicit planning choices always take precedence. This module does not add verified travel facts, booking, route optimization or a guarantee that every priority fits. Old `main` and `feature/my-feature` branches and prior saved Site versions are not changed by implementing it on `codex/travel-personalities`.

## Development and tests

```sh
node --test tests/*.test.mjs
./node_modules/.bin/tsc --noEmit --incremental false
```

The shared-group tests use SQLite with the real migration and a small D1 adapter. They cover separate credentials, access control, submitted-profile aggregation, generation prerequisites, stale-plan rejection and deletion. Provider responses are mocked in these tests.

Generate new schema migrations with `npm run db:generate`. Never rewrite an applied migration. Build through the Sites helper to emit the local D1 binding, then apply each unapplied migration locally using the starter's documented Wrangler D1 command. Production D1 is separate; the Sites deployment applies committed migrations before publishing the Worker. No schema creation happens inside request handlers.
