import { createClient } from "@supabase/supabase-js";

const TABLE_NAME = "pm_dashboard_state";
const ROW_ID = "default";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("records, updated_at")
      .eq("id", ROW_ID)
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);

    return json({
      records: data?.records ?? null,
      updatedAt: data?.updated_at ?? null,
    });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { records?: unknown } | null;
    if (!body || !Array.isArray(body.records)) {
      return json({ error: "Request body must be JSON with a records array." }, 400);
    }

    const supabase = getSupabase();
    const updatedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .upsert(
        { id: ROW_ID, records: body.records, updated_at: updatedAt },
        { onConflict: "id" }
      )
      .select("updated_at")
      .single();

    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, updatedAt: data.updated_at });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}