# Roamwise Canonical Feature Status

| #  | Feature | Status | Evidence | Remaining work |
| -- | ------- | ------ | -------- | -------------- |
| 1  | Destination photos, hero images, and place galleries | Substantially complete | Curated images via Unsplash; API routes `api/images/destination` | License verification for curated images. |
| 2  | Interactive map showing destinations, hotels, and day routes | Complete | Leaflet integration on `MapTab` with drag-and-drop support. | None |
| 3  | Shareable trip links for group members | Complete | `GroupDashboard` component generates role-based share links. | None |
| 4  | Invite members by email or share code | Complete | Share tokens generate invite links that users click to join. | None |
| 5  | Comments and voting on itinerary items | Complete | `CollaborationWidget` implements comment and vote schemas. | None |
| 6  | Drag-and-drop itinerary ordering | Complete | `@dnd-kit` sorting logic implemented in `SortableDay`. | None |
| 7  | Calendar export (.ics) for the full trip | Complete | `ics` package generation route `api/trips/[id]/print/ics` | None |
| 8  | Downloadable/printable itinerary PDF | Complete | Headless Chromium PDF generation at `api/trips/[id]/pdf` | Verify serverless deployment limits (RAM/Timeout). |
| 9  | Weather forecast and packing suggestions for travel dates | Substantially complete | UI and packing logic complete. Mock weather used. | Integrate live weather provider for production. |
| 10 | Local transport estimates between itinerary stops | Substantially complete | Estimated straight-line/walking times included in Trip Brain logic. | Live routing provider integration if exact roads are desired. |
| 11 | Live budget progress with category breakdown charts | Complete | Budget overview, max calculation, and charts implemented. | None |
| 12 | Expense entry and settlement tracking between travelers | Complete | Expense addition and optimized settlement generation working. | None |
| 13 | Saved/favorite destinations and places | Complete | `FavoriteDestination` and `FavoritePlace` schema active on Dashboard. | None |
| 14 | Recently viewed trips and destinations | Complete | `RecentTracker` populates `RecentActivity` in Dashboard. | None |
| 15 | Trip templates: weekend, honeymoon, family, solo, backpacking | Complete | `TemplateCard` injects predefined template parameters. | None |
| 16 | Better destination fallback: suggest close matches and explain unavailable destinations | Complete | Trip Brain handles fallbacks and validation elegantly. | None |
| 17 | Admin data-review panel to verify places, hours, prices, and sources | Partial | Infrastructure for data import/validate exists (`data/validate.ts`). | Build full web-based Admin UI interface. |
| 18 | Accessibility filters: wheelchair-friendly, low walking, senior-friendly, child-friendly | Complete | `accessibilityNotes` mapped for users and restricted from Viewer links. | None |
| 19 | Offline-friendly trip view / installable PWA support | Complete | Service worker cache + IndexedDB offline saving. | Require HTTPS staging verification. |
| 20 | Dashboard improvements: trip cards, progress, countdown, upcoming trip highlights | Complete | Dashboard comprehensively displays trips and stats. | None |
