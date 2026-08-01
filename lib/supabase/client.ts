import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Validate env vars at runtime
if (!supabaseUrl || supabaseUrl === "https://your-project.supabase.co") {
  console.warn(
    "[Supabase] NEXT_PUBLIC_SUPABASE_URL is not set. Running in mock mode."
  );
}

export const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseAnonKey || "placeholder");
