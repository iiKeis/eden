# Eden Production Checklist

## 1. Backend

- The app can call `EXPO_PUBLIC_EDEN_API_URL` when configured.
- A local mock API lives at `server/eden-api.js`.
- Run with `npm run api`.

## 2. Real AI

Replace `server/eden-api.js` internals with:

- image upload storage
- OpenAI vision call
- taxonomy/database validation
- structured scan output matching `PlantScanResult`

## 3. Auth And Cloud Database

Recommended tables:

- `users`
- `plants`
- `care_entries`
- `plant_scans`
- `recipes`
- `reward_ledger`

## 4. Camera Flow

Current flow captures and scans. Next hardening:

- dedicated preview/retake route
- upload progress
- offline retry queue
- clearer low-quality-photo guidance

## 5. Plant Detail

Implemented in Garden tab:

- plant overview
- run scan
- latest scan
- scan history
- care entry history
- unlocked recipes

## 6. Rewards Rules

Current rules live in `src/services/rewards.ts`.

- photo proof required
- high-confidence scan required
- daily XP cap documented
- duplicate window documented

## 7. Recipes

Recipes only unlock when:

- plant confidence is at least `0.9`
- edible confidence is at least `0.85`
- harvest status is `ready`

Otherwise Eden shows exact care instructions instead.
