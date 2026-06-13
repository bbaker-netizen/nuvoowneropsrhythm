import { getStore } from "@netlify/blobs";

// Meeting Notes read endpoint for the signed-in owner app.
// Aggregates the FINALIZED weekly meetings (the Wednesday operating-rhythm
// sessions) into a notes-and-commitments feed: per area, the forward
// commitment, its due date, and who it's to be communicated to, plus a
// lightweight per-meeting summary (areas reviewed, on/off track counts).
//
// systemCheck is Bruce's private weekly note and is NEVER returned here —
// same rule the grading and scoreboard endpoints follow.
const AREAS = {
  marketing:    { name: "Marketing Handoff",    owner: "Ben" },
  sales:        { name: "Sales",                owner: "Ben" },
  construction: { name: "Construction",         owner: "Ben" },
  financial:    { name: "Financial Management", owner: "Conrad" },
  production:   { name: "Production",           owner: "Conrad" },
  systems:      { name: "Systems",              owner: "Conrad" },
  admin:        { name: "Admin Support",        owner: "Conrad" }
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });

export default async (req) => {
  if (req.method !== "GET") return json({ error: "method not allowed" }, 405);

  const store = getStore({ name: "grading", consistency: "strong" });
  const index = (await store.get("weeks", { type: "json" })) || [];

  const meetings = [];
  for (const w of index) {
    const doc = await store.get(`week:${w}`, { type: "json" });
    if (!doc || !doc.areas) continue;
    // Only meetings Bruce has finalized show up as notes.
    const finalized = Object.values(doc.areas).some(a => a.state === "final");
    if (!finalized) continue;

    let reviewed = 0, onTrack = 0, offTrack = 0;
    const commitments = [];
    for (const [id, def] of Object.entries(AREAS)) {
      const a = doc.areas[id];
      if (!a || a.state !== "final") continue;
      if (a.grade) reviewed++;
      if (a.status === "On track") onTrack++;
      else if (a.status === "Off track") offTrack++;

      const text = (a.forwardCommitment || "").trim();
      if (text) {
        commitments.push({
          area: def.name,
          owner: def.owner,
          grade: a.grade || "",
          status: a.status || "",
          commitment: text,
          due: (a.due || "").trim(),
          communicate: (a.communicate || "").trim()
        });
      }
    }

    meetings.push({
      weekOf: w,
      finalizedAt: doc.finalizedAt || doc.updatedAt || "",
      reviewed,
      onTrack,
      offTrack,
      commitments
    });
  }

  // Newest meeting first.
  meetings.sort((a, b) => (b.weekOf || "").localeCompare(a.weekOf || ""));
  return json({ generated: new Date().toISOString(), meetings });
};

export const config = { path: "/api/meetings" };
