import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.SUPABASE_URL;
const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
export const SUPABASE_BUCKET = import.meta.env.SUPABASE_BUCKET || 'uploads';

if (!url || !serviceKey) {
  console.warn('[supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — uploads will fail');
}

export const supabase = createClient(url || '', serviceKey || '', {
  auth: { persistSession: false },
});

export function publicUrl(path: string): string {
  return supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path).data.publicUrl;
}
