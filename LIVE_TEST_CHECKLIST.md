# Roamwise — Live Manual Test Checklist

**For a human tester who has not seen the code.**
**Prerequisite:** The app is running locally at `http://localhost:3000` with a working PostgreSQL database and `GEMINI_API_KEY` set in `.env`. If you are testing without a database, every page will show an error — that is expected and is not a test failure.

> **How to read this checklist**
> Each step states the exact action to take and what a correct result looks like.
> Each step also notes what to do if something goes wrong.

---

## A. Authentication Flows

### A1. Sign up with a new account

**Action:**
1. Go to `http://localhost:3000/signup`
2. Enter a name (e.g. `Alice Tester`), an email address you haven't used before (e.g. `alice@example.com`), and a password of at least 8 characters (e.g. `SecurePass1!`)
3. Submit the form

**Expected result:**
- You are redirected to `/dashboard`
- The dashboard loads without an error
- You are visibly logged in (your name or a logout option appears somewhere in the UI)

**If it fails:** Check the browser's Network tab (F12 > Network). Look at the POST to `/signup`. If it's a 500 error, it means the database is not connected. If it's a 400 error, there is a validation problem — report the exact error message to Claude.

---

### A2. Log out

**Action:**
1. While logged in on the dashboard, find and click the logout button or link

**Expected result:**
- You are redirected to `/login` or `/`
- Navigating back to `/dashboard` redirects you to `/login` (not showing any trip data)

**If it fails:** Report the exact URL you are on after clicking logout.

---

### A3. Log back in

**Action:**
1. Go to `http://localhost:3000/login`
2. Enter the email and password you used in A1
3. Submit

**Expected result:**
- You are redirected to `/dashboard`
- The dashboard loads and any trips you created are visible

**If it fails:** Network tab > POST to `/login` — check the response body for an error message.

---

### A4. Session persists across page refresh

**Action:**
1. While logged in, press F5 or Ctrl+R to refresh `/dashboard`

**Expected result:**
- The page reloads and you are still logged in
- You are NOT redirected to `/login`

**If it fails:** This is a session or cookie issue. Report to Claude with the full cookie list from DevTools (Application > Cookies).

---

### A5. Signup with an already-used email

**Action:**
1. Go to `http://localhost:3000/signup`
2. Enter the same email you used in A1 with any name and valid password
3. Submit

**Expected result:**
- The form does NOT create a second account
- You see an error message clearly stating the account or email already exists (exact wording may vary)
- You remain on the signup page

**If it fails:** If you are redirected to the dashboard and logged in as a new account, report to Claude — duplicate email is not being rejected.

---

### A6. Wrong password on login

**Action:**
1. Log out (A2)
2. Go to `http://localhost:3000/login`
3. Enter your email but type a wrong password
4. Submit

**Expected result:**
- You see an error message ("Invalid credentials" or similar)
- You remain on the login page
- You are NOT logged in

**If it fails:** If you are redirected to the dashboard, report immediately to Claude — this is a security bug.

---

### A7. Rate limiting — 5 failed login attempts

> **Note:** This test requires 5 failed logins in quick succession. After this test you will need to wait 15 minutes or restart the dev server before logging in fails differently again.

**Action:**
1. Log out
2. Go to `/login`, enter your email and an incorrect password, submit. Repeat 5 times total (5 failed attempts).
3. On the 6th attempt, note the error message

**Expected result:**
- The first 5 attempts: show the normal "Invalid credentials" message
- On the 6th attempt (or possibly 5th — the limit is 5 per 15-minute window): the error message changes to something like "Too many attempts. Try again in X minutes."
- The exact wording may vary but the message must explicitly reference a wait time or rate limit, not just "invalid credentials"

**If it fails (no rate-limit message appears after 6+ attempts):** Report to Claude — the rate limiter is not triggering. Attach a screenshot of the 6th error message.
**If it fails (rate-limited immediately on first attempt):** Report — the rate limiter counter is not resetting between test runs. Restart the dev server and try again.

---

## B. Trip Creation

### B1. Create a trip with valid data

**Action:**
1. Log in and go to `/dashboard`
2. Find and click the "Create Trip" or "New Trip" button
3. Fill in:
   - Destination: `Tokyo`
   - Start date: any date in the future (e.g. 30 days from today)
   - End date: 7 days after the start date
   - Travelers: `3`
   - Daily budget: `5000`
   - Pace: select `Balanced`
   - For at least one traveler, fill in interests/preferences if the form has those fields
   - If there is an "Accessibility Needs" text field, enter: `wheelchair, medication`
4. Submit

**Expected result:**
- You are redirected to the trip detail page (`/trips/[id]`)
- The trip name/destination (`Tokyo`) appears as the heading
- An itinerary is either displayed or there is a button to generate one

**If it fails:** Network tab > POST to `/trips/new` or the relevant server action. Look for a 400 or 500 response.

---

### B2. Invalid trip data — bad dates

**Action:**
1. Go to `/trips/new`
2. Set the start date to tomorrow and the end date to yesterday (end before start)
3. Submit

**Expected result:**
- The form does NOT submit successfully
- An error appears on or near the date fields indicating the dates are invalid

**If it fails:** If you are redirected to a trip detail page, report to Claude — date validation is not working.

---

### B3. Invalid trip data — bad traveler count

**Action:**
1. Go to `/trips/new`
2. Try to enter `21` for the number of travelers (the documented max is 20)
3. Fill in other required fields with valid data and submit

**Expected result:**
- The form rejects the submission
- An error appears stating the traveler count is too high (or the field itself prevents entering >20)

**If it fails:** Report the exact error message (or lack of one) to Claude.

---

### B4. Invalid trip data — zero or negative budget

**Action:**
1. Go to `/trips/new`
2. Enter `0` or a negative number for daily budget
3. Submit with other valid fields

**Expected result:**
- The form rejects the submission with a validation error on the budget field

---

## C. Itinerary Generation

### C1. Generate an itinerary

**Action:**
1. Open the trip you created in B1
2. If no itinerary is shown, find and click "Generate Itinerary" (or similar)
3. Wait for the itinerary to load

**Expected result:**
- A day-by-day itinerary appears (e.g. "Day 1", "Day 2", etc.)
- Each item has a title, time, and a reasoning/rationale string
- The items look contextually appropriate for the destination and pace selected

---

### C2. Read the reasoning text — does it make sense?

**Action:**
1. On the generated itinerary, find at least 2 different itinerary items
2. Read the "reasoning" or "rationale" text attached to each

**Expected result:**
- The reasoning references specific factors: time of day, traveler preferences, pace level, or category priority
- The text is NOT a generic placeholder like "This is a good activity" or "Enjoy your trip"
- Example of a good reasoning: "Morning sightseeing scheduled early before crowds peak; matches your priority for cultural experiences"

**If it fails (generic or missing reasoning):** Screenshot the item and reasoning text, report to Claude.

---

## D. AI Discovery

> **Prerequisite:** `GEMINI_API_KEY` must be set in `.env` for this section. If it is not set, the page will show a "Service unavailable" error — skip this section if you don't have a key.

### D1. Run AI discovery with a real prompt

**Action:**
1. Go to `http://localhost:3000/discovery`
2. In the text area, enter a descriptive prompt: `I want a relaxing beach trip in Southeast Asia for 2 weeks with good snorkeling and local food`
3. Submit

**Expected result:**
- After a few seconds, exactly 3 destination cards appear
- Each card shows: a destination name, a rationale paragraph, climate info, best travel time, suggested budget level, and a list of activities (up to 5)
- Each card shows a match score (0–100)
- The destinations make logical sense for the description (beach locations in Southeast Asia)

**If it fails with a red error box:** Check the error message text. "Service unavailable" = no API key. "Provider error" or "temporarily unavailable" = Gemini API is down or quota exceeded. "Invalid response" = schema mismatch — report to Claude with the full error text.

---

### D2. Run AI discovery with a vague or nonsensical prompt

**Action:**
1. Go to `/discovery`
2. Enter something deliberately vague: `I want to go somewhere nice`
3. Submit

**Expected result:**
- Either 3 destination cards appear (Gemini makes a best-effort guess), OR
- A clear, user-readable error message appears
- The page must NOT crash, show a blank white screen, show a raw JSON error, or throw an unhandled exception

**If it fails:** If you see a white screen, a stack trace, or raw JSON in the browser, screenshot and report to Claude.

---

## E. Group Alignment

### E1. Run group alignment

**Action:**
1. Go to `http://localhost:3000/group-alignment`
2. Add at least 2 travelers with genuinely conflicting preferences:
   - Traveler 1: Pace = Easy, Interests = beaches and relaxation
   - Traveler 2: Pace = Full, Interests = adventure sports and hiking
3. Submit

**Expected result:**
- A result panel appears with:
  - A "core tension" description identifying the conflict
  - A "compromise suggestion" proposing how to reconcile them
  - A "harmony score" (0–100)
- The response addresses the actual conflict you entered (easy vs full pace), not a generic statement

---

## F. Route Page

### F1. View the optimized route

**Action:**
1. Open a trip with a generated itinerary
2. Navigate to the route page (`/trips/[id]/route`)
3. If there are multiple days, use the day selector tabs to switch days

**Expected result:**
- A side-by-side comparison of original vs optimized stop order is shown
- Summary cards show: original distance (km), optimized distance (km), distance saved, time saved
- If the route is already optimal, the "Saved" card shows "Already optimal" (not "0.0 km" or a negative number)
- If there is backtracking, a warning panel lists the specific segments flagged

**If it fails:** If the saved card shows a negative number or "0 km" instead of "Already optimal", screenshot and report to Claude.

---

## G. Replanning

### G1. Mark an itinerary item as delayed, then reject the proposal

**Action:**
1. Open a trip's itinerary
2. Find any itinerary item that is NOT marked time-sensitive (avoid breakfast/sunrise/sunset/dinner/nightlife items for this test)
3. Click "Mark as delayed" (or similar) on that item
4. In the form that appears, select "Delayed" and enter a delay of `60` minutes
5. Click "Propose Replan" or submit the form
6. Review the proposal — note which items are shifted (shown in blue) or removed (shown in red) with reasons
7. Click **Reject**

**Expected result after reject:**
- The itinerary returns to exactly its previous state
- The item you selected is NOT marked delayed
- No items were added or removed
- The proposal is dismissed

---

### G2. Accept a replan proposal

**Action:**
1. Repeat G1 steps 1–6 (mark an item delayed, view the proposal)
2. This time click **Accept**

**Expected result after accept:**
- The itinerary updates to reflect the proposal
- Items that were shifted now show their new times
- Items that were removed are gone
- The change persists if you refresh the page (it was written to the database, not just shown in memory)

**If the change doesn't persist after refresh:** This is a bug — report to Claude. The `acceptReplan` server action should write to the database.

---

## H. Budget & Stay

### H1. Check the budget total, select a hotel, verify it updates

**Action:**
1. Open a trip with a generated itinerary
2. Navigate to `/trips/[id]/budget`
3. Note the current total spend figure (write it down)
4. Navigate to `/trips/[id]/stay`
5. Select any hotel from the list (click its select button)
6. Navigate back to `/trips/[id]/budget`

**Expected result:**
- The total spend has increased by the hotel's total cost (shown on the stay page)
- The budget page has a separate accommodation section or line item showing the selected hotel
- If you are now over budget, an over-budget warning is visible

---

### H2. Remove the hotel, verify budget reverts

**Action:**
1. Navigate back to `/trips/[id]/stay`
2. Click "Remove" on the selected hotel
3. Navigate to `/trips/[id]/budget`

**Expected result:**
- The total spend is back to what it was before you selected the hotel (the number you wrote down in H1)
- The accommodation section either disappears or shows no hotel selected
- No over-budget warning if you were previously within budget

**If the budget doesn't update:** This is a `revalidatePath` bug — report to Claude. Note which page failed to revalidate.

---

## I. Packing Checklist

### I1. Set accessibility notes, generate packing list, verify accessibility items appear

> **This is the primary unverified feature — pay close attention.**

**Action:**
1. Create a new trip (or use the B1 trip if you entered accessibility notes)
2. Ensure the accessibility notes field contains: `wheelchair, medication`
3. Navigate to `/trips/[id]/packing`
4. Click "Generate Packing List"
5. Scan the generated list for accessibility-related items

**Expected result:**
- Items related to wheelchair mobility appear (e.g. "Portable ramp" or "Wheelchair maintenance kit" or similar)
- Items related to medication appear (e.g. "Medications (7-day supply)" or "Prescription medication")
- These items are present in the list alongside the standard base items (passport, charger, etc.)

**If accessibility items do NOT appear:** This is the known fix from the health check phase that needs real-world verification. Report to Claude with:
- A screenshot of the full packing list
- The exact text you entered in the accessibility notes field

---

### I2. Check some packing items, reload the page, confirm persistence

**Action:**
1. On the packing page, check 3–5 items by clicking their checkboxes
2. Note which items you checked
3. Press F5 to reload the page

**Expected result:**
- The items you checked are still checked after reload
- The progress bar (checked/total) reflects the correct count
- Unchecked items remain unchecked

**If checked state is lost on reload:** This is a DB persistence failure — report to Claude. The checked state should be stored in the database, not in browser localStorage.

---

### I3. Add a custom packing item

**Action:**
1. On the packing page, find the "Add custom item" form
2. Enter a label (e.g. `Snorkel mask`) and select a category (e.g. `accessories`)
3. Optionally mark it as essential
4. Submit the form

**Expected result:**
- The new item appears in the list under the selected category
- If you marked it essential, it has a visual distinction from non-essential items
- After a page reload, the custom item is still there

---

## J. Authorization — Accessing Another User's Trip

### J1. Try to access another user's trip URL directly

> **This test requires two accounts. You need to have created at least two accounts.**

**Action:**
1. Log in as User A (the account from A1)
2. Create a trip and note its URL, e.g. `http://localhost:3000/trips/abc123`
3. Log out
4. Sign up or log in as User B (a different email)
5. Manually navigate to User A's trip URL: `http://localhost:3000/trips/abc123`

**Expected result:**
- You do NOT see User A's trip data
- You are either redirected (to `/dashboard` or `/login`) or shown a "Not found" / "Access denied" page
- Under no circumstances should User B see User A's trip itinerary, budget, or packing list

**If you CAN see User A's trip as User B:** This is a critical authorization bug — report immediately to Claude. Include the trip ID and both user emails (or any identifying info).

**If you get a 500 error with a visible stack trace:** Report to Claude — the error boundary should show a generic error page, not a stack trace.

---

## K. Error Boundaries

### K1. Confirm error boundaries show generic messages

**Action:**
1. If you saw any server errors during the above tests (pages failing to load, 500 responses), note what the browser showed you

**Expected result:**
- Any error page shown to you contains a generic message ("Something went wrong" or similar)
- No page shows a raw stack trace, file paths like `D:\Travel app\roamwise\...`, or internal database error messages
- The error page has a "try again" or "go back" link

**If a stack trace or internal error details are visible in the browser:** Screenshot and report to Claude — this is a security issue (information leakage).

---

## Summary Checklist

| Test | Pass | Fail | Notes |
|---|---|---|---|
| A1. Signup new account | | | |
| A2. Logout | | | |
| A3. Login | | | |
| A4. Session persists on refresh | | | |
| A5. Duplicate email rejected | | | |
| A6. Wrong password rejected | | | |
| A7. Rate limit after 5 failed attempts | | | |
| B1. Create trip with valid data | | | |
| B2. Bad dates rejected | | | |
| B3. >20 travelers rejected | | | |
| B4. Zero/negative budget rejected | | | |
| C1. Itinerary generates | | | |
| C2. Reasoning text is contextual | | | |
| D1. AI discovery — real prompt | | | |
| D2. AI discovery — vague prompt | | | |
| E1. Group alignment with conflict | | | |
| F1. Route page and optimal card | | | |
| G1. Replan reject — state unchanged | | | |
| G2. Replan accept — state changes and persists | | | |
| H1. Hotel selection updates budget | | | |
| H2. Hotel removal reverts budget | | | |
| I1. Accessibility items in packing list | | | |
| I2. Checked state persists on reload | | | |
| I3. Custom item add | | | |
| J1. Other user's trip is blocked | | | |
| K1. Error pages show generic messages | | | |
