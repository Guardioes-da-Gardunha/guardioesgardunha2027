-- Guardiões da Gardunha — Quinzena Cega a sério (do lado do servidor)
-- Cola no SQL Editor do Supabase e carrega em Run. Pode correr-se mais de uma vez.
--
-- Até aqui, "ocultar classificações" só escondia os tempos no ecrã: quem soubesse ler a base de dados via-os todos.
-- Agora, com a Quinzena Cega ligada (Organização → Configuração), a base de dados só devolve a cada atleta
-- o seu próprio documento de tempos ("efforts"). A organização continua a ver tudo.
-- Os tempos "manual" e "review" deixam de ser legíveis por atletas enquanto durar a Quinzena Cega.

create or replace function public.blind_on() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (data->>'hide')::boolean from public.docs where col = 'config' and id = 'main' and not deleted), false);
$$;
grant execute on function public.blind_on() to anon, authenticated;

drop policy if exists docs_read on public.docs;
create policy docs_read on public.docs for select to anon, authenticated using (
  public.is_admin()
  or col in ('segments','athletes','config','claims')
  or (col = 'efforts' and (not public.blind_on() or id = public.current_member()::text))
  or (col in ('manual','review') and not public.blind_on())
  or (col = 'regs' and id = public.current_member()::text)
);
