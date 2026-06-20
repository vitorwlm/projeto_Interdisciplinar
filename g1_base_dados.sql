-- ============================================================================
-- UniCo - Script completo da base de dados (PostgreSQL / Supabase)
-- Projeto Interdisciplinar PI1 . DTAM 2025/2026 . ESMAD - P.PORTO
-- Grupo 1 . Vitor Lima . Nuno Tiago
--
-- Este script recria do zero toda a estrutura: extensoes, esquema de
-- autenticacao (stub), tabelas, chaves, restricoes (CHECK/UNIQUE/FK),
-- indices, dados de exemplo (seed ficticio) e politicas de seguranca (RLS).
--
-- Corre sem erros numa base de dados PostgreSQL limpa (>= 13) e tambem
-- diretamente no Supabase (Dashboard -> SQL Editor -> New query -> Run).
-- Motor de referencia: PostgreSQL 17.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Pre-requisitos: extensoes e stub de autenticacao
--    Em PostgreSQL puro, o esquema "auth" do Supabase nao existe. Os blocos
--    abaixo criam um stub minimo SE necessario, sem afetar uma BD Supabase
--    real (onde o esquema/funcao ja existem e nao sao recriados).
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;   -- fornece gen_random_uuid()

do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'auth') then
    execute 'create schema auth';
  end if;
end $$;

-- Tabela de autenticacao (no Supabase ja existe; aqui garantimos o minimo).
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid()
);

-- Funcao auth.uid(): devolve o utilizador da sessao. So e criada se ainda
-- nao existir, para nunca substituir a implementacao real do Supabase.
do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    execute $f$ create function auth.uid() returns uuid
                language sql stable as 'select null::uuid' $f$;
  end if;
end $$;

-- ============================================================================
-- 1. TABELAS
-- ============================================================================

-- 1.1 UTILIZADOR ------------------------------------------------------------
-- Perfil de cada utilizador. O id e o mesmo do auth.users (Supabase Auth):
-- relacao 1:1 identificadora com o subsistema de autenticacao.
create table if not exists public.utilizador (
  id          uuid        primary key references auth.users(id) on delete cascade,
  name        text        not null,
  university  text,
  avatar_url  text,
  email       text        unique,
  is_admin    boolean     not null default false,
  bio         text,
  created_at  timestamptz not null default now()
);

-- 1.2 CATEGORIA -------------------------------------------------------------
-- Grupos que organizam os artigos (ex.: Manuais, Informatica, Moda).
create table if not exists public.categoria (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  icon_url    text,
  created_at  timestamptz
);

-- 1.3 ITEM ------------------------------------------------------------------
-- Artigo (anuncio) publicado para venda/troca por um vendedor.
create table if not exists public.item (
  id           uuid       primary key default gen_random_uuid(),
  seller_id    uuid       not null references public.utilizador(id),
  category_id  uuid       references public.categoria(id),
  title        text,
  description  text,
  price        numeric,
  wear_status  text       constraint chk_wear_status
                          check (wear_status in
                            ('novo','como_novo','bom','satisfatorio','usado','muito_usado')),
  sell_status  text       constraint chk_sell_status
                          check (sell_status in ('disponivel','reservado','vendido')),
  created_at   timestamp                       -- sem fuso, por opcao da equipa
);

-- 1.4 ITEM_IMAGE ------------------------------------------------------------
-- Fotografias de um item (ate 5 por anuncio). Uma pode ser a principal.
create table if not exists public.item_image (
  id            uuid        primary key default gen_random_uuid(),
  item_id       uuid        not null references public.item(id) on delete cascade,
  image_url     text,
  is_principal  boolean,
  created_at    timestamptz
);

-- 1.5 FAVORITO --------------------------------------------------------------
-- Anuncios guardados por um utilizador. Tabela de juncao (N:M) com PK composta.
create table if not exists public.favorito (
  user_id     uuid        not null references public.utilizador(id) on delete cascade,
  item_id     uuid        not null references public.item(id) on delete cascade,
  created_at  timestamptz,
  primary key (user_id, item_id)
);

-- 1.6 TRANSACAO -------------------------------------------------------------
-- Registo de uma compra/venda de um item entre comprador e vendedor.
create table if not exists public.transacao (
  id           uuid        primary key default gen_random_uuid(),
  item_id      uuid        not null references public.item(id) on delete cascade,
  buyer_id     uuid        not null references public.utilizador(id),
  seller_id    uuid        not null references public.utilizador(id),
  final_price  numeric     not null check (final_price >= 0),
  status       text        not null default 'pendente'
                          check (status in ('pendente','concluida','cancelada')),
  created_at   timestamptz not null default now()
);

-- 1.7 CONVERSA --------------------------------------------------------------
-- Chat entre um comprador e o vendedor sobre um item.
create table if not exists public.conversa (
  id          uuid        primary key default gen_random_uuid(),
  item_id     uuid        references public.item(id) on delete cascade,
  buyer_id    uuid        references public.utilizador(id) on delete cascade,
  seller_id   uuid        references public.utilizador(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint uq_conversa unique (item_id, buyer_id, seller_id)
);

-- 1.8 MENSAGEM --------------------------------------------------------------
-- Cada mensagem trocada dentro de uma conversa.
create table if not exists public.mensagem (
  id           uuid        primary key default gen_random_uuid(),
  conversa_id  uuid        not null references public.conversa(id) on delete cascade,
  sender_id    uuid        references public.utilizador(id) on delete cascade,
  content      text        not null,
  seen         boolean     not null default false,
  created_at   timestamptz not null default now()
);

-- ============================================================================
-- 2. INDICES SECUNDARIOS (apoiam as listagens mais frequentes da aplicacao)
-- ============================================================================
create index if not exists idx_item_seller      on public.item(seller_id);
create index if not exists idx_item_category     on public.item(category_id);
create index if not exists idx_item_image_item   on public.item_image(item_id);
create index if not exists idx_favorito_user     on public.favorito(user_id);
create index if not exists idx_conversa_buyer    on public.conversa(buyer_id);
create index if not exists idx_conversa_seller   on public.conversa(seller_id);
create index if not exists idx_mensagem_conversa on public.mensagem(conversa_id, created_at);

-- ============================================================================
-- 3. FUNCAO AUXILIAR is_admin()
-- Usada nas politicas de seguranca para saber se a sessao atual e admin.
-- SECURITY DEFINER evita recursao de RLS ao ler a tabela utilizador.
-- ============================================================================
create or replace function public.is_admin() returns boolean
  language sql stable security definer
  set search_path = public
as $$
  select exists (
    select 1 from public.utilizador
    where id = auth.uid() and is_admin = true
  );
$$;

-- ============================================================================
-- 4. DADOS DE EXEMPLO (SEED FICTICIO)
-- Dados inventados, apenas para teste/demonstracao. Inserir antes de ativar
-- o RLS garante que o seed corre numa BD limpa sem depender de sessao.
-- ============================================================================

-- 4.1 Utilizadores (primeiro em auth.users por causa da FK)
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333')
on conflict (id) do nothing;

insert into public.utilizador (id, name, university, email, is_admin, bio) values
  ('11111111-1111-1111-1111-111111111111', 'Ana Martins',  'ESMAD - P.PORTO', 'ana.demo@exemplo.pt',   true,  'Administradora da comunidade UniCo.'),
  ('22222222-2222-2222-2222-222222222222', 'Bruno Costa',  'ESMAD - P.PORTO', 'bruno.demo@exemplo.pt', false, 'Vendo manuais e material que ja nao uso.'),
  ('33333333-3333-3333-3333-333333333333', 'Carla Sousa',  'ESMAD - P.PORTO', 'carla.demo@exemplo.pt', false, 'A procura de equipamento em segunda mao.')
on conflict (id) do nothing;

-- 4.2 Categorias
insert into public.categoria (id, name, icon_url, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Manuais',                'book.svg',    now()),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Informatica',            'laptop.svg',  now()),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Moda',                   'shirt.svg',   now()),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Material de Laboratorio','flask.svg',   now())
on conflict (id) do nothing;

-- 4.3 Itens (anuncios)
insert into public.item (id, seller_id, category_id, title, description, price, wear_status, sell_status, created_at) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000001', 'Manual de Calculo I',        'Edicao recente, sem riscos.',            12.50, 'como_novo', 'disponivel', now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000002', 'Rato sem fios',              'Funciona perfeitamente, pouco uso.',      8.00, 'bom',       'disponivel', now()),
  ('bbbbbbbb-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000002', 'Monitor 24 polegadas',       'Full HD, com cabo HDMI incluido.',       60.00, 'usado',     'reservado',  now()),
  ('bbbbbbbb-0000-0000-0000-000000000004', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000003', 'Casaco de ganga',            'Tamanho M, muito bom estado.',           15.00, 'bom',       'vendido',    now())
on conflict (id) do nothing;

-- 4.4 Imagens dos itens
insert into public.item_image (id, item_id, image_url, is_principal, created_at) values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'manual_calc_1.jpg',  true,  now()),
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'rato_sem_fios.jpg',  true,  now()),
  ('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000003', 'monitor_24.jpg',     true,  now())
on conflict (id) do nothing;

-- 4.5 Favoritos (a Carla guardou itens do Bruno)
insert into public.favorito (user_id, item_id, created_at) values
  ('33333333-3333-3333-3333-333333333333', 'bbbbbbbb-0000-0000-0000-000000000001', now()),
  ('33333333-3333-3333-3333-333333333333', 'bbbbbbbb-0000-0000-0000-000000000002', now())
on conflict (user_id, item_id) do nothing;

-- 4.6 Transacao: o Bruno (comprador) comprou o casaco a Carla (vendedora)
insert into public.transacao (id, item_id, buyer_id, seller_id, final_price, status, created_at) values
  ('dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000004',
   '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333',
   15.00, 'concluida', now())
on conflict (id) do nothing;

-- 4.7 Conversa + mensagens (Carla pergunta ao Bruno sobre o manual)
insert into public.conversa (id, item_id, buyer_id, seller_id, created_at) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
   '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', now())
on conflict (item_id, buyer_id, seller_id) do nothing;

insert into public.mensagem (id, conversa_id, sender_id, content, seen, created_at) values
  ('ffffffff-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Ola! O manual ainda esta disponivel?', true,  now()),
  ('ffffffff-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Ola Carla, sim esta! Queres combinar a entrega?', false, now())
on conflict (id) do nothing;

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- Cada tabela so deixa o utilizador ver/alterar aquilo a que tem direito.
-- ============================================================================
alter table public.utilizador enable row level security;
alter table public.categoria  enable row level security;
alter table public.item       enable row level security;
alter table public.item_image enable row level security;
alter table public.favorito   enable row level security;
alter table public.transacao  enable row level security;
alter table public.conversa   enable row level security;
alter table public.mensagem   enable row level security;

-- 5.1 UTILIZADOR: perfis publicos; cada um cria/edita o seu; admin pode editar todos
create policy "profiles_select"       on public.utilizador for select using (true);
create policy "profiles_insert"       on public.utilizador for insert with check (auth.uid() = id);
create policy "profiles_update"       on public.utilizador for update using (auth.uid() = id);
create policy "profiles_admin_update" on public.utilizador for update using (public.is_admin()) with check (public.is_admin());

-- 5.2 CATEGORIA: todos leem; so administradores criam/editam/apagam
create policy "categories_select" on public.categoria for select using (true);
create policy "categories_insert" on public.categoria for insert with check (public.is_admin());
create policy "categories_update" on public.categoria for update using (public.is_admin());
create policy "categories_delete" on public.categoria for delete using (public.is_admin());

-- 5.3 ITEM: todos leem; o vendedor cria/edita; vendedor ou admin apaga
create policy "items_select" on public.item for select using (true);
create policy "items_insert" on public.item for insert with check (auth.uid() = seller_id);
create policy "items_update" on public.item for update using (auth.uid() = seller_id);
create policy "items_delete" on public.item for delete
  using (auth.uid() = seller_id or public.is_admin());
-- Permite a um comprador autenticado marcar o item como reservado/vendido
create policy "comprador marca item como vendido" on public.item for update
  using (auth.uid() is not null)
  with check (sell_status in ('disponivel','reservado','vendido'));

-- 5.4 ITEM_IMAGE: todos leem; so o dono do item gere as imagens
create policy "item_images_select" on public.item_image for select using (true);
create policy "item_images_insert" on public.item_image for insert
  with check (exists (select 1 from public.item where id = item_image.item_id and seller_id = auth.uid()));
create policy "item_images_delete" on public.item_image for delete
  using (exists (select 1 from public.item where id = item_image.item_id and seller_id = auth.uid()));

-- 5.5 FAVORITO: cada um so ve e gere os seus favoritos
create policy "favoritos_select" on public.favorito for select using (auth.uid() = user_id);
create policy "favoritos_insert" on public.favorito for insert with check (auth.uid() = user_id);
create policy "favoritos_delete" on public.favorito for delete using (auth.uid() = user_id);

-- 5.6 TRANSACAO: visivel a comprador e vendedor; comprador cria; vendedor atualiza
create policy "transacoes_select" on public.transacao for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "transacoes_insert" on public.transacao for insert with check (auth.uid() = buyer_id);
create policy "transacoes_update" on public.transacao for update using (auth.uid() = seller_id);

-- 5.7 CONVERSA: visivel aos participantes; criada pelo comprador
create policy "conversas_select" on public.conversa for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "conversas_insert" on public.conversa for insert with check (auth.uid() = buyer_id);

-- 5.8 MENSAGEM: visivel aos participantes; autor envia; o outro pode marcar como vista
create policy "mensagens_select" on public.mensagem for select
  using (exists (select 1 from public.conversa c
    where c.id = conversa_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())));
create policy "mensagens_insert" on public.mensagem for insert
  with check (auth.uid() = sender_id and exists (select 1 from public.conversa c
    where c.id = conversa_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())));
create policy "mensagens_update" on public.mensagem for update
  using (auth.uid() <> sender_id and exists (select 1 from public.conversa c
    where c.id = conversa_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())));

-- ============================================================================
-- Fim do script. A base de dados fica pronta a usar.
-- ============================================================================
