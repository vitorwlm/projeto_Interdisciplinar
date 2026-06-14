-- ============================================================================
-- UniCo · Tabelas de mensagens (chat entre comprador e vendedor)
-- Corre este script no Supabase: Dashboard → SQL Editor → New query → Run
-- ============================================================================

-- Uma "conversa" representa o chat de UM comprador com o vendedor sobre UM item.
create table if not exists public.conversa (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.item(id) on delete cascade,
  buyer_id   uuid not null references public.utilizador(id) on delete cascade,
  seller_id  uuid not null references public.utilizador(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Só pode existir uma conversa por comprador/item
  unique (item_id, buyer_id)
);

-- Cada mensagem pertence a uma conversa e tem um autor (sender).
create table if not exists public.mensagem (
  id          uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversa(id) on delete cascade,
  sender_id   uuid not null references public.utilizador(id) on delete cascade,
  content     text not null,
  created_at  timestamptz not null default now()
);

-- Índices para listar conversas e mensagens rapidamente
create index if not exists idx_conversa_buyer  on public.conversa(buyer_id);
create index if not exists idx_conversa_seller on public.conversa(seller_id);
create index if not exists idx_mensagem_conversa on public.mensagem(conversa_id, created_at);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

alter table public.conversa enable row level security;
alter table public.mensagem enable row level security;

-- Ver as conversas onde sou participante (comprador ou vendedor)
create policy "ver as minhas conversas"
  on public.conversa for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

-- Criar uma conversa (só como comprador)
create policy "criar conversa como comprador"
  on public.conversa for insert
  with check (auth.uid() = buyer_id);

-- Ver as mensagens das conversas onde sou participante
create policy "ver mensagens das minhas conversas"
  on public.mensagem for select
  using (
    exists (
      select 1 from public.conversa c
      where c.id = conversa_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

-- Enviar mensagem: tenho de ser o autor E participante da conversa
create policy "enviar mensagem nas minhas conversas"
  on public.mensagem for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversa c
      where c.id = conversa_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

-- ============================================================================
-- (Opcional) Permitir a um comprador marcar o item como vendido.
-- Necessário para o botão "Comprar" funcionar se a tua policy de UPDATE em
-- 'item' só permitir ao dono editar. Descomenta se precisares:
-- ============================================================================
-- create policy "comprador marca item como vendido"
--   on public.item for update
--   using (auth.uid() is not null)
--   with check (sell_status in ('disponivel', 'reservado', 'vendido'));
