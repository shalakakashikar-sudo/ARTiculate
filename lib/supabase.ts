
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gocokntqtswmzyqfpyub.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvY29rbnRxdHN3bXp5cWZweXViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MTY3MTYsImV4cCI6MjA4NTE5MjcxNn0.If_fDU0pL3fRKZ9fwGWJBxyaNUmvBBUFmk961i6b3do';

export const isSupabaseConfigured = true;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
