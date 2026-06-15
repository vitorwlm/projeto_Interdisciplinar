-- ============================================================================
-- UniCo · Esquema completo da base de dados (PostgreSQL / Supabase)
-- Projeto Interdisciplinar PI1 · DTAM 2025/2026 · ESMAD – P.PORTO
--
-- Este script recria toda a base de dados a partir do zero: tabelas, chaves,
-- restricoes de integridade, indices e politicas de seguranca (RLS).
-- Corre no Supabase: Dashboard -> SQL Editor -> New query -> Run.
--
-- Esquema obtido a partir do projeto Supabase "ProjetoInterdisciplinar".
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. UTILIZADOR
-- Perfil de cada utilizador. O id e o mesmo do auth.users do Supabase (Auth).
-- ----------------------------------------------------------------------------
create table if not exists public.utilizador (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  university  text,
  avatar_url  text,
  email       text unique,
  is_admin    boolean not null default false,
  bio         text,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. CATEGORIA
-- Grupos que organizam os artigos (ex.: Moda, Manuais, Informatica).
-- ----------------------------------------------------------------------------
create table if not exists public.categoria (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  icon_url    text,
  created_at  timestamptz
);

-- ----------------------------------------------------------------------------
-- 3. ITEM (anuncio)
-- Artigo publicado para venda/troca.
-- ----------------------------------------------------------------------------
create table if not exists public.item (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references public.utilizador(id),
  category_id  uuid references public.categoria(id),
  title        text,
  description  text,
  price        numeric,
  wear_status  text check (wear_status in ('novo','como_novo','bom','usado','muito_usado')),
  sell_status  text check (sell_status in ('disponivel','reservado','vendido')),
  created_at   timestamp
);

-- ----------------------------------------------------------------------------
-- 4. ITEM_IMAGE
-- Fotografias de um item (ate 5 por anuncio). Uma pode ser a principal.
-- ----------------------------------------------------------------------------
create table if not exists public.item_image (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references public.item(id) on delete cascade,
  image_url     text,
  is_principal  boolean,
  created_at    timestamptz
);

-- ----------------------------------------------------------------------------
-- 5. FAVORITO
-- Anuncios guardados por um utilizador. Chave primaria composta.
-- ----------------------------------------------------------------------------
create table if not exists public.favorito (
  user_id     uuid not null references public.utilizador(id) on delete cascade,
  item_id     uuid not null references public.item(id) on delete cascade,
  created_at  timestamptz,
  primary key (user_id, item_id)
);

-- ----------------------------------------------------------------------------
-- 6. TRANSACAO
-- Registo de uma compra/venda de um item entre comprador e vendedor.
-- ----------------------------------------------------------------------------
create table if not exists public.transacao (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.item(id) on delete cascade,
  buyer_id     uuid not null references public.utilizador(id),
  seller_id    uuid not null references public.utilizador(id),
  final_price  numeric not null check (final_price >= 0),
  status       text not null default 'pendente' check (status in ('pendente','concluida','cancelada')),
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 7. CONVERSA
-- Chat entre um comprador e o vendedor sobre um item. Uma por comprador/item.
-- ----------------------------------------------------------------------------
create table if not exists public.conversa (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid references public.item(id) on delete cascade,
  buyer_id    uuid references public.utilizador(id) on delete cascade,
  seller_id   uuid references public.utilizador(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (item_id, buyer_id)
);

-- ----------------------------------------------------------------------------
-- 8. MENSAGEM
-- Cada mensagem trocada dentro de uma conversa.
-- ----------------------------------------------------------------------------
create table if not exists public.mensagem (
  id           uuid primary key default gen_random_uuid(),
  conversa_id  uuid not null references public.conversa(id) on delete cascade,
  sender_id    uuid references public.utilizador(id) on delete cascade,
  content      text not null,
  seen         boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Indices para listagens rapidas
-- ----------------------------------------------------------------------------
create index if not exists idx_item_seller      on public.item(seller_id);
create index if not exists idx_item_category     on public.item(category_id);
create index if not exists idx_item_image_item   on public.item_image(item_id);
create index if not exists idx_favorito_user     on public.favorito(user_id);
create index if not exists idx_conversa_buyer    on public.conversa(buyer_id);
create index if not exists idx_conversa_seller   on public.conversa(seller_id);
create index if not exists idx_mensagem_conversa on public.mensagem(conversa_id, created_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
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

-- UTILIZADOR: perfis publicos; cada um so cria/edita o seu
create policy "profiles_select" on public.utilizador for select using (true);
create policy "profiles_insert" on public.utilizador for insert with check (auth.uid() = id);
create policy "profiles_update" on public.utilizador for update using (auth.uid() = id);

-- CATEGORIA: todos leem; so administradores criam/editam/apagam
create policy "categories_select" on public.categoria for select using (true);
create policy "categories_insert" on public.categoria for insert
  with check (exists (select 1 from public.utilizador where id = auth.uid() and is_admin = true));
create policy "categories_update" on public.categoria for update
  using (exists (select 1 from public.utilizador where id = auth.uid() and is_admin = true));
create policy "categories_delete" on public.categoria for delete
  using (exists (select 1 from public.utilizador where id = auth.uid() and is_admin = true));

-- ITEM: todos leem; o vendedor cria/edita; vendedor ou admin apaga
create policy "items_select" on public.item for select using (true);
create policy "items_insert" on public.item for insert with check (auth.uid() = seller_id);
create policy "items_update" on public.item for update using (auth.uid() = seller_id);
create policy "items_delete" on public.item for delete
  using (auth.uid() = seller_id
    or exists (select 1 from public.utilizador where id = auth.uid() and is_admin = true));
-- Permite a um comprador autenticado marcar o item como vendido/reservado
create policy "comprador marca item como vendido" on public.item for update
  using (auth.uid() is not null)
  with check (sell_status in ('disponivel','reservado','vendido'));

-- ITEM_IMAGE: todos leem; so o dono do item gere as imagens
create policy "item_images_select" on public.item_image for select using (true);
create policy "item_images_insert" on public.item_image for insert
  with check (exists (select 1 from public.item where id = item_image.item_id and seller_id = auth.uid()));
create policy "item_images_delete" on public.item_image for delete
  using (exists (select 1 from public.item where id = item_image.item_id and seller_id = auth.uid()));

-- FAVORITO: cada um so ve e gere os seus favoritos
create policy "favoritos_select" on public.favorito for select using (auth.uid() = user_id);
create policy "favoritos_insert" on public.favorito for insert with check (auth.uid() = user_id);
create policy "favoritos_delete" on public.favorito for delete using (auth.uid() = user_id);

-- TRANSACAO: visivel a comprador e vendedor; comprador cria; vendedor atualiza
create policy "transacoes_select" on public.transacao for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "transacoes_insert" on public.transacao for insert with check (auth.uid() = buyer_id);
create policy "transacoes_update" on public.transacao for update using (auth.uid() = seller_id);

-- CONVERSA: visivel aos participantes; criada pelo comprador
create policy "conversas_select" on public.conversa for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "conversas_insert" on public.conversa for insert with check (auth.uid() = buyer_id);

-- MENSAGEM: visivel aos participantes; autor envia; o outro pode marcar como vista
create policy "mensagens_select" on public.mensagem for select
  using (exists (select 1 from public.conversa c
    where c.id = conversa_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())));
create policy "mensagens_insert" on public.mensagem for insert
  with check (auth.uid() = sender_id and exists (select 1 from public.conversa c
    where c.id = conversa_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())));
create policy "mensagens_update" on public.mensagem for update
  using (auth.uid() <> sender_id and exists (select 1 from public.conversa c
    where c.id = conversa_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())));
