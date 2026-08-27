// ============================================================
// SHOPEE JOURNEY
// SUPABASE CONFIG
// ============================================================

const SUPABASE_URL =
  'https://wvykxxvnpqnutpgdqhjd.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_ZAZUKDLPG52-rLvWKRyoeg_O_uga5HE';


// Cliente Supabase
const journeySupabase =
  window.supabase.createClient(
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
