import { getStore } from "@netlify/blobs";

// Admin (Bruce) endpoint. Every action requires the passcode held in the
// NUVO_FINALIZE_PASSCODE environment variable — checked here, server-side.
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
const ADMIN_FIELDS = ["grade", "status", "keyNumber", "reason", "forwardCommitment", "due", "communicate", "confirmed"];
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
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const pass = Netlify.env.get("NUVO_FINALIZE_PASSCODE");
  if (!pass) return json({ error: "Finalize passcode is not configured on the server." }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON" }, 400); }
  if (!body || typeof body.passcode !== "string" || body.passcode !== pass) {
    return json({ error: "Wrong passcode." }, 401);
  }

  const store = getStore({ name: "grading", consistency: "strong" });
  const action = body.action;
  const week = body.week;

  if (action === "check") {
    const weeks = (await store.get("weeks", { type: "json" })) || [];
    let doc = null;
    if (week && WEEK_RE.test(week)) {
      doc = (await store.get(`week:${week}`, { type: "json" })) || emptyWeek(week);
    }
    return json({ ok: true, weeks, week: doc });
  }

  if (action === "save" || action === "final") {
    if (!week || !WEEK_RE.test(week)) return json({ error: "week=YYYY-MM-DD required" }, 400);
    const key = `week:${week}`;
    const doc = (await store.get(key, { type: "json" })) || emptyWeek(week);
    const now = new Date().toISOString();

    for (const [id, patch] of Object.entries(body.areas || {})) {
      if (!AREAS[id] || !patch || typeof patch !== "object") continue;
      if (!doc.areas[id]) doc.areas[id] = emptyArea();
      const target = doc.areas[id];
      for (const f of ADMIN_FIELDS) {
        if (!(f in patch)) continue;
        let v = String(patch[f] ?? "");
        if (f === "grade" && v && !GRADES.includes(v)) return json({ error: `invalid grade for ${id}` }, 400);
        if (f === "status" && v && !STATUSES.includes(v)) return json({ error: `invalid status for ${id}` }, 400);
        if (f === "confirmed") v = v === "yes" ? "yes" : "no";
        target[f] = v;
      }
      target.updatedBy = "Bruce";
      target.updatedAt = now;
    }
    if (typeof body.systemCheck === "string") doc.systemCheck = body.systemCheck;
    doc.updatedAt = now;

    if (action === "final") {
      for (const a of Object.values(doc.areas)) a.state = "final";
      doc.finalizedAt = now;
    }

    await store.setJSON(key, doc);
    const weeks = (await store.get("weeks", { type: "json" })) || [];
    if (!weeks.includes(week)) { weeks.push(week); weeks.sort(); await store.setJSON("weeks", weeks); }
    return json({ ok: true, week: doc, weeks });
  }

  if (action === "delete") {
    if (!week || !WEEK_RE.test(week)) return json({ error: "week=YYYY-MM-DD required" }, 400);
    await store.delete(`week:${week}`);
    let weeks = (await store.get("weeks", { type: "json" })) || [];
    weeks = weeks.filter(w => w !== week);
    await store.setJSON("weeks", weeks);
    return json({ ok: true, weeks });
  }

  return json({ error: "unknown action" }, 400);
};

export const config = { path: "/api/finalize" };
