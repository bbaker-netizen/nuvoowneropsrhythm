// Forwards the app's Monday.com GraphQL calls using the server-held token,
// so no API token ships in the public HTML.
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const token = Netlify.env.get("MONDAY_TOKEN");
  if (!token) return json({ errors: [{ message: "MONDAY_TOKEN is not configured on the server." }] }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON" }, 400); }

  const resp = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": token, "API-Version": "2024-10" },
    body: JSON.stringify({ query: body.query, variables: body.variables || {} })
  });
  const text = await resp.text();
  return new Response(text, { status: resp.status, headers: { "Content-Type": "application/json" } });
};

export const config = { path: "/api/monday-proxy" };
