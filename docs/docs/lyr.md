# Letras (.lyr)

## Índice

1. [Resumen](#resumen)
2. [Formato del archivo](#formato-del-archivo)
3. [Campos de cabecera](#campos-de-cabecera)
4. [Líneas de letra con timestamp](#líneas-de-letra-con-timestamp)
5. [Ejemplo completo](#ejemplo-completo)
6. [Constantes del motor](#constantes-del-motor)
7. [Funciones del motor](#funciones-del-motor)
8. [Flujo de carga](#flujo-de-carga)
9. [Notas y consejos](#notas-y-consejos)

---

## Resumen

El motor de letras de la barra AGS lee archivos con extensión `.lyr` almacenados en `~/lyrics/`. Cada archivo contiene los metadatos de una canción y sus letras con timestamps de inicio y fin por línea. El motor indexa todos los archivos al arrancar y los mantiene en caché en memoria para minimizar lecturas de disco.

Las letras se muestran en la **píldora derecha** de la barra de música (ver [AGS Bar → LyricsViewer](ags.md#musicbartsx--barra-de-música)).

---

## Formato del archivo

Los archivos `.lyr` son texto plano. Tienen dos secciones:

1. **Cabecera**: pares `clave: "valor"` para los metadatos.
2. **Letra**: líneas con timestamps en formato `(inicio - fin): "texto"`.

Las líneas que empiezan con `#` son **comentarios** y se ignoran. Las líneas vacías también se ignoran.

```
# Comentario opcional
name: "Nombre oficial de la canción"
author: "Artista principal"
author_other: "Otro nombre del artista, Nombre alternativo"
other: "Título alternativo, Otro título"

(0:10 - 0:14): "Primera línea de letra"
(0:14 - 0:18): "Segunda línea"
(0:18.500000 - 0:22): "Con precisión de microsegundos"
```

---

## Campos de cabecera

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `name:` | Recomendado | Título de la canción tal como aparece en el reproductor. Se usa para el matching. |
| `author:` | Recomendado | Nombre del artista principal. |
| `author_other:` | **Opcional** | Lista de artistas alternativos o colaboradores, separados por comas. Permite que el mismo `.lyr` se cargue cuando la canción aparece bajo diferentes nombres de artista (ej. versión de karaoke, feat, remix). |
| `other:` | Opcional | Títulos alternativos de la canción separados por comas. Útil si la canción tiene títulos distintos en diferentes plataformas. |

### Ejemplo de `author_other`

```
name: "Flowers"
author: "Miley Cyrus"
author_other: "Miley Cyrus, Miles C"
```

Esto permite que el archivo se encuentre aunque el reproductor muestre el artista como "Miles C".

---

## Líneas de letra con timestamp

Cada línea de letra tiene el formato:

```
(MM:SS - MM:SS): "texto de la letra"
```

- **`MM:SS`**: minutos y segundos. Puede incluir fracciones de segundo: `MM:SS.ffffff` (hasta microsegundos).
- El motor convierte los tiempos a **microsegundos** internamente para sincronía exacta con la posición del reproductor.
- El texto puede estar vacío `""` para pausas sin letra.
- Si `inicio >= fin`, la línea se descarta con un warning en la consola.

### Formato de timestamp extendido

```
(1:23.500000 - 1:27.200000): "Línea con precisión alta"
```

Las fracciones se rellenan a 6 dígitos: `1:23.5` → `1:23.500000`.

---

## Ejemplo completo

```
# flowers.lyr
name: "Flowers"
author: "Miley Cyrus"
author_other: "Miley Cyrus, Miles C"
other: "Flowers (Official)"

(0:00 - 0:18): ""
(0:18 - 0:22): "We were good, we were gold"
(0:22 - 0:26): "Kinda dream that can't be sold"
(0:26 - 0:30): "We were right till we weren't"
(0:30 - 0:34): "Built a home and watched it burn"
(0:34 - 0:42): ""
(0:42 - 0:46): "I didn't want to leave you"
(0:46 - 0:50): "I didn't want to lie"
```

!!! tip "Nombre del archivo"
    El nombre del archivo (sin extensión) también se usa como clave de búsqueda. `flowers.lyr` permite encontrar la canción buscando "flowers".

---

## Constantes del motor

Definidas en `~/.config/ags/widget/MusicBar.tsx`:

| Constante | Valor | Descripción |
|-----------|-------|-------------|
| `LYRICS_DIR` | `~/lyrics` | Directorio donde se buscan los `.lyr` |
| `MAX_CACHE` | `200` | Máximo de entradas en caché de memoria |
| `DECAY_λ` | `0.001` | Factor de decaimiento para puntuación de caché |
| `NO_TRACK` | `/org/mpris/.../NoTrack` | ID MPRIS de "sin pista activa" |

---

## Funciones del motor

### `normalizeSongStr(s)`

Normaliza una cadena para comparación fuzzy:
- Convierte a minúsculas.
- Elimina paréntesis comunes: `(Remastered)`, `(Live)`, `(feat. X)`, `(Explicit)`, etc.
- Elimina caracteres no alfanuméricos.
- Colapsa espacios múltiples.

```typescript
normalizeSongStr("Flowers (Remastered 2023)") // → "flowers"
normalizeSongStr("Lo Que Siento (feat. Cuco)") // → "lo que siento"
```

---

### `parseTimeMicros(raw)`

Convierte un string de timestamp `"MM:SS.ffffff"` a un número de **microsegundos**.

```typescript
parseTimeMicros("1:23")        // → 83_000_000
parseTimeMicros("1:23.5")      // → 83_500_000
parseTimeMicros("0:18.500000") // → 18_500_000
```

---

### `parseLyrFile(path, content)`

Parsea el contenido completo de un archivo `.lyr` y devuelve un objeto `LyricFile`:

```typescript
interface LyricFile {
  path:        string        // Ruta absoluta del archivo
  name:        string | null // Campo name:
  other:       string[]      // Títulos alternativos (campo other:)
  author:      string | null // Artista principal
  authorOther: string[]      // Artistas alternativos (author_other:)
  lines:       LyricLine[]   // Líneas de letra con timestamps
}

interface LyricLine {
  start: number  // microsegundos
  end:   number  // microsegundos
  text:  string
}
```

El parser recorre el archivo línea a línea:

1. Ignora líneas vacías y comentarios (`#`).
2. Detecta campos de cabecera con regex.
3. Detecta líneas de letra con el patrón `(inicio - fin): "texto"`.
4. Descarta líneas con `start >= end`.

---

### `buildIndex()`

Escanea `~/lyrics/` y construye `lyricsIndex`, un `Map<string, LyricFile[]>` donde las claves son:

- El nombre del archivo (sin `.lyr`).
- El campo `name:` del archivo.
- Cada entrada del campo `other:`.

Todo en minúsculas. Múltiples archivos pueden compartir una clave.

---

### `watchLyricsDir()`

Usa `Gio.FileMonitor` para vigilar el directorio `~/lyrics/`. Cuando se detecta un cambio (archivo añadido, modificado o eliminado), llama a `buildIndex()` después de un debounce de **400 ms**.

Esto significa que puedes añadir o editar archivos `.lyr` sin reiniciar AGS.

---

### `lookupOnDisk(title, artist)`

Busca el mejor archivo `.lyr` para una canción dada. Algoritmo:

1. Normaliza `title` y `artist`.
2. Busca en `lyricsIndex` todas las claves que contengan o estén contenidas en el título normalizado.
3. Para cada candidato, calcula una puntuación con `scoreOf()`.
4. Devuelve el candidato con la mayor puntuación (≥ 0).

#### Puntuación `scoreOf(lf)`

| Condición | Puntuación |
|-----------|-----------|
| Artista no coincide (ni `author` ni `author_other`) | `-1` (descartado) |
| `name` coincide exactamente con el título | `3` |
| `name` contiene o es contenido por el título | `2` |
| Algún `other` coincide exactamente | `2` |
| Algún `other` contiene o es contenido por el título | `1` |
| Sin metadatos de nombre | `0` |

---

### `cacheLookup(songId, title, artist)`

Wrapper sobre `lookupOnDisk` con caché en memoria (`lyricCache`). La caché:

- Identifica canciones por `songId` (basado en `trackid` MPRIS o `artista|título` normalizado).
- Incrementa un contador de reproducciones y actualiza `lastPlayedAt`.
- Si la caché supera `MAX_CACHE` entradas, expulsa la de menor puntuación usando decaimiento exponencial:

```typescript
score = playCount * Math.exp(-DECAY_λ * segundos_desde_última_vez)
```

---

### `findActiveLine(lines, posMicros)`

Dado un array de `LyricLine[]` y la posición actual de reproducción en microsegundos, devuelve el índice de la línea activa: aquella cuyo `start <= pos < end`. Retorna `-1` si ninguna línea está activa en ese momento.

---

## Flujo de carga

```
AGS arranque
    └── buildIndex()          — lee ~/lyrics/, llena lyricsIndex
    └── watchLyricsDir()      — inicia monitor de cambios

Track cambia (MPRIS event)
    └── buildSongId()         — genera ID único para la pista
    └── cacheLookup()
            └── lyricCache hit?  → retorna inmediatamente
            └── lookupOnDisk()   → busca en lyricsIndex
                    └── scoreOf() por cada candidato
                    └── retorna mejor match o null
    └── LyricsViewer actualiza líneas

Cada ~100ms (poll del flyout)
    └── player.position → microsegundos
    └── findActiveLine() → índice de línea activa
    └── LyricsViewer resalta línea activa
```

---

## Notas y consejos

!!! tip "Cómo añadir letras"
    1. Crea `~/lyrics/nombre-cancion.lyr`
    2. Añade la cabecera con `name:` y `author:`
    3. Añade las líneas con timestamps
    4. AGS detecta el archivo automáticamente (sin reiniciar)

!!! warning "Timestamps incorrectos"
    Si `inicio >= fin` en una línea, se descarta silenciosamente excepto por un `console.warn`. Revisa la consola de AGS si alguna línea no aparece.

!!! note "Canciones con múltiples artistas"
    Usa `author_other:` para cubrir casos donde la misma canción aparece bajo distintos nombres de artista. El campo es opcional y puede tener tantas entradas como necesites, separadas por comas.

!!! tip "Herramientas útiles"
    - [LRC Maker online](https://lrcmaker.com) — para crear letras con timestamps exportables
    - Los archivos LRC estándar necesitan conversión al formato `.lyr` (los timestamps usan formato diferente)
