-- Guardiões da Gardunha — reações às atividades (polegares, "Vou desafiar") e notificações
-- Cola no SQL Editor do Supabase e carrega em Run. Pode correr-se mais de uma vez.
--
-- Cria a coleção "reacts": cada atleta tem 1 documento (id = o seu membro) com as reações que deu.
-- Todos podem ler (é assim que o autor da atividade recebe a notificação); cada um só escreve o seu.
-- Inclui a regra da Quinzena Cega (supabase/cega.sql): com a cega ligada, ninguém lê reações de outros.

alter table public.docs drop constraint if exists docs_col_ok;
alter table public.docs add constraint docs_col_ok
  check (col in ('segments','athletes','config','review','manual','claims','efforts','regs','private','reacts'));

create or replace function public.blind_on() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (data->>'hide')::boolean from public.docs where col = 'config' and id = 'main' and not deleted), false);
$$;
grant execute on function public.blind_on() to anon, authenticated;

drop policy if exists docs_read   on public.docs;
drop policy if exists docs_insert on public.docs;
drop policy if exists docs_update on public.docs;

create policy docs_read on public.docs for select to anon, authenticated using (
  public.is_admin()
  or col in ('segments','athletes','config','claims')
  or (col in ('efforts','reacts') and (not public.blind_on() or id = public.current_member()::text))
  or (col in ('manual','review') and not public.blind_on())
  or (col = 'regs' and id = public.current_member()::text)
);
create policy docs_insert on public.docs for insert to authenticated with check (
  public.is_admin()
  or (col in ('claims','efforts','regs','reacts') and id = public.current_member()::text)
);
create policy docs_update on public.docs for update to authenticated
  using      (public.is_admin() or (col in ('claims','efforts','regs','reacts') and id = public.current_member()::text))
  with check (public.is_admin() or (col in ('claims','efforts','regs','reacts') and id = public.current_member()::text));
