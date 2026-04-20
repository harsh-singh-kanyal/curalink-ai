import { buildIntentLattice } from "./queryExpansion.js";
import { searchPubMed } from "./pubmed.js";
import { searchOpenAlex } from "./openalex.js";
import { searchClinicalTrials } from "./clinicaltrials.js";
import { mergePublications } from "./merge.js";
import { rankPublications, rankTrials } from "./ranking.js";

const PUBMED_MAX = 120;
const OPENALEX_PER_PAGE = 100;
const OPENALEX_PAGES = 2;
const TRIAL_PAGE = 100;
const TRIAL_MAX_PAGES = 3;

/**
 * Full retrieval funnel: breadth → merge → rank → top-K for LLM.
 */
export async function runRetrievalPipeline({
  message,
  disease,
  additionalQuery,
  location,
}) {
  const lattice = buildIntentLattice({
    disease,
    message,
    additionalQuery,
    location,
  });

  const intentText = [
    lattice.pubmedPrimary,
    lattice.openAlexPrimary,
    lattice.trialCondition,
    lattice.locationHint,
  ].join(" ");

  const [pubmedRaw, openAlexRaw, trialsRaw] = await Promise.all([
    searchPubMed(lattice.pubmedPrimary, { retmax: PUBMED_MAX }).catch((e) => {
      console.error("PubMed error", e);
      return [];
    }),
    searchOpenAlex(lattice.openAlexPrimary, {
      perPage: OPENALEX_PER_PAGE,
      pages: OPENALEX_PAGES,
    }).catch((e) => {
      console.error("OpenAlex error", e);
      return [];
    }),
    searchClinicalTrials(lattice.trialCondition, {
      pageSize: TRIAL_PAGE,
      maxPages: TRIAL_MAX_PAGES,
    }).catch((e) => {
      console.error("ClinicalTrials error", e);
      return [];
    }),
  ]);

  const mergedPubs = mergePublications(pubmedRaw, openAlexRaw);
  const rankedPubs = rankPublications(mergedPubs, intentText, { topN: 8 });
  const rankedTrials = rankTrials(trialsRaw, intentText, location, { topN: 8 });

  const trace = {
    name: "CuraLink Trace",
    intentLattice: lattice,
    funnel: {
      pubmedHarvested: pubmedRaw.length,
      openAlexHarvested: openAlexRaw.length,
      trialsHarvested: trialsRaw.length,
      mergedPublications: mergedPubs.length,
      afterRanking: {
        publications: rankedPubs.length,
        trials: rankedTrials.length,
      },
    },
    ranking: {
      publications: "Jaccard relevance + recency + log citations (OpenAlex)",
      trials: "Jaccard relevance + geo-aware boost + recruiting nudge",
    },
  };

  return {
    lattice,
    intentText,
    publications: rankedPubs,
    trials: rankedTrials,
    trace,
    rawCounts: {
      pubmed: pubmedRaw.length,
      openalex: openAlexRaw.length,
      trials: trialsRaw.length,
      merged: mergedPubs.length,
    },
  };
}
