// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { stringify } from "https://deno.land/std@0.224.0/csv/mod.ts";

serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: req.headers.get("Authorization")! } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const { data: fasts } = await supabase
    .from("fasts")
    .select("*")
    .gte("start_at", from || "1970-01-01T00:00:00Z")
    .lte("end_at", to || new Date().toISOString())
    .order("start_at");

  const { data: logs } = await supabase
    .from("supplement_logs")
    .select("*, supplements(name, unit)")
    .gte("taken_at", from || "1970-01-01T00:00:00Z")
    .lte("taken_at", to || new Date().toISOString())
    .order("taken_at");

  const fastsCsv = stringify(fasts || [], { headers: true });
  const logsCsv = stringify(
    (logs || []).map(l => ({
      ...l,
      supplement_name: l.supplements?.name,
      supplement_unit: l.supplements?.unit
    })),
    { headers: true }
  );

  const boundary = "CSV_BOUNDARY";
  const body = `--${boundary}
Content-Type: text/csv
Content-Disposition: attachment; filename="fasts.csv"

${fastsCsv}
--${boundary}
Content-Type: text/csv
Content-Disposition: attachment; filename="supplement_logs.csv"

${logsCsv}
--${boundary}--`;

  return new Response(body, {
    headers: { "Content-Type": `multipart/mixed; boundary=${boundary}` },
  });
});
