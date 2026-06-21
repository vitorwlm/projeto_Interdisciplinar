-- ============================================================================
-- UniCo - Script de DADOS FICTICIOS (seed) para a base de dados real (Supabase)
-- Grupo 1 . Projeto Interdisciplinar PI1 . DTAM 2025/2026 . ESMAD
--
-- Cria 5 utilizadores ficticios (COM login funcional), 5 categorias e um
-- catalogo de demonstracao: itens, imagens, favoritos, transacoes, conversas
-- e mensagens. Todos os dados estao marcados com o dominio "@unico.demo" e
-- com UUIDs reconheciveis, para serem faceis de apagar (ver bloco final).
--
-- Palavra-passe de todos os utilizadores ficticios:  demo1234
--
-- Correr no Supabase: Dashboard -> SQL Editor -> New query -> cola -> Run.
-- (Pensado para correr UMA vez numa BD onde estes dados ainda nao existem.)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. UTILIZADORES FICTICIOS (auth.users)
--    O trigger on_auth_user_created -> handle_new_user() cria automaticamente
--    o perfil em public.utilizador (id, email, name a partir do metadata).
-- ----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'ana.demo@unico.demo',   extensions.crypt('demo1234', extensions.gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Ana Martins"}'),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'bruno.demo@unico.demo', extensions.crypt('demo1234', extensions.gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Bruno Costa"}'),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'carla.demo@unico.demo', extensions.crypt('demo1234', extensions.gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Carla Sousa"}'),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated',
   'diogo.demo@unico.demo', extensions.crypt('demo1234', extensions.gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Diogo Pinto"}'),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated',
   'eva.demo@unico.demo',   extensions.crypt('demo1234', extensions.gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Eva Ramos"}')
on conflict (id) do nothing;

-- Identidades (necessarias para o login por email/password no GoTrue)
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  extensions.gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email like '%@unico.demo'
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'email'
  );

-- Completar os perfis criados pelo trigger (universidade, bio, admin)
update public.utilizador set university='ESMAD - P.PORTO', is_admin=true,
  bio='Administradora da comunidade UniCo.'                where id='a0000000-0000-0000-0000-000000000001';
update public.utilizador set university='ESMAD - P.PORTO',
  bio='Vendo manuais e material que ja nao uso.'           where id='a0000000-0000-0000-0000-000000000002';
update public.utilizador set university='ESMAD - P.PORTO',
  bio='A procura de equipamento em segunda mao.'           where id='a0000000-0000-0000-0000-000000000003';
update public.utilizador set university='ESTG - P.PORTO',
  bio='Estudante de desporto, vendo o que ja nao preciso.' where id='a0000000-0000-0000-0000-000000000004';
update public.utilizador set university='ESE - P.PORTO',
  bio='Troco manuais e roupa em bom estado.'               where id='a0000000-0000-0000-0000-000000000005';

-- ----------------------------------------------------------------------------
-- 2. CATEGORIAS
-- ----------------------------------------------------------------------------
insert into public.categoria (id, name, icon_url, created_at) values
  ('c0000000-0000-0000-0000-000000000001', 'Manuais',                 'book.svg',   now()),
  ('c0000000-0000-0000-0000-000000000002', 'Informatica',             'laptop.svg', now()),
  ('c0000000-0000-0000-0000-000000000003', 'Moda',                    'shirt.svg',  now()),
  ('c0000000-0000-0000-0000-000000000004', 'Material de Laboratorio', 'flask.svg',  now()),
  ('c0000000-0000-0000-0000-000000000005', 'Desporto',                'ball.svg',   now())
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 3. ITENS (anuncios)
-- ----------------------------------------------------------------------------
insert into public.item (id, seller_id, category_id, title, description, price, wear_status, sell_status, created_at) values
  ('d0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001','Manual de Calculo I',      'Edicao recente, sem riscos.',                12.50,'como_novo',   'disponivel', now()),
  ('d0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001','Manual de Fisica',         'Capa um pouco gasta, interior otimo.',       10.00,'bom',         'disponivel', now()),
  ('d0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000002','Rato sem fios',            'Funciona perfeitamente, pouco uso.',          8.00,'bom',         'disponivel', now()),
  ('d0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000002','Teclado mecanico',         'Switches azuis, com cabo USB-C.',            25.00,'usado',       'disponivel', now()),
  ('d0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000002','Monitor 24 polegadas',     'Full HD, com cabo HDMI incluido.',           60.00,'usado',       'reservado',  now()),
  ('d0000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000003','Casaco de ganga',          'Tamanho M, muito bom estado.',               15.00,'bom',         'vendido',    now()),
  ('d0000000-0000-0000-0000-000000000007','a0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000005','Tenis de corrida',         'Numero 42, alguns sinais de uso.',           20.00,'satisfatorio','disponivel', now()),
  ('d0000000-0000-0000-0000-000000000008','a0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000004','Bata de laboratorio',      'Nova, ainda com etiqueta.',                   9.50,'novo',        'disponivel', now()),
  ('d0000000-0000-0000-0000-000000000009','a0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000002','Calculadora cientifica',   'Casio, todas as funcoes a trabalhar.',       18.00,'como_novo',   'disponivel', now()),
  ('d0000000-0000-0000-0000-000000000010','a0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000001','Manual de Quimica',        'Com alguns apontamentos a lapis.',           11.00,'bom',         'disponivel', now()),
  ('d0000000-0000-0000-0000-000000000011','a0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000003','Mochila',                  'Espacosa, ideal para portatil.',             14.00,'usado',       'disponivel', now()),
  ('d0000000-0000-0000-0000-000000000012','a0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000002','Disco externo 1TB',        'Rapido e silencioso, pouco uso.',            35.00,'bom',         'reservado',  now()),
  ('d0000000-0000-0000-0000-000000000013','a0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000005','Halteres 5kg (par)',       'Par de halteres, borracha intacta.',         16.00,'usado',       'disponivel', now()),
  ('d0000000-0000-0000-0000-000000000014','a0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000004','Oculos de protecao',       'Novos, embalados.',                           6.00,'novo',        'disponivel', now()),
  ('d0000000-0000-0000-0000-000000000015','a0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001','Manual de Algoritmos',     'Bastante usado mas completo.',                7.00,'muito_usado', 'vendido',    now())
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 4. IMAGENS DOS ITENS (principal para os primeiros oito itens)
-- ----------------------------------------------------------------------------
insert into public.item_image (id, item_id, image_url, is_principal, created_at) values
  ('e0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','manual_calculo_1.jpg', true, now()),
  ('e0000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000002','manual_fisica.jpg',    true, now()),
  ('e0000000-0000-0000-0000-000000000003','d0000000-0000-0000-0000-000000000003','rato_sem_fios.jpg',    true, now()),
  ('e0000000-0000-0000-0000-000000000004','d0000000-0000-0000-0000-000000000004','teclado_mecanico.jpg', true, now()),
  ('e0000000-0000-0000-0000-000000000005','d0000000-0000-0000-0000-000000000005','monitor_24.jpg',       true, now()),
  ('e0000000-0000-0000-0000-000000000006','d0000000-0000-0000-0000-000000000006','casaco_ganga.jpg',     true, now()),
  ('e0000000-0000-0000-0000-000000000007','d0000000-0000-0000-0000-000000000007','tenis_corrida.jpg',    true, now()),
  ('e0000000-0000-0000-0000-000000000008','d0000000-0000-0000-0000-000000000008','bata_laboratorio.jpg', true, now())
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 5. FAVORITOS
-- ----------------------------------------------------------------------------
insert into public.favorito (user_id, item_id, created_at) values
  ('a0000000-0000-0000-0000-000000000003','d0000000-0000-0000-0000-000000000001', now()),
  ('a0000000-0000-0000-0000-000000000003','d0000000-0000-0000-0000-000000000003', now()),
  ('a0000000-0000-0000-0000-000000000004','d0000000-0000-0000-0000-000000000005', now()),
  ('a0000000-0000-0000-0000-000000000004','d0000000-0000-0000-0000-000000000010', now()),
  ('a0000000-0000-0000-0000-000000000005','d0000000-0000-0000-0000-000000000001', now()),
  ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000007', now())
on conflict (user_id, item_id) do nothing;

-- ----------------------------------------------------------------------------
-- 6. TRANSACOES (seller corresponde sempre ao vendedor do item)
-- ----------------------------------------------------------------------------
insert into public.transacao (id, item_id, buyer_id, seller_id, final_price, status, created_at) values
  ('f0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000003',15.00,'concluida', now()),
  ('f0000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000015','a0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000002', 7.00,'concluida', now()),
  ('f0000000-0000-0000-0000-000000000003','d0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000003',60.00,'pendente',  now())
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 7. CONVERSAS + MENSAGENS
-- ----------------------------------------------------------------------------
insert into public.conversa (id, item_id, buyer_id, seller_id, created_at) values
  ('b0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000002', now()),
  ('b0000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000003', now()),
  ('b0000000-0000-0000-0000-000000000003','d0000000-0000-0000-0000-000000000010','a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000005', now())
on conflict (item_id, buyer_id, seller_id) do nothing;

insert into public.mensagem (id, conversa_id, sender_id, content, seen, created_at) values
  ('90000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000003','Ola! O manual ainda esta disponivel?',           true,  now()),
  ('90000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002','Ola Carla, sim esta! Queres combinar a entrega?', false, now()),
  ('90000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000004','Aceitas 50 euros pelo monitor?',                  true,  now()),
  ('90000000-0000-0000-0000-000000000004','b0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000003','Posso fazer por 55, esta como novo.',             false, now()),
  ('90000000-0000-0000-0000-000000000005','b0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','O manual tem muitas anotacoes?',                  true,  now()),
  ('90000000-0000-0000-0000-000000000006','b0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000005','So a lapis, apaga-se facilmente.',                false, now())
on conflict (id) do nothing;

-- ============================================================================
-- LIMPEZA (opcional) - apaga TODOS os dados ficticios criados por este script.
-- Descomenta e corre para repor a BD no estado anterior.
-- A ordem respeita as chaves estrangeiras (itens em cascata limpam imagens,
-- favoritos, transacoes, conversas e mensagens ligadas ao item).
-- ============================================================================
-- delete from public.transacao where buyer_id in (select id from public.utilizador where email like '%@unico.demo')
--    or seller_id in (select id from public.utilizador where email like '%@unico.demo');
-- delete from public.favorito  where user_id in (select id from public.utilizador where email like '%@unico.demo');
-- delete from public.item      where seller_id in (select id from public.utilizador where email like '%@unico.demo');
-- delete from public.categoria where id in (
--   'c0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002',
--   'c0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000004',
--   'c0000000-0000-0000-0000-000000000005');
-- delete from auth.users where email like '%@unico.demo';  -- remove tambem o perfil (ON DELETE CASCADE)
-- ============================================================================
