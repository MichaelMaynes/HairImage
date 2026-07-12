// Hair Image Supabase browser configuration.
// The publishable key is intentionally usable in browser code.
// Database access is protected by Row Level Security policies.

(() => {
  const SUPABASE_URL = "https://dektgiqkxkllnwjpeylu.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_dX8cW4dvWQ1OxgYPb8-42g_g-_5ABlk";

  if (!window.supabase) {
    console.error("Supabase library failed to load.");
    return;
  }

  window.hairImageSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
})();
