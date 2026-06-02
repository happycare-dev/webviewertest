# FileMaker Web Viewer Setup

This document explains the **FileMaker-side setup** to display employee data in a Web Viewer.

## 1. Prerequisites

- Place **`employee-viewer.html`** somewhere FileMaker can access.
  - Examples: a shared folder, a web server, or the web publishing folder on FileMaker Server
  - For local testing: put `employee-viewer.html` in a folder you can reference with `Get ( DocumentsPath )`

## 2. Web Viewer URL calculation (passing data)

In the Web Viewer object’s **URL Calculation**, pass the HTML path plus the data.

### Method A: Pass Base64 JSON via query parameter (recommended)

1. Build a JSON array from the records you want to display (typically the current found set)
2. Base64-encode that JSON text
3. Build a URL like `file:///.../employee-viewer.html?data=«Base64 string»` and feed it to the Web Viewer

**Example calculation (URL only; data is prepared separately):**

```filemaker
"file:///" & 
Substitute ( Get ( DocumentsPath ) ; ":" ; "/" ) & 
"employee-viewer.html?data=" & 
$gWebViewerData
```

Store the **Base64-encoded JSON array string** into `$gWebViewerData` using the script shown below.

### Method B: Pass Base64 JSON via hash fragment

If the URL becomes too long, you can use the fragment (`#`):

```filemaker
"file:///" & 
Substitute ( Get ( DocumentsPath ) ; ":" ; "/" ) & 
"employee-viewer.html#" & 
$gWebViewerData
```

Note: Depending on the embedded browser/Web Viewer engine, there may be length limits after `#`.

---

## 3. Global variable and script example

### Global variable

- **`$gWebViewerData`**: holds the Base64-encoded JSON string used by the URL calculation above

### Script: “Set data for Web Viewer”

```filemaker
# Build a JSON array from the current found set,
# Base64-encode it, and store it in $gWebViewerData

Set Variable [ $json ; Value: "[" ]
Go to Record/Request/Page [ First ]

Loop
  # Map your fields into JSON values (replace field names with your own)
  Set Variable [ $name   ; Value: YourTable::姓名 ]   // Full name
  Set Variable [ $store  ; Value: YourTable::店舗名 ] // Store / location
  Set Variable [ $status ; Value: YourTable::状態 ]   // e.g. Retired
  Set Variable [ $date   ; Value: YourTable::日付 ]   // Date

  Set Variable [ $row ; Value: 
    "{\"fullName\":\"" & Substitute ( $name ; "\"" ; "\\\"" ) & 
    "\",\"location\":\"" & Substitute ( $store ; "\"" ; "\\\"" ) & 
    "\",\"status\":\"" & Substitute ( $status ; "\"" ; "\\\"" ) & 
    "\",\"date\":\"" & Substitute ( $date ; "\"" ; "\\\"" ) & "\"}"
  ]

  Set Variable [ $json ; Value: $json & $row ]
  Go to Record/Request/Page [ Next ; Exit after last: 1 ]
  Exit Loop If [ Get ( RecordNumber ) = Get ( FoundCount ) ]
  Set Variable [ $json ; Value: $json & "," ]
End Loop

Set Variable [ $json ; Value: $json & "]" ]
Set Variable [ $gWebViewerData ; Value: Base64Encode ( $json ; "UTF-8" ) ]

# Redraw the layout so the Web Viewer recalculates the URL
Refresh Window
```

- Replace `YourTable::...` with your actual table and field names.
- Example fields: Full Name / Store (Location) / Status / Date (or Termination Date)

### Layout flow

1. In the Web Viewer object’s URL calculation, set the formula for either `file:///...?data=...` or `...#...` (referencing `$gWebViewerData`).
2. When the layout opens (or when the user clicks a “Show list” button), run the script above (“Set data for Web Viewer”).
3. When the script finishes and runs `Refresh Window`, the Web Viewer URL is recalculated, the HTML receives the data, and the table is rendered.

---

## 4. If your table structure matches `Employee.tab`

If your data is a tab-delimited file like `Employee.tab` (fixed column order), you can map columns in FileMaker roughly like this:

| Column (0-based) | Meaning          | Example FileMaker field |
|------------------|------------------|--------------------------|
| 4                | Store / location | StoreName                |
| 7                | Status           | Status                   |
| 9                | Name             | FullName                 |
| 16               | Date             | Date (termination date)  |

Adjust `$name` / `$store` / `$status` / `$date` in the script to match your fields.

---

## 5. About `Base64Encode`

- In FileMaker 18 and later, you can use the **`Base64Encode`** function.
- In earlier versions, consider a custom function / plugin for Base64, or an alternative approach (e.g. serving JSON from a simple local HTTP endpoint and loading it in the Web Viewer).

---

## 6. Notes / limitations

- When using **`file://`**, the HTML is a *local file at a specific path*. If multiple users must share the same page, place it on a shared folder or web server and point the Web Viewer to that URL instead.
- Be mindful of URL length limits (often ~2KB–8KB). If you have many records, prefer `?data=` over `#`, limit the number of records shown, or add paging.
- Build JSON as **UTF-8**, and use `"UTF-8"` in `Base64Encode` so Japanese text renders correctly.

That’s it—you can now display your FileMaker table data in the Web Viewer using `employee-viewer.html`.

