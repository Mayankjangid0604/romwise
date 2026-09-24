# Collaboration Permission Matrix

This matrix documents the exact permissions implemented in the codebase for collaboration features.

| Action | Viewer | Member | Creator | Code Path |
| :--- | :---: | :---: | :---: | :--- |
| View trip | ✅ | ✅ | ✅ | `requireTripRole(tripId, "viewer")` (Page layout) |
| Create share link | ❌ | ❌ | ✅ | `src/app/actions/share.ts` -> `generateShareLink` (`requireTripRole(tripId, "creator")`) |
| Revoke share link | ❌ | ❌ | ✅ | `src/app/actions/share.ts` -> `revokeShareLink` (`requireTripRole(tripId, "creator")`) |
| Remove member | ❌ | ❌ | ✅ | `src/app/actions/group.ts` -> `removeGroupMember` (`requireTripRole(tripId, "creator")`) |
| Leave group (self) | ✅ | ✅ | ✅ | `src/app/actions/group.ts` -> `leaveGroup` (`requireTripRole(tripId, "viewer")`) |
| Vote | ❌ | ✅ | ✅ | `src/app/actions/collaboration.ts` -> `toggleVote` (`requireTripRole(tripId, "member")`) |
| Comment | ❌ | ✅ | ✅ | `src/app/actions/collaboration.ts` -> `addComment` (`requireTripRole(tripId, "member")`) |
| Delete comment (own) | ❌ | ✅ | ✅ | `src/app/actions/collaboration.ts` -> `deleteComment` (Checks `userId === session.user.id`) |
| Delete comment (any) | ❌ | ❌ | ✅ | `src/app/actions/collaboration.ts` -> `deleteComment` (`requireTripRole(tripId, "creator")`) |
| Reorder itinerary | ❌ | ✅ | ✅ | `src/app/api/trips/[id]/reorder/route.ts` (`hasTripRole(id, "member")`) |
| Generate itinerary | ❌ | ❌ | ✅ | Implied by trip state transitions generally managed by creator (and `generate-itinerary/route.ts` is a background job triggered by creator actions). |
| View Group Alignment | ✅ | ✅ | ✅ | `src/app/actions/alignment.ts` -> `getGroupAlignment` (`requireTripRole(tripId, "viewer")`) |
| Edit own preferences | ✅ | ✅ | ✅ | (Implicit: Any authenticated user who is a group member can update their own row in `TravelerPreference`) |

*Note: The `Item Alignment` feature was deemed unverified and has been removed in accordance with the project directives.*
