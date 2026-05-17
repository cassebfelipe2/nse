# Phacolog — Guia de Profissionalização da Infraestrutura

> **Status:** Pendente de execução  
> **Estimativa total:** 8–10 dias úteis  
> **Pré-requisito:** Ter acesso a um cartão de crédito para registro de domínio

---

## Índice

- [Fase 1 — Fundação organizacional](#fase-1--fundação-organizacional)
  - [1.1 Domínio e e-mail do projeto](#11-domínio-e-e-mail-do-projeto)
  - [1.2 GitHub Organization](#12-github-organization)
  - [1.3 Google Cloud Project dedicado](#13-google-cloud-project-dedicado)
- [Fase 2 — Ambientes separados](#fase-2--ambientes-separados)
  - [2.1 Supabase: dois projetos](#21-supabase-dois-projetos)
  - [2.2 Migração do banco atual](#22-migração-do-banco-atual)
  - [2.3 Cloudflare Pages](#23-cloudflare-pages)
  - [2.4 Google OAuth por ambiente](#24-google-oauth-por-ambiente)
  - [2.5 Atualizar o código para detecção de ambiente](#25-atualizar-o-código-para-detecção-de-ambiente)
- [Fase 3 — CI/CD e fluxo de trabalho](#fase-3--cicd-e-fluxo-de-trabalho)
  - [3.1 Estratégia de branches](#31-estratégia-de-branches)
  - [3.2 GitHub Actions](#32-github-actions)
  - [3.3 Secrets no GitHub](#33-secrets-no-github)
  - [3.4 Remover service role key do código](#34-remover-service-role-key-do-código)
- [Fase 4 — Observabilidade e governança](#fase-4--observabilidade-e-governança)
  - [4.1 Sentry (monitoramento de erros)](#41-sentry-monitoramento-de-erros)
  - [4.2 UptimeRobot (uptime)](#42-uptimerobot-uptime)
  - [4.3 Checklist de acesso e permissões](#43-checklist-de-acesso-e-permissões)
  - [4.4 Documentação do repositório](#44-documentação-do-repositório)
- [Referência rápida](#referência-rápida)

---

## Fase 1 — Fundação organizacional

### 1.1 Domínio e e-mail do projeto

**Objetivo:** Ter uma identidade separada dos sócios para todos os recursos do projeto.

#### 1.1.1 Registrar o domínio

1. Acesse [registro.br](https://registro.br) (para `.app.br`) ou [Namecheap](https://namecheap.com) (para `.app`)
2. Busque por `phacolog.app` (preferencial) ou `phacolog.com.br`
3. Registre com dados da empresa (CNPJ se houver) ou um dos sócios como titular
4. Anote as credenciais de acesso ao painel do registrador — você precisará delas para apontar o DNS para a Cloudflare na Fase 2

> **Custo estimado:** phacolog.app ~US$ 12/ano · phacolog.com.br ~R$ 40/ano

#### 1.1.2 Criar e-mail dedicado ao projeto

**Opção A — Gmail gratuito (suficiente para começar):**
1. Acesse [accounts.google.com](https://accounts.google.com/signup)
2. Crie a conta: `phacolog.app.dev@gmail.com` (ou similar)
3. Salve o e-mail e senha no gerenciador de senhas compartilhado dos sócios (Bitwarden, 1Password, etc.)

**Opção B — Google Workspace (mais profissional, recomendado ao escalar):**
1. Acesse [workspace.google.com](https://workspace.google.com) → Start free trial
2. Use o domínio `phacolog.app` registrado no passo anterior
3. Crie o usuário: `dev@phacolog.app`
4. Custo: US$ 6/mês por usuário

> **Este e-mail será o dono de todas as contas a seguir. Nunca use e-mail pessoal.**

---

### 1.2 GitHub Organization

**Objetivo:** O repositório pertence ao produto, não a uma pessoa.

#### 1.2.1 Criar a organização

1. Logue no GitHub com o e-mail do projeto (`dev@phacolog.app`)
2. Acesse: [github.com/organizations/new](https://github.com/organizations/new)
3. Escolha o plano **Free**
4. Nome da organização: `phacolog`
5. E-mail de contato: `dev@phacolog.app`
6. Confirme a criação

#### 1.2.2 Adicionar os sócios como owners

1. Acesse `github.com/orgs/phacolog/people`
2. Clique em **Invite member**
3. Adicione o GitHub de Rodrigo → Role: **Owner**
4. Adicione o GitHub de Felipe → Role: **Owner**
5. Ambos aceitam o convite por e-mail

#### 1.2.3 Transferir o repositório atual

1. Logue com a conta do **Felipe** (dono atual do repo `cassebfelipe2/nse`)
2. Acesse `github.com/cassebfelipe2/nse/settings`
3. Role até a seção **Danger Zone** → **Transfer ownership**
4. Digite o nome do repositório para confirmar
5. Destino: organização `phacolog`
6. Novo nome do repositório: `app` (ficará como `github.com/phacolog/app`)
7. Confirme a transferência

> **Atenção:** URLs antigas (`cassebfelipe2/nse`) serão redirecionadas automaticamente pelo GitHub, mas atualize qualquer referência hardcoded no código.

#### 1.2.4 Proteger a branch main

1. Acesse `github.com/phacolog/app/settings/branches`
2. Clique em **Add branch protection rule**
3. Branch name pattern: `main`
4. Marque:
   - ✅ Require a pull request before merging
   - ✅ Require approvals: **1**
   - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ✅ Require status checks to pass before merging
   - ✅ Do not allow bypassing the above settings
5. Clique em **Create**
6. Repita para a branch `develop` com as mesmas configurações (exceto aprovações — pode deixar 0 para develop)

---

### 1.3 Google Cloud Project dedicado

**Objetivo:** OAuth e quaisquer APIs Google vinculadas ao produto, não a contas pessoais.

#### 1.3.1 Criar os projetos no Google Cloud

1. Acesse [console.cloud.google.com](https://console.cloud.google.com) logado com `dev@phacolog.app`
2. Clique no seletor de projetos (canto superior esquerdo) → **New Project**
3. Crie dois projetos:
   - Nome: `Phacolog PROD` · ID: `phacolog-prod`
   - Nome: `Phacolog Staging` · ID: `phacolog-staging`

#### 1.3.2 Adicionar os sócios como co-owners

Para **cada projeto**:
1. IAM & Admin → IAM → **Grant Access**
2. Adicione o e-mail do Rodrigo → Role: **Owner**
3. Adicione o e-mail do Felipe → Role: **Owner**

#### 1.3.3 Revogar as credenciais OAuth antigas

1. Acesse o Google Cloud com a conta pessoal do Rodrigo (onde o OAuth foi criado)
2. APIs & Services → Credentials
3. Localize o OAuth Client criado para o Phacolog
4. Clique nos três pontos → **Delete**

> As credenciais novas serão criadas na Fase 2.4, após ter os projetos Supabase configurados (precisamos das URLs de callback).

---

## Fase 2 — Ambientes separados

### 2.1 Supabase: dois projetos

**Objetivo:** Produção e staging completamente isolados — banco, usuários e secrets separados.

#### 2.1.1 Criar organização no Supabase

1. Acesse [supabase.com](https://supabase.com) logado com `dev@phacolog.app`
2. No painel, clique em **New organization**
3. Nome: `Phacolog`
4. Plano: **Free**

#### 2.1.2 Adicionar os sócios à organização

1. Na organização `Phacolog` → **Settings → Members**
2. Convide Rodrigo e Felipe com role **Owner**

#### 2.1.3 Criar o projeto de Staging (novo)

1. Na org `Phacolog` → **New Project**
2. Nome: `phacolog-staging`
3. Database password: gere uma senha forte e salve no gerenciador
4. Região: **South America (São Paulo)**
5. Plano: Free
6. Aguarde a criação (~2 min)
7. Anote a **Project URL** e a **anon key** (Settings → API)

#### 2.1.4 Criar o projeto de Produção (migrado — ver seção 2.2)

O projeto de produção será o projeto atual (`lvvlapgsrljvjenneobf`) transferido para a nova organização:

1. No painel Supabase, acesse o projeto atual
2. Settings → General → **Transfer project**
3. Destino: organização `Phacolog`
4. Confirme

> Se a transferência não estiver disponível no plano Free, crie um novo projeto `phacolog-prod` e siga a seção 2.2 para migrar os dados manualmente.

---

### 2.2 Migração do banco atual

> **Execute esta seção apenas se o projeto de produção precisou ser criado do zero.**

#### 2.2.1 Exportar schema e dados do projeto atual

Na máquina local com a CLI do Supabase instalada:

```bash
# Linkar ao projeto atual
supabase link --project-ref lvvlapgsrljvjenneobf

# Exportar schema (estrutura das tabelas)
supabase db dump --schema public > backup_schema.sql

# Exportar dados
supabase db dump --data-only --schema public > backup_data.sql
```

#### 2.2.2 Importar no novo projeto de produção

```bash
# Linkar ao novo projeto prod
supabase link --project-ref SEU_NOVO_PROD_ID

# Aplicar schema
psql "postgresql://postgres:SUA_SENHA@db.SEU_NOVO_PROD_ID.supabase.co:5432/postgres" < backup_schema.sql

# Aplicar dados
psql "postgresql://postgres:SUA_SENHA@db.SEU_NOVO_PROD_ID.supabase.co:5432/postgres" < backup_data.sql
```

> A string de conexão está disponível em: Settings → Database → Connection string (URI mode).

#### 2.2.3 Recriar os Secrets no novo projeto

No dashboard do novo projeto de produção, em Settings → Edge Functions → Secrets:

| Secret | Valor |
|---|---|
| `VAPID_PRIVATE_KEY` | (copiar do projeto antigo ou gerar novo par) |
| `CRON_SECRET` | (copiar do projeto antigo) |
| `PARTNER_TOKEN_JJ` | (copiar do projeto antigo) |
| `PARTNER_TOKEN_OFTA` | (copiar do projeto antigo) |

Via CLI:
```bash
supabase secrets set VAPID_PRIVATE_KEY=xxx
supabase secrets set CRON_SECRET=xxx
supabase secrets set PARTNER_TOKEN_JJ=xxx
supabase secrets set PARTNER_TOKEN_OFTA=xxx
```

#### 2.2.4 Fazer deploy das Edge Functions no novo projeto

```bash
supabase link --project-ref SEU_NOVO_PROD_ID

supabase functions deploy send-push --no-verify-jwt
supabase functions deploy partner-data
```

#### 2.2.5 Recriar os Secrets no projeto de Staging

Repita o 2.2.3 para o projeto de staging (pode usar tokens diferentes para parceiros):

```bash
supabase link --project-ref SEU_STAGING_ID

supabase secrets set VAPID_PRIVATE_KEY=xxx
supabase secrets set CRON_SECRET=xxx
supabase secrets set PARTNER_TOKEN_JJ=phacolog-staging-jj-token
supabase secrets set PARTNER_TOKEN_OFTA=phacolog-staging-ofta-token

supabase functions deploy send-push --no-verify-jwt
supabase functions deploy partner-data
```

---

### 2.3 Cloudflare Pages

**Objetivo:** Hosting com domínio customizado, SSL automático e deploy por branch.

#### 2.3.1 Criar conta na Cloudflare

1. Acesse [cloudflare.com](https://cloudflare.com) → Sign up
2. Use o e-mail `dev@phacolog.app`
3. Plano: **Free**

#### 2.3.2 Adicionar o domínio à Cloudflare

1. No dashboard Cloudflare → **Add a Site**
2. Digite `phacolog.app`
3. Escolha o plano Free
4. A Cloudflare mostrará os nameservers dela (ex: `ns1.cloudflare.com`, `ns2.cloudflare.com`)
5. Acesse o painel do registrador onde comprou o domínio
6. Substitua os nameservers atuais pelos da Cloudflare
7. Aguarde propagação (5 min a 48h — normalmente menos de 1h)

#### 2.3.3 Criar o projeto no Cloudflare Pages

1. No dashboard Cloudflare → **Pages** → **Create a project**
2. Clique em **Connect to Git**
3. Autorize o acesso à organização GitHub `phacolog`
4. Selecione o repositório `phacolog/app`
5. Configure o build:
   - **Project name:** `phacolog`
   - **Production branch:** `main`
   - **Build command:** *(deixar vazio — projeto estático)*
   - **Build output directory:** `/`
6. Clique em **Save and Deploy**

#### 2.3.4 Configurar domínio customizado

1. No projeto Pages → **Custom domains** → **Set up a custom domain**
2. Adicione `phacolog.app` → **Continue**
3. A Cloudflare cria automaticamente o registro DNS
4. Adicione também `www.phacolog.app` (redireciona para o principal)

#### 2.3.5 Configurar o ambiente de Staging

1. No projeto Pages → **Settings → Builds & deployments**
2. Em **Branch deployments**, adicione a regra:
   - Branch: `develop`
   - Custom domain: `staging.phacolog.app`
3. No DNS da Cloudflare, adicione o registro CNAME:
   - Nome: `staging`
   - Destino: `phacolog.pages.dev`

---

### 2.4 Google OAuth por ambiente

#### 2.4.1 Configurar OAuth no projeto Staging

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Selecione o projeto `phacolog-staging`
3. APIs & Services → **OAuth consent screen**:
   - User type: **External**
   - App name: `Phacolog (Staging)`
   - User support email: `dev@phacolog.app`
   - Developer contact: `dev@phacolog.app`
   - Salve
4. APIs & Services → **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**:
   - Application type: **Web application**
   - Name: `Phacolog Staging Web`
   - Authorized JavaScript origins:
     ```
     https://staging.phacolog.app
     http://localhost:5500
     http://127.0.0.1:5500
     ```
   - Authorized redirect URIs:
     ```
     https://SEU_STAGING_ID.supabase.co/auth/v1/callback
     ```
5. Salve e anote o **Client ID** e **Client Secret**
6. No Supabase staging → Authentication → Providers → **Google**:
   - Enable: ✅
   - Client ID: (cole o do passo anterior)
   - Client Secret: (cole o do passo anterior)
   - Salve

#### 2.4.2 Configurar OAuth no projeto PROD

1. Selecione o projeto `phacolog-prod`
2. APIs & Services → **OAuth consent screen**:
   - App name: `Phacolog`
   - *(mesmas configurações, mas sem "(Staging)" no nome)*
3. APIs & Services → **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**:
   - Name: `Phacolog Production Web`
   - Authorized JavaScript origins:
     ```
     https://phacolog.app
     https://www.phacolog.app
     ```
   - Authorized redirect URIs:
     ```
     https://SEU_PROD_ID.supabase.co/auth/v1/callback
     ```
4. No Supabase prod → Authentication → Providers → **Google**:
   - Enable: ✅
   - Cole o Client ID e Client Secret

#### 2.4.3 Configurar Redirect URLs no Supabase

No Supabase **PROD** → Authentication → URL Configuration:
```
Site URL:       https://phacolog.app
Redirect URLs:  https://phacolog.app
                https://phacolog.app/**
```

No Supabase **Staging** → Authentication → URL Configuration:
```
Site URL:       https://staging.phacolog.app
Redirect URLs:  https://staging.phacolog.app
                https://staging.phacolog.app/**
                http://localhost:5500
                http://127.0.0.1:5500
```

---

### 2.5 Atualizar o código para detecção de ambiente

**Objetivo:** Um único `index.html` que se conecta ao Supabase correto dependendo de onde está rodando.

Abra `index.html` e localize a seção onde `SUPABASE_URL` e `SUPABASE_ANON_KEY` são definidos. Substitua pelos valores abaixo, preenchendo os IDs e chaves reais:

```javascript
// ── Detecção de ambiente ──────────────────────────────────────────────────
var _SUPABASE_CONFIG = (function(){
  var h = window.location.hostname;
  if(h === 'phacolog.app' || h === 'www.phacolog.app'){
    return {
      url:  'https://SEU_PROD_ID.supabase.co',
      key:  'SUA_PROD_ANON_KEY'
    };
  }
  // staging.phacolog.app e localhost usam o mesmo projeto de staging
  return {
    url:  'https://SEU_STAGING_ID.supabase.co',
    key:  'SUA_STAGING_ANON_KEY'
  };
})();

var SUPABASE_URL     = _SUPABASE_CONFIG.url;
var SUPABASE_ANON_KEY = _SUPABASE_CONFIG.key;
```

> **Nota de segurança:** A `anon key` é projetada para ser pública — o RLS do banco protege os dados. Nunca coloque a `service_role_key` no frontend.

---

## Fase 3 — CI/CD e fluxo de trabalho

### 3.1 Estratégia de branches

Criar a branch `develop` no repositório:

```bash
git checkout -b develop
git push -u origin develop
```

**Fluxo de trabalho a partir de agora:**

```
# 1. Começar uma nova feature ou correção
git checkout develop
git pull origin develop
git checkout -b feature/nome-da-feature

# 2. Desenvolver e commitar normalmente
git add index.html
git commit -m "feat: descrição"

# 3. Abrir PR para develop (vai para staging)
git push origin feature/nome-da-feature
# → Abrir PR no GitHub: feature/nome-da-feature → develop

# 4. Após aprovação e merge, testar em staging.phacolog.app

# 5. Quando validado, abrir PR de develop → main
# → Abrir PR no GitHub: develop → main
# → Requer 1 aprovação
# → Merge → deploy automático em phacolog.app
```

---

### 3.2 GitHub Actions

Crie o arquivo `.github/workflows/deploy.yml` no repositório:

```yaml
name: Deploy

on:
  push:
    branches:
      - main
      - develop

jobs:
  deploy:
    name: Deploy to Cloudflare Pages
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Deploy
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: phacolog
          directory: .
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
          branch: ${{ github.ref_name }}
```

> **Por que usar GitHub Actions em vez do deploy automático do Cloudflare?**  
> O GitHub Actions permite adicionar etapas futuras antes do deploy: validação de HTML, testes automatizados, lint, etc. O deploy automático do Cloudflare não passa por essas checagens.

---

### 3.3 Secrets no GitHub

1. Acesse `github.com/phacolog/app/settings/secrets/actions`
2. Clique em **New repository secret** e adicione:

| Secret | Como obter |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Create Token → "Edit Cloudflare Pages" template |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare → qualquer página → barra lateral direita → Account ID |

---

### 3.4 Remover service role key do código

O arquivo `scripts/seed-demo-node.js` tem a service role key hardcoded — isso significa que ela está no histórico do Git e potencialmente exposta. Corrija assim:

```javascript
// ANTES (inseguro — chave no código):
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsIn...';

// DEPOIS (lê da variável de ambiente):
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!SERVICE_ROLE_KEY){
  console.error('SUPABASE_SERVICE_ROLE_KEY não definida. Execute:');
  console.error('export SUPABASE_SERVICE_ROLE_KEY=sua_chave');
  process.exit(1);
}
```

Para rodar o script localmente:
```bash
# PowerShell
$env:SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsIn..."
node scripts/seed-demo-node.js

# bash/zsh
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsIn..." node scripts/seed-demo-node.js
```

> **Atenção:** A chave antiga (`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dmxhcGdzcmxqdmplbm5lb2JmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjU0Njg3NywiZXhwIjoyMDkyMTIyODc3fQ.Qwc4R8hEUtAQvUxlcSqElfj09b_JlgCqXL7dS5skNzc`) ficará no histórico do Git.  
> Após mover para o novo projeto Supabase, essa chave ficará inválida automaticamente — o que resolve o problema.  
> Se precisar invalidá-la antes, acesse Settings → API → Reveal service_role key → Reset.

---

## Fase 4 — Observabilidade e governança

### 4.1 Sentry (monitoramento de erros)

**Objetivo:** Receber alerta quando um usuário real encontrar um erro JavaScript.

#### 4.1.1 Criar conta

1. Acesse [sentry.io](https://sentry.io) → Get Started
2. Use `dev@phacolog.app`
3. Plano: **Free** (5.000 erros/mês, suficiente para começar)
4. Crie uma organização: `phacolog`
5. Crie um projeto: **Browser JavaScript** → nome `phacolog-prod`

#### 4.1.2 Instalar no index.html

Após criar o projeto, o Sentry fornece um DSN (URL única). Adicione no `<head>` do `index.html`, **antes de qualquer outro script**:

```html
<!-- Sentry — monitoramento de erros (apenas em produção) -->
<script>
  if(window.location.hostname === 'phacolog.app'){
    var s=document.createElement('script');
    s.src='https://browser.sentry-cdn.com/7.x.x/bundle.min.js';
    s.crossOrigin='anonymous';
    s.onload=function(){
      Sentry.init({
        dsn: 'https://SEU_DSN@o0.ingest.sentry.io/0',
        release: 'phacolog@1.0.0',
        environment: 'production'
      });
    };
    document.head.appendChild(s);
  }
</script>
```

> Substitua `'https://SEU_DSN...'` pelo DSN fornecido pelo Sentry após criar o projeto.

#### 4.1.3 Criar projeto separado para Staging (opcional)

1. No Sentry → Projects → New Project → Browser JavaScript
2. Nome: `phacolog-staging`
3. Use o DSN deste projeto no bloco condicional para `staging.phacolog.app`

---

### 4.2 UptimeRobot (uptime)

**Objetivo:** Ser notificado imediatamente se o site cair.

1. Acesse [uptimerobot.com](https://uptimerobot.com) → Get Started Free
2. Use `dev@phacolog.app`
3. **Add New Monitor**:
   - Monitor Type: **HTTPS**
   - Friendly Name: `Phacolog PROD`
   - URL: `https://phacolog.app`
   - Monitoring Interval: **5 minutes**
   - Alert Contacts: adicione os e-mails dos sócios
4. Repita para `https://staging.phacolog.app` (nome: `Phacolog Staging`)

---

### 4.3 Checklist de acesso e permissões

Ao final da configuração, verifique que **todos os recursos críticos** estão sob o e-mail `dev@phacolog.app` e que os dois sócios têm acesso como owners/admins:

| Serviço | Owner (conta principal) | Rodrigo | Felipe |
|---|---|---|---|
| Registrador de domínio | `dev@phacolog.app` | Acesso | Acesso |
| Cloudflare | `dev@phacolog.app` | Admin | Admin |
| GitHub Org `phacolog` | `dev@phacolog.app` | Owner | Owner |
| Supabase Org `Phacolog` | `dev@phacolog.app` | Owner | Owner |
| Google Cloud `phacolog-prod` | `dev@phacolog.app` | Owner | Owner |
| Google Cloud `phacolog-staging` | `dev@phacolog.app` | Owner | Owner |
| Sentry Org `phacolog` | `dev@phacolog.app` | Admin | Admin |
| UptimeRobot | `dev@phacolog.app` | — | — |

**Regra geral:** Nenhum recurso crítico fica preso à conta pessoal de nenhum dos dois sócios. Em caso de saída de qualquer pessoa, o produto continua operando.

---

### 4.4 Documentação do repositório

Criar os arquivos abaixo no repositório `phacolog/app`:

#### README.md (raiz do repositório)

```markdown
# Phacolog

Logbook cirúrgico para residentes de oftalmologia.

## Ambientes

| Ambiente | URL | Branch |
|---|---|---|
| Produção | https://phacolog.app | `main` |
| Staging | https://staging.phacolog.app | `develop` |

## Stack

- Frontend: HTML + CSS + JavaScript (single file `index.html`)
- Backend: Supabase (Auth + PostgreSQL + Edge Functions)
- Hosting: Cloudflare Pages
- CI/CD: GitHub Actions

## Como rodar localmente

Abra `index.html` diretamente no navegador, ou use um servidor local:

```bash
# Python
python -m http.server 5500

# Node
npx serve .
```

O app detecta `localhost` e usa automaticamente o projeto Supabase de staging.

## Como fazer deploy

Ver [CONTRIBUTING.md](CONTRIBUTING.md).
```

#### CONTRIBUTING.md

```markdown
# Como contribuir

## Fluxo de branches

```
main      → produção (phacolog.app)
develop   → staging  (staging.phacolog.app)
feature/* → desenvolvimento
fix/*     → correções
```

## Passo a passo

1. Crie uma branch a partir de `develop`:
   ```bash
   git checkout develop && git pull
   git checkout -b feature/minha-feature
   ```

2. Faça as alterações em `index.html` (e outros arquivos se necessário)

3. Commit com mensagem descritiva:
   ```bash
   git commit -m "feat: descrição da funcionalidade"
   ```
   Prefixos: `feat:` (novo) · `fix:` (correção) · `chore:` (infra) · `docs:` (documentação)

4. Abra um PR para `develop` no GitHub
   - O deploy para staging acontece automaticamente após o merge

5. Teste em https://staging.phacolog.app

6. Quando validado, abra um PR de `develop` → `main`
   - Requer 1 aprovação
   - O deploy para produção acontece automaticamente após o merge

## Nunca faça push direto na main
```

---

## Referência rápida

### IDs e URLs — preencher após execução

| Item | Valor |
|---|---|
| Domínio | `phacolog.app` |
| E-mail do projeto | `dev@phacolog.app` |
| GitHub Org | `github.com/phacolog` |
| Repositório | `github.com/phacolog/app` |
| Supabase PROD ID | *(preencher)* |
| Supabase PROD URL | `https://_________.supabase.co` |
| Supabase PROD Anon Key | *(preencher)* |
| Supabase Staging ID | *(preencher)* |
| Supabase Staging URL | `https://_________.supabase.co` |
| Supabase Staging Anon Key | *(preencher)* |
| Cloudflare Account ID | *(preencher)* |
| Sentry DSN PROD | *(preencher)* |

### Custos mensais estimados

| Serviço | Custo |
|---|---|
| Domínio `phacolog.app` | ~R$ 7/mês (US$ 12/ano) |
| Cloudflare Pages | Grátis |
| Supabase (2 projetos free) | Grátis |
| GitHub (org free) | Grátis |
| Sentry (free tier) | Grátis |
| UptimeRobot (free) | Grátis |
| **Total** | **~R$ 7/mês** |

### Comandos úteis

```bash
# Linkar CLI ao projeto prod
supabase link --project-ref SEU_PROD_ID

# Linkar CLI ao projeto staging
supabase link --project-ref SEU_STAGING_ID

# Deploy de edge function
supabase functions deploy send-push --no-verify-jwt
supabase functions deploy partner-data

# Rodar seed da conta demo (staging)
SUPABASE_SERVICE_ROLE_KEY="..." node scripts/seed-demo-node.js

# Ver logs de uma edge function
supabase functions logs send-push
```
