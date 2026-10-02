# KM source for «Վերակարգի տեսակներ» / Ա.Ա.Հ / Պահպանել

Copied from installed app:
C:\Users\PUBG\AppData\Local\Programs\KM\runtime\resources\app

## Where the duty-graph / personnel logic lives

1) Screen «Վերակարգի տեսակներ» + graph open/render
   - index.html
     - window.openDutyTypesSection
     - window.openDutyTypePlanning
     - window.renderDutyTypePlanning
     - function getSchedule
     - window.saveDutyTypePlanning

2) Click «Ա.Ա.Հ» / «Անձնակազմ» → pick subdivision → save
   - index.html
     - window.kmOpenDutyPeoplePicker
     - function kmBindPeoplePicker
     - function kmCommitPickerNames
     - function kmLoadPickerPersonnel
     - function kmPeoplePickerShellHtml
     - function kmSeedPeopleFromRosterNames
     - window.kmOpenDialog (Save button)

3) Persist selected personnel (local Electron / IndexedDB — no separate HTTP API)
   - index.html → async function save(...)
   - index.html → function kmSlimDbForPersist(...)
   - js/km-org-context.js → kmSyncCorpsSlice / dutyTypeSchedules in corps slice

4) Related JS modules (load order also in index.html <script> tags)
   - js/km-org-context.js
   - js/km-formal.js
   - js/km-extensions.js
   - js/km-features.js
   - km_guard.js (integrity)

Search markers in index.html: KM_PICKER_PERSIST_V2, renderDutyTypePlanning, kmOpenDutyPeoplePicker, kmDutyAAHBtn
