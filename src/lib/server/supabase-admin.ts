import { createClient } from "@supabase/supabase-js";

function getEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

const supabaseUrl = getEnv("SUPABASE_URL", "VITE_SUPABASE_URL");
const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase server env vars. Set SUPABASE_SERVICE_ROLE_KEY (and SUPABASE_URL or VITE_SUPABASE_URL).",
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
