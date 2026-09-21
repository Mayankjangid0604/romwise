# Roamwise V1 Limited Beta Smoke Test

This checklist verifies the critical paths for a production deployment of Roamwise. Run through these manually in the staging environment or the first production deployment before opening the beta.

## 1. Authentication & Onboarding (Requires SMS)
- [ ] Sign up with a new email/phone
- [ ] Receive OTP (or use bypass if SMS provider is not yet live)
- [ ] Complete profile setup
- [ ] Verify you land on the dashboard
- [ ] Log out successfully

## 2. Trip Creation
- [ ] Click "Create Trip"
- [ ] Enter a destination (e.g., "Araku Valley, Andhra Pradesh")
- [ ] Set dates for a 3-day trip
- [ ] Set a budget of ₹50,000
- [ ] Submit and verify the trip workspace loads

## 3. Planning & AI Features (Requires Gemini)
- [ ] Open the Trip Brain planner chat
- [ ] Ask for "3 good places to visit"
- [ ] Verify the planner suggestions correspond to places available in Roamwise's verified destination/place data.
- [ ] Check Day 1 of the itinerary to confirm it was generated appropriately.

## 4. Itinerary & Map
- [ ] Drag an item from Day 1 to Day 2
- [ ] Verify the item order saves and persists on refresh
- [ ] Open the Map view
- [ ] Verify itinerary items are plotted on the map
- [ ] Verify the map tiles load (no missing images/grey squares)

## 5. Budget & Expenses
- [ ] Go to the Budget tab
- [ ] Add an expense for ₹1,500 ("Lunch at cafe")
- [ ] Verify the total spent updates correctly
- [ ] Verify you (the creator) are listed as the payer

## 6. Collaboration
- [ ] Create a share link (Member role)
- [ ] Open the share link in an incognito window
- [ ] Sign in as a second user
- [ ] Verify the second user can see the trip
- [ ] As the second user, add a comment to an itinerary item
- [ ] As the first user, verify the comment appears
- [ ] As the second user, upvote an itinerary item
- [ ] As the first user, verify the vote count increases

## 7. Exports & Offline
- [ ] Click "Download PDF" (Requires Chromium)
- [ ] Verify a PDF downloads and contains the itinerary
- [ ] Click "Export ICS"
- [ ] Verify a calendar file downloads with events
- [ ] Click "Save Offline" (Requires network)
- [ ] Go offline (turn off Wi-Fi or use DevTools Network throttling)
- [ ] Reload the page and verify the trip still loads from cache (Works offline)

## 8. Offline Privacy (Critical)
- [ ] While back online, log out of the second user's account
- [ ] Log in as a third (new) user in the same browser profile
- [ ] Verify the third user CANNOT see the second user's offline trip data

## 9. Admin Area
- [ ] Log in with the designated Admin account
- [ ] Navigate to `/admin`
- [ ] Verify the admin dashboard loads
- [ ] Try to access `/admin` as a normal user and verify you get an "Unauthorized" or 404 page
