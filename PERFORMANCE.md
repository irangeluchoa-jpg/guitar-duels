# 🚀 Guitar Duels — Guia de Performance

## O que foi otimizado nesta versão

### ✅ Já implementado no código

| Otimização | Impacto | Onde |
|---|---|---|
| Imagens WebP | **-88% tamanho** (fretboard: 1MB → 126KB) | `/public/*.webp` |
| Cache de songs (sessionStorage) | Elimina re-fetch ao voltar ao menu | `song-select.tsx` |
| Cache API `/songs` 5 min | Evita leitura de 100+ arquivos por request | `app/api/songs/route.ts` |
| Cache charts em memória | Mesma música = zero fetch na segunda vez | `github-songs.ts` |
| ETag + 7 dias cache áudio | Browser não re-baixa música já ouvida | `app/api/songs/file/route.ts` |
| Compressão gzip/brotli | -60-70% tamanho das respostas HTTP | `next.config.mjs` |
| Compressão Socket.IO | -60-70% dados do multiplayer | `server.js` |
| DNS prefetch GitHub/Supabase | Conexão mais rápida na primeira visita | `app/layout.tsx` |
| 🥔 Modo Batata | Remove todos efeitos pesados do Canvas | Settings → Visual |

---

## O que você pode fazer no Railway/servidor

### 1. Configurar região mais próxima do Brasil
No Railway, escolha **South America (São Paulo)** como região do deploy.
Isso reduz latência de ~180ms para ~15ms para usuários brasileiros.

```
Railway Dashboard → Seu projeto → Settings → Region → South America (São Paulo)
```

### 2. Variáveis de ambiente importantes
```env
NODE_ENV=production          # garante otimizações do Node.js
NODE_OPTIONS=--max-old-space-size=512  # limita RAM a 512MB
```

### 3. Ativar Sleep Prevention no Railway
Por padrão o Railway "dorme" instâncias inativas. Configure um cron job ou use:
- **UptimeRobot** (gratuito): pinga seu site a cada 5 min para mantê-lo acordado
- URL para pingar: `https://seu-site.up.railway.app/api/songs`

---

## O que fazer no Supabase

### 1. Ativar pgBouncer (connection pooling)
No Supabase Dashboard → Settings → Database → Connection Pooling → Ativar

### 2. Criar índice na tabela global_scores
```sql
CREATE INDEX IF NOT EXISTS idx_global_scores_track_score 
  ON global_scores(track_id, score DESC);

CREATE INDEX IF NOT EXISTS idx_daily_scores_day_score
  ON daily_scores(day, score DESC);
```
Isso faz as queries do leaderboard ficarem **10-50x mais rápidas**.

### 3. Verificar queries lentas
Supabase Dashboard → Reports → Query Performance

---

## Otimizações futuras (quando o jogo crescer)

### CDN para as músicas
Hoje as músicas ficam no Railway (servidor Node.js). O ideal seria:
- **Cloudflare R2** (grátis até 10GB): bucket S3 com CDN global automático
- **Vercel Blob**: integrado ao Next.js, CDN automático

Isso reduziria o tempo de carregamento de áudio de 2-5s para < 500ms.

### Service Worker + Cache offline
Cachear as músicas já tocadas no browser do usuário:
```js
// songs já baixadas ficam disponíveis offline e carregam instantaneamente
self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/songs/file')) {
    e.respondWith(caches.match(e.request) || fetch(e.request))
  }
})
```

### WebWorker para o parser de charts
O `parseChart()` e `parseMidi()` podem ser movidos para um WebWorker
para não travar o thread principal enquanto carrega a música.

---

## Diagnóstico de lag

Se o jogo ainda tiver lag, abra o DevTools (F12) e verifique:

1. **Network tab**: Qual arquivo demora mais? Áudio? Chart? Songs list?
2. **Performance tab**: Grave 5 segundos de jogo. Procure frames > 16ms.
3. **Console**: Erros de `Failed to fetch`? Pode ser CORS ou servidor dormindo.

### Indicadores de FPS no jogo
Ative o **🥔 Modo Batata** nas configurações para verificar se o lag é do
renderer Canvas ou da rede. Se melhorar com Modo Batata = problema de GPU/CPU.
Se não melhorar = problema de rede/servidor.
