# PLANNER V2 NEXT STEPS

## Future Training Data (Foundation)
With V2's deterministic evaluation, we can begin capturing structural output metrics in the future to train local specialized models.

1. **Telemetry Schema**:
   Store generation outcomes linked to the inputs. 
   - `candidate_pool_size`, `places_selected`, `avg_distance_km`, `budget_ratio`.
2. **Quality Rating Loop**:
   When users edit itineraries (e.g. swap places, change times), record the delta. These edits signal "user preference > heuristic".
3. **Model Fine-Tuning**:
   Once enough high-quality, unedited (or positively edited) deterministic trips are logged, we can distill the heuristic logic back into a much smaller, faster LLM for edge-case reasoning.

## Immediate Improvements
- Proceed with **OSM Enrichment (Restaurant & Cafe)**: The Planner engine needs diverse food options rather than generic 'dining' fallbacks.
- **Admin Review Workflow**: Flag and fix any known closed transport nodes masquerading as attractions.
