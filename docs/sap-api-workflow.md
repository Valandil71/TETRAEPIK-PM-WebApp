# SAP API Workflow

Full end-to-end flow from SAP TPM → local database, covering both the manual import triggered by a user and the scheduled cron sync.

---

## Entry Points

### `vercel.json` — Cron Schedule
```
"0 6 * * 1-5"  →  /api/cron/sap-sync
```
Runs Mon–Fri at 06:00 UTC. Triggers the cron handler automatically.

---

### `GET /api/cron/sap-sync` — Cron Route
`app/api/cron/sap-sync/route.ts`

| Item | Description |
|---|---|
| Auth guard | Validates `Authorization: Bearer <CRON_SECRET>` header |
| Service role client | Creates Supabase client with service role key (bypasses RLS) |
| Entry call | Calls `runCronSync()` and returns result as JSON |
| No lock | Cron skips the import lock — Vercel guarantees single invocation |

---

### `POST /api/sap/sync` — Manual Import Route
`app/api/sap/sync/route.ts`

| Item | Description |
|---|---|
| Body validation | Validates `projects[]` array via `sapSyncRequestSchema` (Zod) |
| Auth | Requires authenticated user via `getAuthenticatedSupabase()` |
| Status check | Rejects with 409 if an import is already running |
| Rate limit | Rejects with 429 if user imported within the last 3 minutes |
| Lock acquisition | Acquires `sap_import_status` lock before proceeding |
| Entry call | Calls `runManualImport()` with user-selected projects |
| Rate limit update | Updates `sap_api_rate_limits` only on successful sync |
| Finalize | Sets import status back to `idle` or `failed` after completion |

---

### `GET /api/sap/projects` — Project List Route
`app/api/sap/projects/route.ts`

| Item | Description |
|---|---|
| Auth | Requires authenticated user |
| Blocked type filter | Strips subprojects with blocked `projectType` before returning |
| Local status | Annotates each subproject with `existsLocally` from DB |
| Used by | `SapImportDialog` to build the list sent to the manual import |

---

## Authentication Layer

### `SapTpmApiClient` — SAP API Client
`lib/sap/client.ts`

| Item | Description |
|---|---|
| OAuth grant | Uses Resource Owner Password Credentials (not client_credentials) |
| Token cache | Caches access token; refreshes 60s before expiry |
| Token timeout | Aborts token request after 15s |
| Request timeout | Aborts API requests after 30s |
| Auth retry | On 401/403, clears token and retries the request once |
| Retry logic | Retries up to 3×on 5xx and 429, with exponential backoff + jitter |
| Jitter range | 0–500ms added to prevent thundering herd on concurrent retries |
| Singleton | `getSapClient()` returns one shared instance per server process |
| Methods | `getProjects()`, `getSubProjectDetails()`, `getInstructions()` |

### Error Classes
`lib/sap/errors.ts`

| Class | Description |
|---|---|
| `SapApiError` | HTTP error from the SAP API; carries `status`, `isAuthError`, `isRateLimited` |
| `SapConfigError` | Missing required environment variable at startup |
| `SapTokenError` | OAuth token fetch failed or response missing `access_token` |
| `RateLimitError` | Local rate limit hit; carries `waitMinutes` and `retryAfter` |
| `isRetryableError()` | Returns true for 5xx (except 501), 429, and network `fetch` errors |
| `createErrorResponse()` | Converts any error type into a typed HTTP response for API routes |

---

## Import Lock

### `import-lock.ts`
`lib/sap/import-lock.ts`

Single-row table `sap_import_status` (id = 1) acts as a distributed mutex.

| Function | Description |
|---|---|
| `ensureSapImportStatusRow()` | Creates the singleton row if it doesn't exist yet |
| `getSapImportStatus()` | Reads current status, `started_at`, `finished_at`, `started_by` |
| `acquireSapImportLock()` | Sets status to `running`; rejects if a fresh lock exists |
| Stale lock recovery | If `running` but older than 10 min (TTL), overwrites with compare-and-set |
| `finalizeSapImportStatus()` | Sets status to `idle` or `failed`; always called in finally block |

**Constants** (`lib/sap/constants.ts`)

| Constant | Value | Meaning |
|---|---|---|
| `RATE_LIMIT_MINUTES` | 3 | Min minutes between manual imports per user |
| `LOCK_TTL_MINUTES` | 10 | Stale lock age before it can be overridden |
| `SAP_IMPORT_STATUS_ROW_ID` | 1 | The singleton row ID in `sap_import_status` |
| `TRACKED_FIELDS` | 12 fields | Fields diffed for change reports (name, deadlines, system, etc.) |

---

## Import Orchestrators

### `runManualImport()` — Manual Import
`lib/sap/importer.ts`

Iterates the user-selected `{ projectId, subProjectId }` pairs.

| Step | Description |
|---|---|
| 1. Fetch all SAP projects | Single call to resolve parent info for each selected subproject |
| 2. Lookup parent + subproject | Skips with failure record if not found in SAP data |
| 3. Blocked type check | Skips silently if `projectType` is in the blocked set |
| 4. Fetch details | Calls `getSubProjectDetails()`; records failure and continues on error |
| 5. Fetch instructions | Only called if any step has `hasInstructions = true` |
| 6. Map + dedupe | `mapSapSubProjectToProjects()` → `dedupeImportProjects()` |
| 7. Sanitize | Strips HTML/scripts from string fields via `sanitizeImportData()` |
| 8. Find existing | `findExistingProject()` — exact match, then legacy fallback |
| 9a. Update | `updateProjectFromSap()` — updates SAP-owned fields; tracks changes |
| 9b. Insert | `insertProjectFromSap()` — creates new row with `status: 'active'` |
| 10. Report | `createImportReport()` with `report_type: 'manual'`, `triggered_by: userId` |
| Returns | `imported`, `updated`, `failed`, `hadSuccessfulSync`, `reportCreated` |

---

### `runCronSync()` — Scheduled Sync
`lib/sap/importer.ts`

Iterates **all SAP subprojects** from the API (not limited to what's in DB).

| Step | Description |
|---|---|
| 1. Fetch all SAP projects | Single call; builds `subProjectId → { parent, subProject }` map |
| 2. Blocked type check | Skips silently if `projectType` is in the blocked set |
| 3. Fetch details (cached) | Fetches once per subproject; reused across multiple local DB rows |
| 4. Fetch instructions (cached) | Only if any step has `hasInstructions = true`; cached per subproject |
| 5. Map + dedupe (cached) | `importProjectsCache` avoids re-mapping the same subproject twice |
| 6. Find existing | Same `findExistingProject()` as manual import |
| 7a. Update | Same `updateProjectFromSap()` as manual import |
| 7b. Insert | Same `insertProjectFromSap()` as manual import — new projects added |
| 8. Report | `createImportReport()` with `report_type: 'cron'`, `triggered_by: null` |
| Returns | `synced`, `imported`, `failed`, `errors[]` |

---

## Mapping & Filtering Layer

### `mapSapSubProjectToProjects()` — Core Mapper
`lib/sap/step-groups.ts`

Converts one SAP subproject into one or more `SapProjectForImport` records.

| Rule | Description |
|---|---|
| Blocked type guard | Returns `[]` immediately for blocked project types |
| `joinSteps()` | Groups steps by `contentId + language pair`; assigns deadlines by step type |
| `TRANSLREGU` → `initial_deadline` | End date from regulary translation step |
| `TRANSLFWL` → `final_deadline` | End date from framework list step |
| **Deadline filter** | Skips any project where all deadlines are strictly before today (midnight) |
| `MULTI_TA_SYSTEMS` (SSE/SSK/SSH) | Generates `language_pairs × translationAreas` products |
| STM project | Created alongside STD when `hasTermsInFwl = true` |
| Other systems | One project per `contentId` |
| XTM normalization | `words` normalized to `0` or `1` (binary presence flag) |
| `buildSapImportKey()` | Deterministic key encoding mode, system, languages, TA or contentId |

### `sanitizeImportData()`
`lib/sap/mappers.ts`

Strips `<script>` tags and all HTML from `name`, `instructions`, `sap_pm`, `url`.

### `dedupeImportProjects()`
`lib/sap/sync-utils.ts`

Deduplicates by `sap_import_key`; last entry wins on collision.

---

## Database Write Layer

### `findExistingProject()`
`lib/sap/project-writer.ts`

| Match | Description |
|---|---|
| Primary | Exact match on `sap_subproject_id` + `sap_import_key` |
| Legacy fallback | Matches by `sap_subproject_id` + `system` + languages when `sap_import_key IS NULL` |
| SSE/SSK/SSH legacy | Also matches on first `translation_area` element |
| Ambiguous | Returns `null` if legacy query finds 2+ rows (avoids wrong match) |

### `updateProjectFromSap()`
`lib/sap/project-writer.ts`

| Item | Description |
|---|---|
| Change tracking | Fetches current row first; diffs against `TRACKED_FIELDS` |
| Volumes excluded | `words` and `lines` not diffed for change reports (update-only) |
| Payload | `buildSapUpdatePayload()` without volumes (`includeVolumes: false`) |

### `insertProjectFromSap()`
`lib/sap/project-writer.ts`

Inserts full payload including `sap_subproject_id`, `api_source: 'TPM_sap_api'`, `status: 'active'`. Volumes included.

---

## Report Layer

### `createImportReport()`
`lib/sap/report-writer.ts`

| Item | Description |
|---|---|
| Skip condition | No report created if both `newProjects` and `modifiedProjects` are empty |
| `report_type` | `'manual'` for user-triggered, `'cron'` for scheduled |
| `triggered_by` | User ID for manual; `null` for cron |
| `acknowledged_by` | Array of user IDs; starts empty; each user dismisses independently |
| Summary | Auto-generated: `"Scheduled sync: 2 new, 5 modified"` |

### `useImportReports()` — Frontend Hook
`hooks/sap/useImportReports.ts`

| Item | Description |
|---|---|
| Filter | Only returns reports where current user is NOT in `acknowledged_by` |
| `acknowledgeAll()` | Appends user ID to `acknowledged_by` via RPC or direct update fallback |
| RPC fallback | If `acknowledge_import_report` RPC missing, updates array directly |

---

## Failure Tracking (Manual Import Only)

### `createFailureRecorder()`
`lib/sap/failure-log.ts`

Accumulates structured failures during a manual import run.

| Stage | Triggered when |
|---|---|
| `lookup` | Parent project or subproject not found in SAP data |
| `details` | `getSubProjectDetails()` API call throws |
| `match` | `findExistingProject()` returns a DB error |
| `update` | `updateProjectFromSap()` returns an error |
| `insert` | `insertProjectFromSap()` returns an error |
| `process` | Any uncaught exception during subproject processing |

> The cron uses a simpler `errors: string[]` array instead of the full failure recorder.

---

## Flow Diagrams

### Manual Import
```
User clicks "Confirm Import"
  → SapImportDialog fetches /api/sap/projects (blocked types filtered out)
  → flattenSubProjects() → all { projectId, subProjectId } pairs
  → POST /api/sap/sync
      → Zod validation
      → Auth check
      → Import status check (409 if running)
      → Rate limit check (429 if < 3 min since last)
      → Acquire lock
      → runManualImport()
          → getProjects() [once]
          → for each selected subproject:
              → blocked type? skip
              → getSubProjectDetails()
              → getInstructions() [if needed]
              → mapSapSubProjectToProjects()
                  → joinSteps()
                  → deadline filter (skip if all past)
                  → split by system rules
              → dedupeImportProjects()
              → sanitizeImportData()
              → findExistingProject()
                  → exact match → update
                  → no match   → insert
          → createImportReport()
      → Update rate limit timestamp
      → Release lock (idle / failed)
  → Toast notification to user
```

### Cron Sync
```
Vercel 06:00 UTC (Mon–Fri)
  → GET /api/cron/sap-sync
      → Validate CRON_SECRET
      → runCronSync()
          → getProjects() [once]
          → build subProjectId → parent map
          → for each SAP subproject:
              → blocked type? skip
              → getSubProjectDetails() [cached per subproject]
              → getInstructions() [cached, only if needed]
              → mapSapSubProjectToProjects() [cached per subproject]
                  → joinSteps()
                  → deadline filter (skip if all past)
                  → split by system rules
              → dedupeImportProjects()
              → sanitizeImportData()
              → findExistingProject()
                  → exact match → update
                  → no match   → insert
          → createImportReport()
      → Return { synced, imported, failed }
```
