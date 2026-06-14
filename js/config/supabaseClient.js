/*
 * supabaseClient.js — Ponto único de ligação à base de dados Supabase.
 *
 * Porquê um ficheiro dedicado?
 *   Centralizar a criação do cliente evita repetir as credenciais em cada
 *   ficheiro e garante que todos os módulos partilham a mesma instância.
 *   Se as credenciais ou o URL mudarem, só é preciso alterar este ficheiro.
 *
 * Porquê importar via esm.sh?
 *   O projeto usa ES Modules nativos no browser (sem bundler como Webpack).
 *   O esm.sh converte pacotes npm em módulos ESM compatíveis com browsers,
 *   permitindo importar o SDK do Supabase diretamente sem passos de build.
 *
 * Porquê exportar "supabase" em vez de url/key separados?
 *   O cliente já encapsula a autenticação e as chamadas à API — os outros
 *   módulos só precisam do objeto pronto a usar.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/*
 * URL do projeto Supabase — identifica qual instância da base de dados usar.
 * A chave "anon" (anónima) é pública e segura de expor no frontend:
 * o acesso real aos dados é controlado pelas Row Level Security (RLS)
 * policies definidas no Supabase, não pela chave em si.
 */
const supabaseUrl = 'https://lbxsremcewvwmkjgffmo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxieHNyZW1jZXd2d21ramdmZm1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NzQ0MjksImV4cCI6MjA5NDI1MDQyOX0.drNHgfpe4ts4nzzq25IEXOrbpRfQlaQBhGSHmHjwbJ0'

/*
 * Cria e exporta o cliente Supabase — este objeto expõe:
 *   .auth     → gestão de sessões (login, logout, registo)
 *   .from()   → queries à base de dados (SELECT, INSERT, UPDATE, DELETE)
 *   .storage  → upload/download de ficheiros (imagens dos anúncios)
 */
export const supabase = createClient(supabaseUrl, supabaseKey)
