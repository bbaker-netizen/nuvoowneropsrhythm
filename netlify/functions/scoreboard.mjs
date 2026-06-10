import { getStore } from "@netlify/blobs";

// Public read endpoint for the Partnership Scoreboard (nuvoscorecard.netlify.app).
// Returns ONLY finalized records, and ONLY the fields the public board shows:
// grade, status, keyNumber. Reason, forward commitment, communicate, due,
// confirmed and the system check are captured for the record — never published.
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store"
    }
  });

export default async (req) => {
  if (req.method !== "GET") return json({ error: "method not allowed" }, 405);
  const store = getStore({ name: "grading", consistency: "strong" });
  const index = (await store.get("weeks", { type: "json" })) || [];
  const weeks = [];
  for (const w of index) {
    const doc = await store.get(`week:${w}`, { type: "json" });
    if (!doc || !doc.areas) continue;
    const entries = {};
    for (const [id, a] of Object.entries(doc.areas)) {
      if (a.state !== "final" || !a.grade) continue;
      entries[id] = { grade: a.grade, status: a.status || "", keyNumber: a.keyNumber || "" };
    }
    if (Object.keys(entries).length) weeks.push({ weekOf: w, entries });
  }
  return json({ generated: new Date().toISOString(), weeks });
};

export const config = { path: "/api/scoreboard" };
