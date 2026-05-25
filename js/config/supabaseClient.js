import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = 'https://lbxsremcewvwmkjgffmo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxieHNyZW1jZXd2d21ramdmZm1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NzQ0MjksImV4cCI6MjA5NDI1MDQyOX0.drNHgfpe4ts4nzzq25IEXOrbpRfQlaQBhGSHmHjwbJ0'
export const supabase = createClient(supabaseUrl, supabaseKey)