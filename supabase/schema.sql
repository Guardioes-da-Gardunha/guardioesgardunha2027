-- Guardiões da Gardunha 2027 — esquema da base de dados (Supabase / Postgres)
-- Cola este ficheiro inteiro no SQL Editor do Supabase e carrega em "Run".
-- É seguro voltar a correr (usa "if not exists" / "create or replace").
--
-- Modelo: uma única tabela de documentos (coleção/id → JSON), igual ao que a app já usa,
-- mais as tabelas que ligam cada aparelho a um atleta (código pessoal) e ao organizador.


-- ───────────────────────── Documentos ─────────────────────────
create table if not exists public.docs (
  col        text        not null,
  id         text        not null,
  data       jsonb       not null default '{}'::jsonb,
  deleted    boolean     not null default false,   -- "lápide": permite aos outros aparelhos saberem que foi apagado
  updated_at timestamptz not null default clock_timestamp(),
  primary key (col, id),
  constraint docs_col_ok  check (col in ('segments','athletes','config','review','manual','claims','efforts','regs','private')),
  constraint docs_id_len  check (char_length(id) between 1 and 64),
  constraint docs_size_ok check (pg_column_size(data) < 1500000)
);
create index if not exists docs_col_updated on public.docs (col, updated_at);

create or replace function public.docs_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  if new.deleted then new.data := '{}'::jsonb; end if;
  return new;
end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before insert or update on public.docs for each row execute function public.docs_touch();

-- ─────────────── Identidade: aparelho → atleta, e organizador ───────────────
create table if not exists public.sessions    (auth_uid uuid primary key, member uuid not null, created_at timestamptz not null default now());
create table if not exists public.member_codes(member uuid primary key, code_hash text not null unique, created_at timestamptz not null default now());
create table if not exists public.admins      (auth_uid uuid primary key, created_at timestamptz not null default now());
create table if not exists public.secrets     (k text primary key, v text not null);
create table if not exists public.attempts    (id bigserial primary key, auth_uid uuid not null, kind text not null, at timestamptz not null default now());
create index if not exists attempts_idx on public.attempts (auth_uid, kind, at);

alter table public.docs         enable row level security;
alter table public.sessions     enable row level security;
alter table public.member_codes enable row level security;
alter table public.admins       enable row level security;
alter table public.secrets      enable row level security;
alter table public.attempts     enable row level security;
-- (sem políticas nestas 5 tabelas = ninguém lhes acede diretamente; só as funções abaixo)

-- Quem sou eu? Cada aparelho tem a sua sessão anónima; se entrou com um código, herda o atleta do código.
create or replace function public.current_member() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce((select s.member from public.sessions s where s.auth_uid = auth.uid()), auth.uid());
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where a.auth_uid = auth.uid());
$$;

create or replace function public.whoami() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('member', public.current_member(), 'admin', public.is_admin());
$$;

-- hora do servidor (ponto de partida seguro para a sincronização, sem depender do relógio do telemóvel)
create or replace function public.server_time() returns timestamptz language sql stable as $$ select clock_timestamp(); $$;
grant execute on function public.server_time() to anon, authenticated;

-- ───────────────────────── Políticas dos documentos ─────────────────────────
-- Ler:     todos veem caminhos, atletas, config, revisão, tempos manuais, pedidos e tempos.
--          "regs" (inscrições) só o organizador e o próprio; "private" (data de nascimento, contacto) só o organizador.
-- Escrever: o organizador escreve tudo; cada atleta só o seu próprio documento em claims / efforts / regs.
drop policy if exists docs_read   on public.docs;
drop policy if exists docs_insert on public.docs;
drop policy if exists docs_update on public.docs;
drop policy if exists docs_delete on public.docs;

create policy docs_read on public.docs for select to anon, authenticated using (
  col in ('segments','athletes','config','review','manual','claims','efforts')
  or public.is_admin()
  or (col = 'regs' and id = public.current_member()::text)
);
create policy docs_insert on public.docs for insert to authenticated with check (
  public.is_admin()
  or (col in ('claims','efforts','regs') and id = public.current_member()::text)
);
create policy docs_update on public.docs for update to authenticated
  using      (public.is_admin() or (col in ('claims','efforts','regs') and id = public.current_member()::text))
  with check (public.is_admin() or (col in ('claims','efforts','regs') and id = public.current_member()::text));
-- sem política de delete: apagar é "update ... set deleted = true"

-- Limite de documentos "regs" por pessoa e de tamanho: um atleta só tem 1 doc em cada coleção (id = o seu membro).

revoke all on public.docs from anon, authenticated;
grant select on public.docs to anon, authenticated;
grant insert, update on public.docs to authenticated;

-- ───────────────────────── Código pessoal ─────────────────────────
create or replace function public._norm_code(c text) returns text
language sql immutable as $$ select upper(regexp_replace(coalesce(c,''), '[^A-Za-z0-9]', '', 'g')); $$;

create or replace function public._hash_code(c text) returns text
language sql immutable as $$ select encode(sha256(convert_to(public._norm_code(c), 'UTF8')), 'hex'); $$;

-- código do género GRD-7K4Q2-XMP9T (10 caracteres de um alfabeto sem 0/O/1/I)
create or replace function public._make_code() returns text
language plpgsql volatile as $$
declare alpha text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; raw text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''); out text := ''; i int;
begin
  for i in 0..9 loop
    out := out || substr(alpha, 1 + (('x' || substr(raw, i*2 + 1, 2))::bit(8)::int % 32), 1);
  end loop;
  return 'GRD-' || substr(out, 1, 5) || '-' || substr(out, 6, 5);
end $$;

-- Limita tentativas (por sessão anónima): máx. n por hora
create or replace function public._throttle(k text, n int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sem_sessao' using errcode = '28000'; end if;
  delete from public.attempts where at < now() - interval '1 day';
  if (select count(*) from public.attempts where auth_uid = auth.uid() and kind = k and at > now() - interval '1 hour') >= n then
    raise exception 'demasiadas_tentativas' using errcode = '54000';
  end if;
  insert into public.attempts(auth_uid, kind) values (auth.uid(), k);
end $$;

-- Gera (ou renova) o código do atleta deste aparelho. Só quem já tem inscrição (ou o organizador).
create or replace function public.new_code() returns text
language plpgsql security definer set search_path = public as $$
declare m uuid := public.current_member(); c text;
begin
  if m is null then raise exception 'sem_sessao' using errcode = '28000'; end if;
  if not public.is_admin() and not exists (select 1 from public.docs where col = 'regs' and id = m::text and not deleted) then
    raise exception 'sem_inscricao' using errcode = '42501';
  end if;
  perform public._throttle('new_code', 10);
  c := public._make_code();
  insert into public.member_codes(member, code_hash) values (m, public._hash_code(c))
    on conflict (member) do update set code_hash = excluded.code_hash, created_at = now();
  return c;
end $$;

-- O organizador gera um código novo para um atleta (perdeu o código, mudou de telemóvel…)
create or replace function public.admin_new_code(p_member uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.is_admin() then raise exception 'sem_permissao' using errcode = '42501'; end if;
  c := public._make_code();
  insert into public.member_codes(member, code_hash) values (p_member, public._hash_code(c))
    on conflict (member) do update set code_hash = excluded.code_hash, created_at = now();
  return c;
end $$;

-- Entrar noutro aparelho com o código pessoal. Devolve o atleta, ou NULL se o código não existe.
create or replace function public.login_code(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare m uuid;
begin
  perform public._throttle('login_code', 12);
  select member into m from public.member_codes where code_hash = public._hash_code(p_code);
  if m is null then return null; end if;  -- (não levanta erro, para a tentativa ficar registada)
  insert into public.sessions(auth_uid, member) values (auth.uid(), m)
    on conflict (auth_uid) do update set member = excluded.member, created_at = now();
  return m;
end $$;

-- ───────────────────────── Organizador ─────────────────────────
-- O organizador define uma frase-passe secreta uma única vez (no SQL Editor), ver README.
create or replace function public.set_admin_secret(p_secret text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if char_length(coalesce(p_secret,'')) < 12 then raise exception 'frase demasiado curta (mín. 12)'; end if;
  insert into public.secrets(k, v) values ('admin', public._hash_code(p_secret))
    on conflict (k) do update set v = excluded.v;
  delete from public.admins;  -- trocar a frase termina todas as sessões de organizador
end $$;
revoke all on function public.set_admin_secret(text) from public, anon, authenticated;

create or replace function public.claim_admin(p_secret text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform public._throttle('claim_admin', 8);
  if exists (select 1 from public.secrets where k = 'admin' and v = public._hash_code(p_secret)) then
    insert into public.admins(auth_uid) values (auth.uid()) on conflict do nothing;
    return true;
  end if;
  return false;  -- (não levanta erro, para a tentativa ficar registada)
end $$;

create or replace function public.leave_admin() returns void
language sql security definer set search_path = public as $$ delete from public.admins where auth_uid = auth.uid(); $$;

-- Permissões das funções: só quem tem sessão (anónima ou não) as pode chamar
revoke all on function public.new_code(), public.admin_new_code(uuid), public.login_code(text), public.claim_admin(text), public.leave_admin(), public.whoami(), public.current_member(), public.is_admin(), public._throttle(text,int) from public, anon;
grant execute on function public.new_code(), public.admin_new_code(uuid), public.login_code(text), public.claim_admin(text), public.leave_admin(), public.whoami() to authenticated;
grant execute on function public.current_member(), public.is_admin() to anon, authenticated;  -- usadas pelas políticas
