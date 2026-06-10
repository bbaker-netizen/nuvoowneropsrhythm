import { getStore } from "@netlify/blobs";

// Fixed reference data: each owner grades ONLY the other owner's areas.
const AREAS = {
  marketing:    { name: "Marketing Handoff",    owner: "Ben",    grader: "Conrad" },
  sales:        { name: "Sales",                owner: "Ben",    grader: "Conrad" },
  construction: { name: "Construction",         owner: "Ben",    grader: "Conrad" },
  financial:    { name: "Financial Management", owner: "Conrad", grader: "Ben" },
  production:   { name: "Production",           owner: "Conrad", grader: "Ben" },
  systems:      { name: "Systems",              owner: "Conrad", grader: "Ben" },
  admin:        { name: "Admin Support",        owner: "Conrad", grader: "Ben" }
};
const GRADES = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-"];
const STATUSES = ["On track", "Off track"];
const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;

function emptyArea() {
  return { grade: "", status: "", keyNumber: "", reason: "", forwardCommitment: "", due: "", communicate: "", confirmed: "no", state: "tentative", updatedBy: "", updatedAt: "" };
}
function emptyWeek(weekOf) {
  const areas = {};
  for (const id of Object.keys(AREAS)) areas[id] = emptyArea();
  return { weekOf, areas, systemCheck: "", updatedAt: "", finalizedAt: "" };
}
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export default async (req) => {
  const store = getStore({ name: "grading", consistency: "strong" });

  if (req.method === "GET") {
    const week = new URL(req.url).searchParams.get("week");
    if (!week || !WEEK_RE.test(week)) return json({ error: "week=YYYY-MM-DD required" }, 400);
    const doc = (await store.get(`week:${week}`, { type: "json" })) || emptyWeek(week);
    const weeks = (await store.get("weeks", { type: "json" })) || [];
    const finalized = Object.values(doc.areas).some(a => a.state === "final");
    // systemCheck is Bruce's note — never sent to the owner screens
    const { systemCheck, ...pub } = doc;
    return json({ ...pub, weeks, finalized });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "invalid JSON" }, 400); }
    const { week, by, areas } = body || {};
    if (!week || !WEEK_RE.test(week)) return json({ error: "week=YYYY-MM-DD required" }, 400);
    if (by !== "Conrad" && by !== "Ben") return json({ error: "by must be Conrad or Ben" }, 400);
    if (!areas || typeof areas !== "object") return json({ error: "areas required" }, 400);

    const key = `week:${week}`;
    const doc = (await store.get(key, { type: "json" })) || emptyWeek(week);
    if (Object.values(doc.areas).some(a => a.state === "final")) {
      return json({ error: "This week has already been finalized by Bruce. Changes now go through him." }, 409);
    }

    const now = new Date().toISOString();
    for (const [id, patch] of Object.entries(areas)) {
      const def = AREAS[id];
      if (!def || !patch || typeof patch !== "object") continue;
      if (!doc.areas[id]) doc.areas[id] = emptyArea();
      const target = doc.areas[id];
      // Owners report their own number; the OTHER owner grades the area.
      const allowed = def.owner === by
        ? ["keyNumber"]
        : def.grader === by
          ? ["grade", "status", "reason", "forwardCommitment"]
          : [];
      let touched = false;
      for (const f of allowed) {
        if (!(f in patch)) continue;
        const v = String(patch[f] ?? "");
        if (f === "grade" && v && !GRADES.includes(v)) return json({ error: `invalid grade for ${id}` }, 400);
        if (f === "status" && v && !STATUSES.includes(v)) return json({ error: `invalid status for ${id}` }, 400);
        target[f] = v;
        touched = true;
      }
      if (touched) {
        target.state = "tentative";
        target.updatedBy = by;
        target.updatedAt = now;
      }
    }
    doc.updatedAt = now;
    await store.setJSON(key, doc);

    const weeks = (await store.get("weeks", { type: "json" })) || [];
    if (!weeks.includes(week)) { weeks.push(week); weeks.sort(); await store.setJSON("weeks", weeks); }

    const { systemCheck, ...pub } = doc;
    return json({ ok: true, ...pub, weeks, finalized: false });
  }

  return json({ error: "method not allowed" }, 405);
};

export const config = { path: "/api/grading" };
