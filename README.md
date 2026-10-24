# Guardiões da Gardunha 2027

Site: https://guardioes-da-gardunha.github.io/guardioesgardunha2027/

Site do desafio de trail: inscrição sem login (código pessoal), caminhos com mapa e GPX, submissão de tempos por GPX, classificações e área da organização.

- `public/` — o site (HTML + JS estático). É isto que se publica.
- `src/` — código-fonte (`app.html`, `core.js`, `adapter.js`). `python3 build.py` gera `public/index.html`.
- `supabase/schema.sql` — base de dados e regras de privacidade.
- `tests/` — testes do motor de pontos e um emulador local do Supabase.

## Publicar (uma só vez)

### 1. Base de dados (Supabase)
1. Abre o projeto no Supabase → **SQL Editor** → **New query**.
2. Cola o conteúdo de `supabase/schema.sql` e carrega em **Run**. Deve dizer "Success".
3. **Authentication → Sign In / Providers → Allow anonymous sign-ins**: ligado.
4. Cola também `supabase/pin.sql` (PIN de 5 dígitos por atleta) e carrega em **Run**.
4b. Cola também `supabase/cega.sql` e carrega em **Run** (a Quinzena Cega passa a esconder os tempos também na base de dados, não só no ecrã).
5. Define a frase secreta da organização (só tu a sabes; mínimo 12 caracteres). Num novo query:

   ```sql
   select set_admin_secret('escolhe-uma-frase-longa-e-so-tua');
   ```

   Apaga depois esse query do histórico se partilhares o ecrã. Para mudar a frase, repete (isto termina as sessões de organizador existentes).

### 2. Site (Cloudflare Pages)
1. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git** → escolhe este repositório.
2. **Build command**: vazio · **Build output directory**: `public`.
3. Depois de publicar, o site fica em `https://<nome>.pages.dev` (podes ligar um domínio teu em *Custom domains*).

#### Alternativa: GitHub Pages (sem criar mais contas)
Repositório → **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch `main`, pasta `/docs` → Save**. Fica em `https://<utilizador>.github.io/guardioesgardunha2027/`. (`docs/` é uma cópia de `public/`, gerada por `python3 build.py`.) Num repositório privado o GitHub Pages exige plano pago; num público é gratuito.

### 3. Entrar como organização
No site, rodapé → **Acesso da organização** → escreve a frase. Aparecem os separadores *Inscrições* e *Organização*.

## Como funciona
- **Inscrição**: qualquer pessoa preenche o formulário; recebe um **código pessoal** (`GRD-XXXXX-XXXXX`). A organização aprova em *Inscrições*.
- **Código**: associa o telemóvel ao atleta. Noutro aparelho, o atleta usa *Já me inscrevi: tenho um código*. Se o perder, a organização gera um novo (*Inscrições → atletas → Novo código*).
- **Dados privados** (data de nascimento, contacto) só a organização vê.
- **Sincronização**: a página consulta alterações a cada ~25 s e guarda uma cópia no aparelho, para gastar pouco tráfego.

## Manutenção
- `.github/workflows/keepalive.yml` faz um pedido diário ao Supabase para o projeto gratuito não ser pausado por inatividade.
- Para mudar de projeto Supabase, edita `public/config.js` (URL e chave pública `anon`). **Nunca** coloques a chave `service_role` neste repositório.

## Testar localmente (opcional)
`node tests/test_core.js` corre os testes do motor de pontos. `tests/emulator.py` simula o Supabase sobre um Postgres local.
