# Limitations and known issues

- The bundled snapshot contains the complete set of rows parsed from the supplied KFU endpoint at import time (389 sections across 164 courses). Run the importer for a fresh snapshot when the university publishes changes.
- Term `144820`, college `06`, and category `11` are verified from KFU's official selector; see [KFU data source](DATA_SOURCE.md). These meanings are historical labels and do not guarantee current offering or registration availability.
- KFU's inspected table does not expose classroom, capacity, remaining seats, delivery mode, or linked-section relationships.
- Availability is only the state at import time and can change before registration.
- CRNs are copied for manual use in the official system. LEMON never signs in or registers courses.
- PDF export uses the browser's maintained print pipeline (“Save as PDF”). It does not create a server-side PDF.
- Plans remain in one browser profile. Clearing site storage removes them.
- The first prototype targets Sunday–Thursday in the visual calendar; the schema and engine also accept Friday and Saturday.
