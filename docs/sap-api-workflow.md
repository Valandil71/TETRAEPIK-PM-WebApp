# SAP API Workflow

End-to-end flow from SAP TPM to the local database. The app uses manual imports only.

## Entry Points

### `POST /api/sap/sync` - Manual Import Route

`app/api/sap/sync/route.ts`

| Item | Description |
|---|---|
| Body validation | Validates a `projects[]` array with Zod |
| Auth | Requires an authenticated user |
| Status check | Rejects with `409` if an import is already running |
| Rate limit | Rejects with `429` if the same user imported within the last 3 minutes |
| Lock acquisition | Acquires the `sap_import_status` lock before importing |
| Import work | Calls `runManualImport()` with the selected SAP projects |
| Rate limit update | Updates `sap_api_rate_limits` only after a successful sync |
| Finalize | Sets import status back to `idle`, or `failed` if the run throws |

### `GET /api/sap/projects` - Project List Route

`app/api/sap/projects/route.ts`

| Item | Description |
|---|---|
| Auth | Requires an authenticated user |
| SAP list | Fetches the SAP project/subproject list |
| Blocked types | Removes blocked project types before returning |
| Local status | Marks a subproject as local when any local row has the same `sap_subproject_id` |
| Used by | `SapImportDialog`, which sends all visible subprojects to the manual import route |

## Manual Import Flow

1. The user clicks `Confirm Import`.
2. `SapImportDialog` fetches `/api/sap/projects`.
3. The dialog flattens all visible SAP subprojects into `{ projectId, subProjectId }` pairs.
4. The dialog posts those pairs to `/api/sap/sync`.
5. The route validates auth, cooldown, and the global import lock.
6. `runManualImport()` fetches SAP details and instructions.
7. `mapSapSubProjectToProjects()` converts one SAP subproject into one or more local project payloads.
8. `dedupeImportProjects()` removes duplicate payloads with the same `sap_import_key`.
9. `findExistingProject()` decides whether each payload updates an existing row or inserts a new one.
10. `updateProjectFromSap()` updates existing SAP-owned fields and tracks changes for the report.
11. `insertProjectFromSap()` creates new local project rows.
12. `createImportReport()` creates a manual import report when new or modified projects exist.

## Matching And Duplicate Prevention

`sap_subproject_id` identifies the SAP subproject. One SAP subproject can produce multiple local projects.

`sap_import_key` identifies the specific generated local project inside that SAP subproject. It includes values such as mode, system, languages, translation area, and deadline variant.

The main match is:

```text
sap_subproject_id + sap_import_key
```

There are also fallback matches for older imported rows that did not yet have `sap_import_key`.

## Mapping Rules

`mapSapSubProjectToProjects()` handles the project splitting rules:

| Rule | Behavior |
|---|---|
| Blocked project type | Returns no projects |
| Language pairs | Usually one local project per source/target language pair |
| SSE/SSK/SSH | One local project per language pair and translation area |
| Initial + final deadlines | Splits into two local projects: one initial, one final |
| Past deadlines | Skips a generated project when all its deadlines are before today |
| XTM words | Stores words as a binary `0` or `1` presence flag |

## Reports

Manual imports create reports only when there are new or modified projects.

| Item | Description |
|---|---|
| `report_type` | Always `manual` |
| `triggered_by` | The user who clicked import |
| New projects | Inserted project ids and basic details |
| Modified projects | Updated project ids and changed fields |
| No changes | No report is created |

## Known Review Areas

The manual flow still needs special care around:

1. Stale local rows when SAP no longer emits the same generated project.
2. Import preview showing only "exists locally" instead of a real change/missing-row preview.

## Safety Nets

The importer keeps existing `sap_instructions` when SAP says a subproject has instructions but the instructions endpoint cannot be fetched. The final import report includes an `Instructions Not Available` warning section listing the affected SAP subprojects.

The database has a unique partial index on `(sap_subproject_id, sap_import_key)` so the same generated SAP project key cannot create more than one local row.
