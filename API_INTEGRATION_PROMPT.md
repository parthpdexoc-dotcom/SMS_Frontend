# Frontend API + Component Integration Prompt (React + TS + Redux)
Use this prompt when you provide an API response and describe a new screen you want added.

## Your job (AI/developer)
Analyze the existing frontend and implement the requested feature **without duplicating code**. Prefer reuse via existing atoms/molecules/organisms and shared utilities.

## Project conventions you must follow
- **Architecture**: Atomic design
  - **Atoms**: `src/components/atoms/*` (Button, Input, Label, Icon, Card…)
  - **Molecules**: `src/components/molecules/*` (FormField, ShortLongStatusForm, DataTable…)
  - **Organisms**: `src/components/organisms/*` (MasterDataShortLongStatusList, Modal…)
- **Strings**: **No hard-coded UI strings.** Add/modify labels/messages in `src/constants/strings.ts`.
- **API**: Most endpoints return **`text/plain`** that contains JSON.
  - Use `src/services/textPlainJson.ts` helpers (`expectOkReadText`, `parseJsonText`, `parseJsonTextArray`).
  - Use `src/utils/apiClient.ts` (`apiGet/apiPost/apiDelete/apiPut`) so JWT is injected automatically.
  - In development, `apiClient` may serve mock responses. For endpoints you are integrating, add them to `alwaysRealEndpoints` so the real backend is called.
- **State**: Use Redux Toolkit slices in `src/store/slices/*`.
  - Use `createAsyncThunk` for API calls (fetch/upsert/delete).
  - Keep slice state consistent with existing slices: `{ items, isLoading, error, totalItems, currentPage, pageSize }`.
- **Imports**: Always use alias imports (`@/atoms/...`, `@/molecules/...`, `@/organisms/...`).
- **Non-duplication rule**:
  - If the requested UI matches an existing pattern, **reuse the existing organism** (e.g. `MasterDataShortLongStatusList`).
  - If you must create something new, **create it once as a reusable common component** and reuse it across screens.
- **Types**:
  - Define DTOs in `src/types/<domain>.ts`.
  - Create `enum` only when it improves clarity (e.g., status, tab ids, route ids); otherwise prefer union types for UI variants.
- **UX requirement**: Build it like you are the user:
  - Clear empty/loading/error states
  - Stable forms (no reset while saving)
  - Confirm destructive actions
  - Accessible labels / sensible button text

## Inputs you (the user) will provide
Paste:
- **GET response example** (one item) and endpoint URL (e.g. `/api/EmployeeType`)
- **Required fields** (short/long/status/etc.)
- **Screen placement** (menu location + route)
- Any **special columns** or extra form fields

## Output you (AI/developer) must produce
Implement end-to-end:

### 1) Types
Create `src/types/<name>.ts`:
- `Create<Name>Request`
- `Update<Name>Request`
- `<Name>Response`
- `<Name>PaginationParams` (if the API supports paging)

### 2) Service
Create `src/services/<name>Service.ts`:
- `get<NamePlural>(pagination?)`
- `create<Name>(payload)`
- `update<Name>(payload)`
- `delete<Name>(id)`

Rules:
- Use `apiGet/apiPost/apiDelete`
- Parse `text/plain` JSON using `textPlainJson.ts`
- Normalize keys + default booleans (`?? true`) in a `normalize<Name>()` function

### 3) Redux slice
Create `src/store/slices/<name>Slice.ts`:
- `fetch<NamePlural>`
- `upsert<Name>Thunk`
- `remove<Name>`
- Standard `isLoading/error` handling mirroring existing slices (BusinessType, EquipmentType)

Register the reducer in `src/store/index.ts`.

### 4) UI components (reuse first)
If the entity is **Short + Long + Status**, reuse:
- `src/components/molecules/ShortLongStatusForm`
- `src/components/organisms/MasterDataShortLongStatusList`

Create:
- `src/components/molecules/<Name>Form/<Name>Form.tsx`
- `src/components/organisms/<Name>List/<Name>List.tsx`

### 5) Routing + navigation
- Add the route in `src/components/AppContent.tsx`
- Add the sidebar menu item in `src/App.tsx`
- Add menu label constant in `src/constants/strings.ts` (`MENU_ITEMS.<NAME>`)
- If needed, add an icon mapping in `src/components/smsatoms/SMSIcon/SMSIcon.tsx` (`MATERIAL_NAME_MAP`)

### 6) Exports
- Export new components from `src/components/molecules/index.ts` and `src/components/organisms/index.ts`

### 7) Verify quality
Before finishing:
- Run lints for touched files and fix issues
- Ensure build compiles
- Confirm no duplicated components/utilities were introduced

## Master Data “Short/Long/Status” template guidance
If the API response looks like:
```json
{
  "id": "...",
  "short": "…",
  "long": "…",
  "active": true,
  "createdDate": "...",
  "createdBy": "...",
  "editedDate": "...",
  "editedBy": "..."
}
```
Then implement it like existing screens:
- `BusinessType` / `EquipmentType` / `EmployeeType` / `DepartmentDivisions`

## Developer suggestions (optional improvements you can propose at the end)
- Consider adding a shared “toast” system instead of `alert()` for errors
- Consider centralizing “master data” boilerplate generation (script or template)
- Consider tightening backend auth (`[Authorize]`) consistently to avoid “missing token” DB constraint issues


