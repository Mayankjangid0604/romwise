# ROAMWISE PRODUCTION BROWSER SMOKE TEST

This checklist is for manual verification after the V3.2 release deployment.
Perform this on the live production URL (https://romwise.vercel.app).

## 1. HOME
- [ ] Homepage loads
- [ ] Navigation works
- [ ] No console errors
- [ ] Mobile menu works

## 2. AUTH
- [ ] Login
- [ ] Logout
- [ ] Signup (if desired)
- [ ] No test OTP behavior (must require actual email/verification if applicable)

## 3. DASHBOARD
- [ ] Loads promptly
- [ ] Trip cards are visible
- [ ] Recent trips section is populated
- [ ] No frozen navigation

## 4. DISCOVERY
- [ ] Collections have images or valid fallbacks
- [ ] Search filters destinations successfully
- [ ] Tourism destinations rank sensibly
- [ ] Destination detail page opens
- [ ] Similar destinations load properly

## 5. CREATE TRIP
- [ ] Destination selection works
- [ ] Dates selection works
- [ ] Preferences selection works
- [ ] Budget selection works
- [ ] Create trip button completes the flow

## 6. GENERATION
- [ ] No false "generation failed"
- [ ] Itinerary appears
- [ ] Deterministic planner works without Gemini enabled

## 7. ITINERARY
- [ ] Correct number of days
- [ ] Add place works
- [ ] Remove place works
- [ ] Reorder places works
- [ ] No schedule overlaps
- [ ] Opening-hour warnings appear when appropriate
- [ ] Route map updates based on itinerary

## 8. PLACE BROWSER
- [ ] Search works
- [ ] Pagination works
- [ ] "Must Visit" toggles correctly
- [ ] "Interested" toggles correctly
- [ ] "Maybe" (if currently available) toggles correctly
- [ ] "Exclude" toggles correctly

## 9. ROUTE
- [ ] Current itinerary is reflected
- [ ] Map loads successfully
- [ ] Approximate labels are truthful and accurate

## 10. STAY
- [ ] Suggestions load
- [ ] Sample labels are visible
- [ ] Selection persists on reload
- [ ] Unknown prices are NOT shown as ₹0

## 11. BUDGET
- [ ] Planned values display correctly
- [ ] Actual expenses display correctly
- [ ] No incorrect zero-cost assumptions

## 12. PACKING
- [ ] List generates
- [ ] List has destination relevance
- [ ] Check/uncheck state persists on reload

## 13. COLLABORATION
- [ ] Create member link works
- [ ] Second account joins successfully
- [ ] Comments and votes update in real time
- [ ] Revoke link works
- [ ] Revoked link fails for new users

## 14. VIEWER
- [ ] Viewer can read the itinerary
- [ ] Viewer cannot mutate the itinerary (read-only enforced)

## 15. PDF
- [ ] Download PDF succeeds
- [ ] PDF contents render correctly
- [ ] Print fallback works if Chromium fails to launch

## 16. OFFLINE/PWA
- [ ] Save offline works
- [ ] Offline trip opens without network
- [ ] Logout clears account-specific offline data

## 17. RESPONSIVE
- [ ] Test layout manually on a mobile device or viewport
- [ ] Test layout manually on a tablet device or viewport
- [ ] Test layout manually on a desktop viewport

## 18. BROWSER CONSOLE
- [ ] No hydration errors
- [ ] No React errors
- [ ] No failed APIs (500s)
- [ ] No security warnings
