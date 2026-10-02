# UX / function audit — October 2026

Who this is for: the Data Business Analysis team, several people editing shared data at the same time.
✅ = done in this round · ⏳ = later · ⚠️ = needs a decision

## A. Working together safely

| # | Problem | What changed | |
|---|---|---|---|
| 1 | Two people editing the same DAX item: the last save silently overwrote the other one | Each save sends the version it started from. If someone saved in between, a dialog asks: overwrite with mine, or keep theirs | ✅ |
| 2 | No way to tell who last edited a definition, or when | The detail panel shows "Last edited by … ·" | ✅ |
| 3 | No link to send a teammate ("look at this measure") | Copy link button, plus `/dax?model=…&item=…` links that open the exact item. Filters are kept in the URL | ✅ |
| 4 | Closing the tab or switching items lost edits without warning | Browser warning on close; a dialog when switching items (Save & open / Discard / Stay) | ✅ |
| 5 | Save errors were swallowed: it said saved, but nothing was stored | The API returns the real error and the page shows it | ✅ |
| 6 | Definitions were saved without model, table or name, so they were hard to trace in the activity log | Full context is stored and the log reads naturally | ✅ |
| 7 | "Portal content" in Settings was saved only in one browser and never shown anywhere | Replaced with **Team announcement**, stored in the database. Admins publish it, everyone sees it at the top of every page, and each person can hide it until it changes | ✅ |
| 8 | Report workspace choices were per browser, so they were lost on another computer | Saved to the person's account (`user_preferences`) and follow them anywhere | ✅ |
| 9 | Deleting a license wasn't recorded, so it couldn't be restored even though restore supports it | The deleted row goes into the activity log with who deleted it | ✅ |
| 10 | 13 tables (DAX, whiteboard, licenses, scenarios, change log, `app_users`, the legacy `powerbi_token`) were readable and writable with the public anon key | The server now sends the caller's session hash (`x-app-session`); row-level security only admits live sessions (`migrations_2026-10-02_lock_tables_to_sessions.sql`). The legacy token table is closed entirely | ✅ |

## B. Finding things

| # | Problem | What changed | |
|---|---|---|---|
| 11 | Searching for a measure meant knowing which page and which model it was in | **Ctrl K** opens from any page: jump to a page, open a measure or column from any model, or search reports | ✅ |
| 12 | The DAX list stopped at 150 items with no way to see more | "Show N more" | ✅ |
| 13 | No way to see what still needs a definition | "Needs a definition" filter, a documented % for each model on the landing page and in the header | ✅ |
| 14 | Typing in search switched the model and cleared filters | Search stays inside the current model and filters | ✅ |
| 15 | You couldn't tell how many items each table had | Item counts per table in the side list | ✅ |

## C. Ease of use

| # | Problem | What changed | |
|---|---|---|---|
| 16 | The DAX page was too technical and crowded: 3 view modes, many buttons, purple and black styling | Redesigned: one header (model, search, New measure, ⋯), filters on one row, a detail panel in plain words ("What it means", formula, notes), and a fixed save bar | ✅ |
| 17 | The browser's `alert` / `confirm` / `prompt` were still used on 6 pages | Replaced with in-app toasts and dialogs, including the board rename and folder dialogs | ✅ |
| 18 | No keyboard shortcuts | `/` search · ↑↓ or j/k move through the list · Ctrl+S save · Esc close · Ctrl K everything | ✅ |
| 19 | The DAX detail panel was unusable on a phone | Full-screen panel with a back button, and tabs that scroll sideways | ✅ |
| 20 | Unused page files (`UserManagementPage`, `PortalPage`) and the old diagram engine in the DAX page | Removed (about 2,000 lines) | ✅ |

## D. Added in the second round

- ✅ Live presence on a DAX item: avatars show who else has it open, highlighted while they're editing.
- ✅ Comments with @mentions on every measure and column.
- ✅ "For you" inbox: mentions, comments and reviews on watched items, formula changes from .bim imports.
- ✅ Review status (draft → reviewed); a formula change in an import sends it back to draft.
- ✅ Dark theme (or follow the computer) and a Thai UI option for the shell, Ctrl K, Settings, the DAX dictionary and the Target planner.
- ✅ Target planner rebuilt: top-down delegation where every level adds up, CoE sub-units, suggestions, undo, by-segment and by-month views.

## E. Still open

- ⏳ Thai for the remaining pages (Reports, Licenses, Whiteboard, People, Activity log, Home).
- ⏳ Comments on whiteboards and target scenarios (the tables and inbox are ready to reuse).
