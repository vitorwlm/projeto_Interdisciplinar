// Importa o construtor do cliente do Supabase diretamente de um CDN (sem precisar de instalar pacotes)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// O URL do teu projeto (já configurado para o teu projeto 'lbxsremcewvwmkjgffmo')
const supabaseUrl = 'https://lbxsremcewvwmkjgffmo.supabase.co'

// Substitui este texto pela tua chave "anon public" real que encontras no painel do Supabase
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxieHNyZW1jZXd2d21ramdmZm1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NzQ0MjksImV4cCI6MjA5NDI1MDQyOX0.drNHgfpe4ts4nzzq25IEXOrbpRfQlaQBhGSHmHjwbJ0'

// Inicializa o cliente do Supabase e exporta-o para que outros ficheiros o possam usar
export const supabase = createClient(supabaseUrl, supabaseKey)