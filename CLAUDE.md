# Phacolog — Contexto do projeto para Claude Code

## O que é
PWA de logbook cirúrgico para residentes de oftalmologia (cirurgia de catarata).
Single-file HTML/CSS/vanilla JS (`index.html`), hospedado no GitHub Pages (`/nse/`).
localStorage é o storage primário; Supabase é backup assíncrono (best-effort).

## Stack
- **Frontend**: HTML + CSS + JavaScript puro, sem frameworks, sem bundler
- **Backend**: Supabase (Auth + PostgreSQL + Edge Functions)
- **Hosting**: GitHub Pages → `https://cassebfelipe2.github.io/nse/`
- **Supabase project**: `lvvlapgsrljvjenneobf` (URL: `https://lvvlapgsrljvjenneobf.supabase.co`)

## Arquivo principal
`index.html` — contém todo o app (HTML + CSS + JS em um único arquivo).
Não criar arquivos JS/CSS separados. Toda mudança vai neste arquivo.

## Restrições críticas de iOS WebView (nunca violar)
O app roda como PWA instalada no iPhone. O JavaScriptCore do iOS WebView é mais restritivo:
- **Sem optional chaining** (`?.`) — usar checagens explícitas `if(x && x.y)`
- **Sem default parameters** — `function f(a, b)` em vez de `function f(a, b=0)`
- **Sem spread em Math.min/max** — usar loop manual
- **Sem array destructuring em forEach/map** — usar `function(e){ var k=e[0] }`
- **Sem Google Fonts** — usar `-apple-system, BlinkMacSystemFont, 'SF Pro Display', Georgia, serif`

## Fontes (design system)
```css
--fontDisplay: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Georgia, serif;
--fontUI:      -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;
--fontMono:    ui-monospace, 'SF Mono', 'Menlo', 'Monaco', 'Cascadia Mono', monospace;
```

## Cores principais (CSS vars em `:root`)
```css
--bg: #F6F2EC      /* fundo geral */
--card: #FFFFFF    /* cards */
--accent: #C85A28  /* laranja principal */
--border: #E6DDD0
--muted: #8C7B6E
--black: #221611
```

## Navegação
- `goPage(p)` — navega para `page-{p}`, remove `.active` de todas as pages
- `goBack()` — volta para `prevPage`
- `prevPage` / `currentPage` — variáveis globais de estado de navegação
- Todas as sub-páginas (mapa, fila, notas, importar) têm botão `.detail-back` com `onclick="goBack()"`

## Storage
- `db` — array global de cirurgias (salvo em `localStorage` via `save()`)
- `filaDB` — array global da fila cirúrgica
- `save()` — persiste `db` e `filaDB` no localStorage
- `syncOneSurgery(p)` — sincroniza uma cirurgia para o Supabase (assíncrono, best-effort)

## Objeto cirurgia (formato localStorage)
```js
{
  id: String(Date.now()),     // PK local
  nome, dataCirurgia, idade, prontuario, telefone, convenio,
  olho,                       // 'OD' | 'OE' | 'AO'
  tecnica,                    // 'Faco' | 'MSICS' | 'Extra'
  aparelho, orientacao, anestesia, catGrau, obsPreOp,
  lioModelo, lioPoder, lioTipo, lioMat,
  avPre,                      // AV pré-operatória (campo livre)
  intercorrencias,            // array de strings; ['Sem intercorrências'] se nenhuma
  obsIntra,
  mental: { confianca, controle, estresse, obs },  // 1-5
  cirurgiao,                  // nome do residente
  posOps: {                   // chaves: 'D1', 'D7', 'D30'
    D1: { data, av, avcc, pio, ref, ca, cornea, obs, conduta, proximoRetorno },
    ...
  }
}
```

## Supabase — schema principal
```
users:         id, email, name, role, service_id, created_at
surgeries:     id, user_id, local_id, patient_hash, surgery_date, technique, ...
followups:     id, surgery_id, type (D1/D7/D30), completed_at, visual_acuity, avcc, pio, ...
complications: id, surgery_id, step, type, severity
push_subscriptions: user_id (PK), subscription (JSONB)
```

## LGPD
PII nunca sai do dispositivo. `patient_hash = SHA-256(nome + prontuario + userSalt)`.
Nome, telefone e prontuário nunca são enviados ao Supabase.

## Web Push
- **VAPID public key** (em `index.html`): `BJJmSppOXlmVU8TxjAa2W7BW4rnWe8_D4Mx0JBB63CMa-caHIqk-5tBil5qLQRlnsJXOYbcys-9D9nkWy8P6IPk`
- **Edge Function** `send-push`: dispara todo dia às 23:00 UTC (20:00 BRT) via pg_cron
- Secrets (VAPID_PRIVATE_KEY, CRON_SECRET) estão no Supabase — pedir ao Felipe

## Service Worker
`sw.js` — trata eventos `push` e `notificationclick`. Ícones em `/nse/icon-*.png`.

## FAB (botão hamburguer)
`#fab-btn` → abre `#fab-panel`. Fechar com `closeFabMenu()`.
Padrão de cada item:
```html
<button onclick="FUNCAO();closeFabMenu()" style="display:flex;align-items:center;gap:12px;width:100%;padding:13px 18px;background:none;border:none;cursor:pointer;font-size:0.82rem;font-weight:600;color:var(--black);text-align:left">
  <span style="width:32px;height:32px;border-radius:50%;background:var(--bgDeep);display:flex;align-items:center;justify-content:center;flex-shrink:0">
    <svg .../>
  </span>
  Rótulo
</button>
```

## Toasts e alertas
- `showToast(msg)` ou `showToast(msg, {label:'Texto botão', fn: callback})` — nunca usar `alert()`

## Convenções de código
- Comentários só quando o motivo não é óbvio
- Sem TypeScript, sem JSX, sem imports/exports
- Variáveis com `var` (não `let`/`const`) nas funções sync-to-Supabase (compatibilidade iOS)
- Nas funções novas, `const`/`let` é aceitável se não afetar iOS
- Sem abstrações prematuras — o arquivo grande e plano é intencional

## Deploy
```bash
git add index.html && git commit -m "..." && git push
# GitHub Pages serve automaticamente em ~30s
```

## Edge Functions
```bash
supabase link --project-ref lvvlapgsrljvjenneobf
supabase functions deploy send-push --no-verify-jwt
supabase secrets set CHAVE=valor
```
