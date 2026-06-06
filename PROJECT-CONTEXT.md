# Project context & rules (webviewertest)

Use this file when starting a **new chat** so the assistant understands this repo without re-explaining setup.

## What this repo is

- **Purpose:** FileMaker **Web Viewer**–hosted employee list for file **WebViewerTest** (layout **EmployeeM**).
- **Stack:** Static `employee-viewer.html` + `employee-viewer.css` + six **`.js`** modules. No bundler; FileMaker loads the HTML from disk or a URL you configure.
- **Data access:** FileMaker scripts call **Execute FileMaker Data API** (read/update/delete) and return JSON to the Web Viewer via **Perform JavaScript in Web Viewer** (object name **`web`**).

## Web Viewer object (FileMaker)

- **Web Viewer object name:** `web` (required for all `Perform JavaScript in Web Viewer` script steps in the reference scripts).
- **URL:** Points at `employee-viewer.html` (same folder must contain **all** linked `.js` and `.css` files).

## Front-end file layout & load order

Scripts **must** load in this order (`employee-viewer.html`):

| Order | File | Role |
|------:|------|------|
| 1 | `employee-viewer-core.js` | `window.EV`: `state`, `DEFAULT_LIMIT`, `FIELD_MAP` |
| 2 | `employee-viewer-utils-dom.js` | Escaping, dates, row highlight, modal center/show, drag |
| 3 | `employee-viewer-table.js` | `EV.render`, `EV.findRowByRecordId`, `EV.applyFilter`, `EV.applySort` |
| 4 | `employee-viewer-data.js` | `EV.runFileMakerScript`, FileMaker `window.*` callbacks (data, delete/update results, UI caps, security) |
| 5 | `employee-viewer-actions.js` | Modals (delete / edit / **view** / **security**), `PerformScript` for update/delete/security |
| 6 | `employee-viewer-init.js` | `DOMContentLoaded`, table clicks, drags, initial `PerformScript` chain |

**Namespace:** Internal helpers live on **`window.EV`**. Do not rename `EV` without updating every module.

## Shared state (`employee-viewer-core.js`)

- **`EV.state`:** `rows`, `filtered`, `sortKey`, `sortDir`, `offset`, `totalCount`, `locationFilter`, `pendingDeleteId`, `editingRow`, **`canEditDelete`** (boolean; driven by FileMaker **GetUiCapabilities**, which reads the trusted `LoginValidate` session global).
- **`EV.DEFAULT_LIMIT`:** Page size (e.g. `50`) — must stay aligned with **GetData** `limit` in the JSON payload.

## FileMaker scripts ↔ JavaScript (contract)

| FileMaker script | Trigger from JS | JS callback / entry |
|------------------|-----------------|----------------------|
| **GetData** | `FileMaker.PerformScript('GetData', param)` | `window.receiveDataFromFileMaker(result)` |
| **GetLocations** | `FileMaker.PerformScript('GetLocations', '')` | `window.receiveLocations(result)` |
| **GetUiCapabilities** | `FileMaker.PerformScript('GetUiCapabilities', '')` | `window.receiveUiCapabilities(…)` — sets **`state.canEditDelete`** from JSON `{ "canEditDelete": true/false }` |
| **GetSecurityInfo** | `window.openSecurityInfo()` → `PerformScript('GetSecurityInfo', '')` | `window.receiveSecurityInfo(…)` — fills **権限確認** modal |
| **UpdateEmployeeDataAPI** | `FileMaker.PerformScript('UpdateEmployeeDataAPI', JSON.stringify(payload))` | `window.receiveUpdateResult(result)` |
| **DeleteRecord** | `FileMaker.PerformScript('DeleteRecord', JSON.stringify({ recordId }))` | `window.receiveDeleteResult(result)` |

**Also on `window`:** `filterByLocation`, `changePage`, `confirmDelete`, `cancelDelete`, `executeDelete`, **`openSecurityInfo`**, **`closeSecurityModal`**.

**On `EV` (used from init / table):** `openViewModal`, `closeViewModal`, `openEditModal`, `closeEditModal`, `saveEditModal`, etc.

**Startup order** (`employee-viewer-init.js`, ~100 ms after load): **`GetUiCapabilities`** → **`GetLocations`** → **`GetData`** (via `EV.runFileMakerScript(0, …)`). Capabilities must run before or with first render so **`canEditDelete`** is correct for edit/delete buttons.

**Reference copies** of FileMaker script text live under **` FileMakerScripts/`** (folder name on disk may include a **leading space** — verify with `ls` / Finder). Files include: `GetData.txt`, `GetLocations.txt`, `DeleteRecord.txt`, `UpdateEmployeeDataAPI.txt`, **`GetUiCapabilities.txt`**, **`GetSecurityInfo.txt`**.

### Login/session authorization (FileMaker)

- **LoginValidate** clears `$$wvLoginAccount`, `$$wvLoginPrivilegeSet`, and `$$wvLoginCanEditDelete` before each attempt, then sets them only after employee password validation succeeds.
- **GetData** / **GetLocations** return empty unauthorized payloads unless `$$wvLoginAccount` is set.
- **UpdateEmployeeDataAPI** / **DeleteRecord** must check `$$wvLoginCanEditDelete` before any `Execute FileMaker Data API` mutation. UI-only guards are not sufficient because Web Viewer JavaScript can call scripts directly.
- **GetData** must remove `fieldData.パスワード` from each returned record before calling `receiveDataFromFileMaker`.

### GetUiCapabilities (FileMaker)

- Builds JSON with **`canEditDelete`** (JSONBoolean) from **`$$wvLoginCanEditDelete`**, which is set by **LoginValidate** after a successful employee password check.
- Performs **`receiveUiCapabilities`** with **`GetAsText($json)`** (or equivalent text) so the Web Viewer receives parseable JSON.

### GetSecurityInfo (FileMaker)

- Builds one JSON object from the trusted Web Viewer login globals: `accountName`, `privilegeSetName`, `canEditDelete`, plus `extendedPrivilegesRaw`, `recordAccess`, **`layoutAccess`** (requires **FileMaker 18+** for `Get(LayoutAccess)`; remove that key on older versions if needed).
- Passes **text** into **`receiveSecurityInfo`** (e.g. **`GetAsText($json)`**) — empty parameter breaks the modal; JS shows a Japanese alert if parse fails or body is empty.

## GetData JSON parameter (`employee-viewer-data.js`)

- `offset` — 0-based in JS; **GetData** adds **1** for FileMaker Data API `offset` (see `GetData.txt`).
- `limit` — page size; align with **`EV.DEFAULT_LIMIT`**.
- `sortField` — Japanese field name from **`FIELD_MAP`** (`氏名`, `事業所略称`, `在籍フラグ`, `入社　年月日`, `退職　年月日` with **U+3000** in the date keys where applicable).
- `sortOrder` — `ascend` | `descend`.
- `locationFilter` — query on **`事業所略称`**; empty = all.

**Layout** for Data API in scripts: **`EmployeeM`**.

## Record identity & update payload

- **Delete** / **Update** use Data API internal **`recordId`** (from read responses). Row field **`apiRecordId`** is used for buttons and payloads.
- **`modId`:** Include in update payload only if numeric **`>= 1`**. Omit for `"0"` / empty — avoids **1708** (“integer 1 …”).
- **`fieldData`** keys must match **EmployeeM** / Data API (ideographic space **U+3000** in `入社　年月日` / `退職　年月日`).

## 在籍フラグ

- **Calculation** field — **not** sent in **UpdateEmployeeDataAPI** `fieldData` (stripped in JS and in `$fd` in `UpdateEmployeeDataAPI.txt`). List still **shows** 在籍/退職; edit UI for status remains commented in HTML until a stored field (e.g. 在籍区分) is wired.

## FileMaker script implementation notes

- **UpdateEmployeeDataAPI:** Build `$fd` with **per-field** `JSONGetElement($param ; "fieldData.…")`; avoid stuffing whole nested `fieldData` into **`JSONObject`** in one step (can cause **1708**).
- **UpdateEmployeeDataAPI:** Uses **`options`** `entrymode` / `prohibitmode` **`script`** to mitigate **201 Field cannot be modified**.
- **DeleteRecord:** Uses Data API **`action: delete`**. Legacy layout/find/delete steps are **comment-only** in `DeleteRecord.txt`.

## HTML / UI overview

- **Title bar:** heading **従業員一覧** + **権限確認** (`#btnSecurityInfo`) → **`GetSecurityInfo`** → **`receiveSecurityInfo`** → **`#securityModal`** (account, privilege set, layout/record access text, extended privileges list with Japanese labels in JS).
- **Table:** `#` column, 氏名 … 事業所略名, 在籍, dates, **actions** column.
- **Actions column:** **View** (eye) always — **`EV.openViewModal`** (`#viewModal`, read-only). **Edit** / **Delete** render **only if** **`state.canEditDelete`**; otherwise only the view button.
- **Guards:** `confirmDelete`, `executeDelete`, `openEditModal`, `saveEditModal` **return early** if **`!state.canEditDelete`** (defense in depth).
- **Modals:** **deleteModal**, **editModal**, **viewModal**, **securityModal** — each has **`.modal-drag-handle`**; **`EV.initDraggableModal`** is called for all four in **`employee-viewer-init.js`**.
- **Delete modal:** Shows **「氏名」** via **`#deleteModalFullName`**.
- **Row highlight** on view / delete / edit from actions; cleared on cancel/close, delete error, **`EV.runFileMakerScript`**, etc. (see **`EV.clearRowHighlight`** usage in data/actions).

## Pagination

- Change page size in **`EV.DEFAULT_LIMIT`** in **`employee-viewer-core.js`** (unless FileMaker caps `limit`).

## Other repo files

- **`WebViewerTest.fmp12`** — FileMaker solution (not parsed in git as text).
- **`FILEMAKER-SETUP.md`** / **`FILEMAKER-SETUP-English.md`** — older Web Viewer / Base64 URL notes; live list uses **GetData** + JSON from scripts.
- **`README.md`** — short label.

## Conventions for code changes

- Prefer **small, focused edits**; match existing style (IIFEs, `var`, **`EV.*`**).
- Keep **script tag order** in HTML if you add modules.
- New **Perform JavaScript** targets must match **`window.*`** or **`EV.*`** names FileMaker calls.
- After editing **`.txt`** scripts in **` FileMakerScripts/`**, re-apply steps in the real **`.fmp12`** in FileMaker Pro.
- When adding privilege sets to **GetUiCapabilities**, match **Manage Security** spelling exactly.

---

*Last updated to match: split JS modules, `canEditDelete` / GetUiCapabilities, view & security modals, GetSecurityInfo, table actions (view always, edit/delete conditional).*
