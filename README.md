# 🎸 Guitar Duels

Jogo de ritmo de guitarra com multiplayer local 1v1 por código de sala.
Funciona localmente e na Vercel.

## Como rodar localmente

```bash
npm install
npm run dev
```
Acesse **http://localhost:3000** — não precisa de .env nem banco de dados!

## Deploy na Vercel

1. Importe o projeto na Vercel
2. Adicione a variável de ambiente:
   ```
   NEXT_PUBLIC_SITE_URL=https://seu-projeto.vercel.app
   ```
3. Deploy! ✅

## Adicionar músicas

Edite `public/songs/songs-index.json` para registrar suas músicas.
Cada música precisa de uma pasta em `public/songs/<id>/` com:

```
public/songs/
  minha-musica/
    chart.json    ← notas (obrigatório)
    meta.json     ← metadados (nome, artista, dificuldade)
    song.ogg      ← áudio (opcional)
    album.png     ← capa (opcional)
```

Depois adicione no `songs-index.json`:
```json
[
  {
    "id": "minha-musica",
    "name": "Nome da Música",
    "artist": "Artista",
    "difficulty": 3
  }
]
```

Também aceita músicas do **Clone Hero** (pasta com `notes.chart` + `song.ini`).

## Controles

| Tecla | Fret       |
|-------|------------|
| A     | 🟢 Verde   |
| S     | 🔴 Vermelho|
| D     | 🟡 Amarelo |
| J     | 🔵 Azul    |
| K     | 🟠 Laranja |
| ESC   | Pausar     |
