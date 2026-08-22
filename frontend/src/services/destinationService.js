// Candidate-destination access, kept separate from page components so
// RoutePlanner (and anything else) consumes a plain list rather than
// reaching into the API client / AppDataContext shape directly.
import { api } from "../api";

export function getCandidateDestinations(batchId) {
  return api.getBatchDestinations(batchId);
}

// Alternatives to show as secondary markers/rows next to the recommended
// destination -- real candidates from the same spatial search, just not #1.
export function pickAlternatives(destinations, selectedId, max = 4) {
  return destinations.filter((d) => d.destination_id !== selectedId).slice(0, max);
}
