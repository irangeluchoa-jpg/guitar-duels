# 🎸 Como Adicionar Músicas ao Guitar Duels

## Estrutura de Pastas

Cada música deve estar em uma subpasta dentro de `public/songs/`.
O nome da pasta vira o ID da música na URL.

```
public/songs/
  When You Were Young/
    song.ini              ← Metadados (nome, artista, etc.)
    notes.chart           ← Chart das notas (Clone Hero format)
    Content/
      Music/
        song_1.ogg        ← Áudio principal
        song_2.ogg        ← Áudio secundário (backing)
        preview.ogg       ← Preview (toca na seleção de música)
    album.jpg             ← Capa do álbum (opcional)
```

## Formato song.ini

```ini
[song]
name = When You Were Young
artist = The Killers
album = Sam's Town
year = 2006
genre = Rock
diff_guitar = 4
song_length = 241000
preview_start_time = 30000
```

## Formato notes.chart

Padrão Clone Hero. O jogo lê `ExpertSingle`, depois `HardSingle`, etc.

```
[Song]
{
  Resolution = 192
  Offset = 0
}
[SyncTrack]
{
  0 = B 120000
  0 = TS 4
}
[ExpertSingle]
{
  768 = N 0 0
  960 = N 1 0
  1152 = N 2 192
}
```

## Formato de Áudio Suportado

- `.ogg` (recomendado, melhor compressão)
- `.mp3`
- `.wav`

Os arquivos `.fsb.xen` são formato proprietário do Guitar Hero 
e **não podem ser lidos diretamente** pelo navegador.
Converta-os para `.ogg` usando ferramentas como:
- GHEx (Guitar Hero Extractor)
- Mogg Split + FFmpeg

## Exemplo meta.json (alternativa ao song.ini)

```json
{
  "id": "when-you-were-young",
  "name": "When You Were Young",
  "artist": "The Killers",
  "album": "Sam's Town",
  "year": "2006",
  "genre": "Rock",
  "charter": "Alguem",
  "difficulty": 4,
  "songLength": 241000,
  "previewStart": 30000
}
```
