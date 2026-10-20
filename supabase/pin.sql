-- Guardiões da Gardunha — PIN de 5 dígitos por atleta (substitui o código pessoal)
-- Cola no SQL Editor do Supabase e carrega em Run. Pode correr-se mais de uma vez.

create table if not exists public.member_pins (member uuid primary key, pin_hash text not null, updated_at timestamptz not null default now());
alter table public.member_pins enable row level security;   -- sem políticas: só as funções lhe tocam

create or replace function public._pin_hash(m uuid, p text) returns text
language sql immutable as $$ select encode(sha256(convert_to(m::text || ':' || coalesce(p,''), 'UTF8')), 'hex'); $$;

create or replace function public._athlete_member(p_aid text) returns uuid
language sql stable security definer set search_path = public as $$
  select nullif(d.data->>'uid', '')::uuid from public.docs d where d.col = 'athletes' and d.id = p_aid and not d.deleted;
$$;

-- O atleta deste aparelho define (ou muda) o seu PIN. Só quem já tem inscrição.
create or replace function public.set_pin(p_pin text) returns boolean
language plpgsql security definer set search_path = public as $$
declare m uuid := public.current_member();
begin
  if m is null then raise exception 'sem_sessao' using errcode = '28000'; end if;
  if coalesce(p_pin, '') !~ '^[0-9]{5}$' then raise exception 'pin_invalido' using errcode = '22023'; end if;
  if not exists (select 1 from public.docs where col = 'regs' and id = m::text and not deleted)
     and not exists (select 1 from public.docs where col = 'athletes' and not deleted and data->>'uid' = m::text) then
    raise exception 'sem_inscricao' using errcode = '42501';
  end if;
  insert into public.member_pins(member, pin_hash) values (m, public._pin_hash(m, p_pin))
    on conflict (member) do update set pin_hash = excluded.pin_hash, updated_at = now();
  return true;
end $$;

-- Estado do PIN de um atleta: 'definido' · 'criar' (ainda sem PIN e este aparelho é o dele) · 'sem_pin' · 'sem_conta'
create or replace function public.pin_status(p_aid text) returns text
language plpgsql stable security definer set search_path = public as $$
declare m uuid := public._athlete_member(p_aid);
begin
  if m is null then return 'sem_conta'; end if;
  if exists (select 1 from public.member_pins where member = m) then return 'definido'; end if;
  if m = public.current_member() then return 'criar'; end if;
  return 'sem_pin';
end $$;

-- Entrar como atleta com nome (id) + PIN. Máx. 5 PIN errados por atleta em cada hora.
create or replace function public.pin_login(p_aid text, p_pin text) returns uuid
language plpgsql security definer set search_path = public as $$
declare m uuid := public._athlete_member(p_aid); k text := 'pin:' || coalesce(p_aid, '');
begin
  if auth.uid() is null then raise exception 'sem_sessao' using errcode = '28000'; end if;
  delete from public.attempts where at < now() - interval '1 day';
  if (select count(*) from public.attempts where kind = k and at > now() - interval '1 hour') >= 5 then
    raise exception 'demasiadas_tentativas' using errcode = '54000';
  end if;
  if m is not null and exists (select 1 from public.member_pins where member = m and pin_hash = public._pin_hash(m, p_pin)) then
    delete from public.attempts where kind = k;
    insert into public.sessions(auth_uid, member) values (auth.uid(), m)
      on conflict (auth_uid) do update set member = excluded.member, created_at = now();
    return m;
  end if;
  insert into public.attempts(auth_uid, kind) values (auth.uid(), k);   -- (sem erro, para a tentativa ficar registada)
  return null;
end $$;

-- A organização define um PIN novo a um atleta (esqueceu-se, mudou de telemóvel…)
create or replace function public.admin_set_pin(p_member uuid, p_pin text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'sem_permissao' using errcode = '42501'; end if;
  if coalesce(p_pin, '') !~ '^[0-9]{5}$' then raise exception 'pin_invalido' using errcode = '22023'; end if;
  insert into public.member_pins(member, pin_hash) values (p_member, public._pin_hash(p_member, p_pin))
    on conflict (member) do update set pin_hash = excluded.pin_hash, updated_at = now();
  delete from public.attempts where kind like 'pin:%' and kind in (select 'pin:' || d.id from public.docs d where d.col = 'athletes' and d.data->>'uid' = p_member::text);
  return true;
end $$;

-- Sair (este aparelho deixa de estar ligado ao atleta)
create or replace function public.leave_member() returns void
language sql security definer set search_path = public as $$ delete from public.sessions where auth_uid = auth.uid(); $$;

revoke all on function public.set_pin(text), public.pin_status(text), public.pin_login(text, text), public.admin_set_pin(uuid, text), public.leave_member(), public._athlete_member(text) from public, anon;
grant execute on function public.set_pin(text), public.pin_status(text), public.pin_login(text, text), public.admin_set_pin(uuid, text), public.leave_member() to authenticated;
