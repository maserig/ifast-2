// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  const { data: fasts } = await supabase
    .from("fasts")
    .select("start_at")
    .order("start_at");

  let streak = 0, maxStreak = 0;
  let lastDate: string | null = null;

  for (const f of fasts || []) {
    const date = f.start_at.split("T")[0];
    if (!lastDate || new Date(date).getTime() - new Date(lastDate).getTime() <= 86400000) {
      streak++;
      maxStreak = Math.max(maxStreak, streak);
    } else {
      streak = 1;
    }
    lastDate = date;
  }

  const badgesToGive: string[] = [];
  if (maxStreak >= 7) badgesToGive.push("7_DAY_STREAK");
  if (fasts?.some(f => {
    const diff = new Date(f.start_at).getTime() - new Date(f.start_at).getTime();
    return diff >= 48 * 60 * 60 * 1000;
  })) {
    badgesToGive.push("FIRST_48H");
  }

  for (const code of badgesToGive) {
    const { data: badge } = await supabase.from("badges").select("id").eq("code", code).single();
    if (badge) {
      await supabase.from("user_badges").insert({ badge_id: badge.id });
    }
  }

  return new Response(JSON.stringify({ streak, maxStreak, badgesToGive }), {
    headers: { "Content-Type": "application/json" },
  });
});
