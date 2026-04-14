# Project context & rules (webviewertest)

Use this file when starting a **new chat** so the assistant understands this repo without re-explaining setup.

## What this repo is

- **Purpose:** FileMaker **Web Viewer**–hosted employee list for file **WebViewerTest** (layout **EmployeeM**).
- **Stack:** Static `employee-viewer.html` + `employee-viewer.css` + several **`.js`** modules. No bundler; FileMaker loads the HTML from disk or a URL you configure.
- **Data access:** FileMaker scripts call **Execute FileMaker Data API** (read/update/delete) and return JSON to the Web Viewer via **Perform JavaScript in Web Viewer** (object name **`web`**).

## Web Viewer object (FileMaker)

- **Web Viewer object name:** `web` (required for all `Perform JavaScript in Web Viewer` script steps in the reference scripts).
- **URL:** Points at `employee-viewer.html` (and the same folder must contain all assets below).

## Front-end file layout & load order

Scripts **must** load in this order (defined in `employee-viewer.html`):

| Order | File | Role |
|------:|------|------|
| 1 | `employee-viewer-core.js` | Defines `window.EV`: `state`, `DEFAULT_LIMIT`, `FIELD_MAP` |
| 2 | `employee-viewer-utils-dom.js` | Escaping, dates, row highlight, modal center/show, drag |
| 3 | `employee-viewer-table.js` | `EV.render`, `EV.findRowByRecordId`, `EV.applyFilter`, `EV.applySort` |
| 4 | `employee-viewer-data.js` | `EV.runFileMakerScript`, FileMaker-facing `window.*` callbacks |
| 5 | `employee-viewer-actions.js` | Delete/edit modals, `PerformScript` for update/delete |
| 6 | `employee-viewer-init.js` | `DOMContentLoaded` wiring, `initDraggableModal`, initial load |

**Namespace:** Internal helpers live on **`window.EV`**. Do not rename `EV` without updating every module.

## FileMaker scripts ↔ JavaScript (contract)

| FileMaker script | Trigger from JS | JS callback / entry |
|------------------|-----------------|----------------------|
| **GetData** | `FileMaker.PerformScript('GetData', param)` | `window.receiveDataFromFileMaker(result)` |
| **GetLocations** | `FileMaker.PerformScript('GetLocations', '')` | `window.receiveLocations(result)` |
| **UpdateEmployeeDataAPI** | `FileMaker.PerformScript('UpdateEmployeeDataAPI', JSON.stringify(payload))` | `window.receiveUpdateResult(result)` |
| **DeleteRecord** | `FileMaker.PerformScript('DeleteRecord', JSON.stringify({ recordId }))` | `window.receiveDeleteResult(result)` |

Also on **`window`** (used by HTML / FM): `filterByLocation`, `changePage`, `confirmDelete`, `cancelDelete`, `executeDelete`.

**Reference copies** of FileMaker script text (for copy-paste into FileMaker) live under **` FileMakerScripts/`** (note: folder name may include a leading space on disk—verify in Finder/`ls`).

## GetData JSON parameter (from `employee-viewer-data.js`)

Sent as one JSON string to **GetData**:

- `offset` — 0-based in JS; **GetData** adds **1** for FileMaker Data API `offset` (see `GetData.txt`).
- `limit` — page size; must match **`EV.DEFAULT_LIMIT`** in `employee-viewer-core.js` (e.g. 50).
- `sortField` — Japanese field name from `FIELD_MAP` (e.g. `氏名`, `事業所略称`, `在籍フラグ`, `入社　年月日`, `退職　年月日` with **U+3000** between 入社/年月日 and 退職/年月日 where applicable).
- `sortOrder` — `ascend` | `descend`.
- `locationFilter` — value for query on **`事業所略称`**; empty string = all locations.

**Layout** for Data API requests in scripts: **`EmployeeM`**.

## Record identity rules (important)

- **Delete** and **Update** use FileMaker Data API **`recordId`** (internal id from read responses), **not** a business key from `fieldData` unless you deliberately change both sides.
- In row data, **`apiRecordId`** is the string used for edit/delete buttons and payloads.
- **`modId`:** Only send in update payload if numeric **`>= 1`**. Omit when `"0"` or empty — otherwise Data API can return **1708** (“integer 1 …”).
- Update **`fieldData`** keys must match the **EmployeeM** layout / Data API (e.g. `入社　年月日` / `退職　年月日` use **ideographic space U+3000** in keys, consistent with FM script and JS `\u3000`).

## 在籍フラグ (status flag)

- Field is a **calculation** (e.g. from 在籍区分); **do not** send it in **UpdateEmployeeDataAPI** `fieldData` (removed from JS payload and from `$fd` in `UpdateEmployeeDataAPI.txt`).
- List still **displays** 在籍 / 退職 from read data; **editing** that value via UI is commented out until a stored field (e.g. 在籍区分) is wired.

## FileMaker script implementation notes

- **UpdateEmployeeDataAPI:** Build `$fd` with **per-field** `JSONGetElement($param ; "fieldData.…")` lines; avoid assigning the whole nested `fieldData` object into `JSONObject` in one step (can cause **1708** parse issues).
- **UpdateEmployeeDataAPI:** Includes **`options`** with `entrymode` / `prohibitmode` **`script`** to reduce **201 Field cannot be modified** when fields have prohibit-modification options.
- **DeleteRecord:** Current design uses Data API **`action: delete`**; older layout/find/delete steps are kept as **comments** in `DeleteRecord.txt` only.

## UI / UX rules implemented

- **Row highlight** when opening delete confirm or edit modal; cleared on cancel, close edit, delete error, or whenever **`EV.runFileMakerScript`** runs (refresh/sort/filter/page).
- **Delete modal** shows **「氏名」** (full name) in the message; drag handle on modals; modals repositioned with **`showModalOverlay`** (centered on each open).
- **# column** before 氏名: `state.offset + rowIndex + 1` (global order in found set).
- **Edit** uses modal; **Save** calls **UpdateEmployeeDataAPI**; dates converted display **YYYY/MM/DD** ↔ FileMaker **M/D/YYYY** in JS.

## Pagination

- Change page size by editing **`EV.DEFAULT_LIMIT`** in **`employee-viewer-core.js`** only (unless FileMaker caps `limit`).

## Docs in repo

- **`FILEMAKER-SETUP.md`** / **`FILEMAKER-SETUP-English.md`** — older notes (e.g. Base64 URL data); current list uses **GetData** + JSON, not necessarily those URL patterns.
- **`README.md`** — short repo label.

## Conventions for code changes

- Prefer **small, focused edits**; match existing style (IIFEs, `var`, `EV.*` naming).
- Keep **all script tags** in HTML in the **order** above if you add new modules.
- Any new **Perform JavaScript** target must use function names on **`window`** if FileMaker calls them by string name.
- After changing FM script text in **`.txt`** files, **re-apply** steps inside the actual **.fmp12** file in FileMaker Pro.

---

*Last aligned with repo layout: employee-viewer split modules + FileMakerScripts GetData / GetLocations / DeleteRecord / UpdateEmployeeDataAPI.*
