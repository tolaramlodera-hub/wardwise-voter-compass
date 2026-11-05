import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "लॉगिन आवश्यक है।" }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL"); const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return json({ error: "Supabase configuration missing." }, 500);
  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: authHeader } });
  if (!authResponse.ok) return json({ error: "लॉगिन सत्र अमान्य है। दोबारा लॉगिन करें।" }, 401);
  const user = await authResponse.json() as { id?: string }; if (!user.id) return json({ error: "लॉगिन उपयोगकर्ता नहीं मिला।" }, 401);
  const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?user_id=eq.${encodeURIComponent(user.id)}&select=role,is_active&limit=1`, { headers: { apikey: anonKey, Authorization: authHeader } });
  if (!profileResponse.ok) return json({ error: "यूजर अधिकार जाँचे नहीं जा सके।" }, 403);
  const profiles = await profileResponse.json() as { role: string; is_active: boolean }[];
  if (!profiles[0]?.is_active || profiles[0]?.role !== "admin") return json({ error: "केवल एडमिन इस सुविधा का उपयोग कर सकता है।" }, 403);
  const token = Deno.env.get("VERCEL_API_TOKEN"); if (!token) return json({ configured: false, deployments: [] });
  let range = "24h"; try { const body = await req.json() as { range?: string }; if (["24h", "7d", "30d"].includes(body.range ?? "")) range = body.range!; } catch { /* default */ }
  const rangeMs = range === "24h" ? 86400000 : range === "7d" ? 7 * 86400000 : 30 * 86400000;
  const params = new URLSearchParams({ projectId: "prj_8dGQVSfuCuaiKw7rWMUCNZ0kX3Rw", limit: "50", from: String(Date.now() - rangeMs), teamId: "team_j9Jq6DcV590hVeyKbLXuotvs" });
  const response = await fetch(`https://api.vercel.com/v6/deployments?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) { const detail = await response.text(); console.error("Vercel API error", response.status, detail.slice(0, 500)); return json({ configured: true, deployments: [], error: response.status === 401 ? "Vercel Token अमान्य है। Supabase Secret अपडेट करें।" : "Vercel से Build History नहीं मिल सकी। Token की अनुमति और Project access जाँचें।" }, 502); }
  const result = await response.json() as { deployments?: Record<string, unknown>[] };
  const deployments = (result.deployments ?? []).map((d) => ({ uid: d.uid, name: d.name, url: d.url ?? null, state: d.state ?? d.readyState ?? "UNKNOWN", target: d.target ?? null, createdAt: d.createdAt ?? d.created ?? Date.now(), ready: d.ready ?? null, meta: d.meta ?? {} }));
  return json({ configured: true, deployments });
});
