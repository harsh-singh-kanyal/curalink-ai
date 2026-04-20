const CT_BASE = "https://clinicaltrials.gov/api/v2/studies";

/**
 * ClinicalTrials.gov v2 — broad harvest with optional status filter.
 */
export async function searchClinicalTrials(condition, { pageSize = 100, maxPages = 3 } = {}) {
  const trials = [];
  let pageToken = null;
  let pages = 0;

  do {
    const params = new URLSearchParams({
      "query.cond": condition,
      pageSize: String(pageSize),
      format: "json",
    });
    if (pageToken) {
      params.set("pageToken", pageToken);
    }
    const url = `${CT_BASE}?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`ClinicalTrials.gov failed: ${res.status}`);
    }
    const json = await res.json();
    const studies = json.studies || [];
    for (const s of studies) {
      const p = s.protocolSection || {};
      const id = p.identificationModule?.nctId || "";
      const title = p.identificationModule?.briefTitle || p.identificationModule?.officialTitle || "";
      const status = p.statusModule?.overallStatus || "";
      const eligibility = p.eligibilityModule?.eligibilityCriteria || "";
      const contacts =
        (p.contactsLocationsModule?.centralContacts || [])
          .map((c) => [c.name, c.phone, c.email].filter(Boolean).join(" — "))
          .filter(Boolean) || [];
      const locations = (p.contactsLocationsModule?.locations || [])
        .map((l) => {
          const parts = [l.facility, l.city, l.state, l.country].filter(Boolean);
          return parts.join(", ");
        })
        .filter(Boolean);

      trials.push({
        source: "ClinicalTrials.gov",
        nctId: id,
        title,
        status,
        eligibility,
        locations,
        contacts,
        url: id ? `https://clinicaltrials.gov/study/${id}` : "",
        raw: s,
      });
    }
    pageToken = json.nextPageToken || null;
    pages += 1;
  } while (pageToken && pages < maxPages);

  return trials;
}
