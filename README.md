# juego-io

Juego tipo repartidor construido con Phaser + Vite.

## Requisitos

- Node.js LTS
- npm

## Instalacion rapida

1. Clona el repositorio:

```bash
git clone https://github.com/tu-usuario/repartidor-io.git
cd repartidor-io
```

2. Instala dependencias:

```bash
cd repartidor-io
npm install
```

3. Inicia el servidor del juego:

```bash
cd repartidor-io
npm run dev:server
```

4. En otra terminal inicia el cliente:

```bash
cd repartidor-io
npm run dev
```

5. Abre el juego en tu navegador:

```text
http://localhost:5173
```

## Probar con amigos por internet

Este proyecto ahora usa Cloudflare Quick Tunnel con `cloudflared`.

### Instalar Cloudflare Tunnel

En Windows:

```bash
winget install --id Cloudflare.cloudflared
```

Si la terminal no reconoce `cloudflared` despues de instalarlo, cierra y abre la terminal otra vez.

Verifica la instalacion:

```bash
cloudflared --version
```

### Flujo recomendado

1. En la terminal 1, levanta el servidor del juego:

```bash
cd repartidor-io
npm run dev:server
```

2. En la terminal 2, crea un tunel para el backend:

```bash
cloudflared tunnel --url http://localhost:3000
```

3. Cloudflare te dara una URL como esta:

```text
https://abc123.trycloudflare.com
```

4. Crea el archivo `repartidor-io/.env` usando `repartidor-io/.env.example` como base.

En Windows:

```bash
cd repartidor-io
copy .env.example .env
```

En macOS/Linux/Git Bash:

```bash
cd repartidor-io
cp .env.example .env
```

5. Edita `repartidor-io/.env` y reemplaza el valor por la URL del tunel del backend:

```env
VITE_SOCKET_SERVER_URL=https://abc123.trycloudflare.com
```

Importante:

- esa URL debe ser la del tunel de `3000`
- no pongas aqui la URL del cliente en `5173`
- si Cloudflare cambia la URL del backend, debes volver a editar `.env`

6. Ahora si arranca el cliente:

```bash
cd repartidor-io
npm run dev
```

7. En otra terminal crea un tunel para el cliente:

```bash
cloudflared tunnel --url http://localhost:5173
```

8. Comparte ese link con tu amigo.

Importante:

- la URL del backend y la del cliente normalmente son distintas
- la URL del backend va en `repartidor-io/.env`
- cada Quick Tunnel cambia de URL en cada ejecucion
- si cambia la URL del backend, actualiza `.env` y vuelve a correr `npm run dev`
- `vite.config.js` ya permite `*.trycloudflare.com`

## Archivo `.env.example`

Si otros van a probar el proyecto seguido, deja una configuracion base:

```env
VITE_SOCKET_SERVER_URL=http://localhost:3000
```

Luego cada quien puede crear su `.env`.

En Windows:

```bash
copy .env.example .env
```

En macOS/Linux/Git Bash:

```bash
cp .env.example .env
```

## Si se queda en "Conectando a sala..."

Revisa este orden:

1. `npm run dev:server` sigue corriendo.
2. `cloudflared tunnel --url http://localhost:3000` sigue abierto.
3. `repartidor-io/.env` tiene la URL actual del backend.
4. Esa URL es la del tunel de `3000`, no la del cliente en `5173`.
5. Reiniciaste `npm run dev` despues de cambiar `.env`.

En desarrollo tambien puedes abrir la consola del navegador.
El cliente imprime la URL exacta del socket con este mensaje:

```text
[socket] connecting to ...
```

## Build de produccion

```bash
cd repartidor-io
npm run build
```

## Estructura actual

```text
repartidor-io/
  server/
    index.js
  public/
    assets/
      moto.png
  src/
    config/
      gameConfig.js
    entities/
      moto.js
    events/
      weather/
    items/
    network/
    scenes/
      GameScene.js
    systems/
      InputSystem.js
    ui/
      DebugHUD.js
    world/
      activeMap.js
      race/
      tiled/
  tiled/
    mapa1.json
    map.png
  unused-assets/
    legacy-tiled/
    template/
    unused-source/
    main.js
    style.css
```

## Flujo online

- Ya no existe una sola sala global.
- Cada jugador entra primero con username y luego elige uno de estos modos:
- `Publica`: el server busca una sala publica abierta y te mete ahi; si no hay, crea una nueva.
- `Crear privada`: crea una sala privada nueva. Si escribes codigo, intenta usarlo; si lo dejas vacio, genera uno automaticamente.
- `Unirme con codigo`: entra a una sala privada existente usando su codigo.
- Cada sala sigue teniendo maximo `4` jugadores.
- Dentro de cada sala, el host ve boton `PLAY` para iniciar.
- Al terminar la partida, los jugadores vuelven al lobby de su misma sala.
- Si todos abandonan una sala, esa sala se elimina del server.

### Tipos de sala

#### Sala publica

- Pensada para emparejar randoms.
- El server reutiliza la primera publica disponible que no haya empezado y tenga espacio.
- Si todas las publicas estan llenas o en partida, crea otra.

#### Sala privada

- Pensada para jugar con amigos.
- Se identifica con un codigo alfanumerico.
- El host puede crearla con codigo personalizado o dejar que el server lo genere.
- Otro jugador puede entrar escribiendo ese codigo.

## Notas

- Los archivos fuente no conectados al juego quedaron archivados en `repartidor-io/unused-assets/unused-source/`.
- El mapa activo actual sale de `repartidor-io/src/world/activeMap.js`.
- Esta version sigue usando un flujo Tiled para el mapa activo (`tiled/mapa1.json` + `tiled/map.png`).
- La simulacion de gameplay corre en pasos fijos de 60 Hz, para que 60 FPS y 165 FPS se sientan igual.
- La pista usa colision matematica (sin cientos de cuerpos fisicos), para evitar tirones y mejorar carga.

## Parametros de tuning (moto)

Archivo: `repartidor-io/src/entities/moto.js`

- `enginePower`: aceleracion base.
- `maxSpeed`: velocidad maxima.
- `brakePower`: fuerza base del freno.
- `drag`: friccion general (inercia).
- `lateralGrip`: agarre lateral (control del derrape).

## FPS y monitores de alta tasa

Archivo: `repartidor-io/src/config/gameConfig.js`

- `LOCK_TO_60_FPS = false`: deja render libre para monitores 120/144/165 Hz.
- `LOCK_TO_60_FPS = true`: bloquea render a 60 FPS.
- Aunque el render cambie, la logica de manejo queda estable por la simulacion fija en `GameScene.js`.

## Ajustes anti-lag de arranque/reapertura

Archivo: `repartidor-io/src/scenes/GameScene.js`

- `STARTUP_STABILIZE_FRAMES`: frames iniciales sin catch-up fuerte.
- `RESUME_STABILIZE_FRAMES`: frames de estabilizacion al volver de otra pestana.
- `DELTA_SPIKE_RESET_MS`: umbral para detectar un delta anormal y resetear acumulador.
- `MAX_CATCH_UP_STEPS`: maximo de pasos por frame para evitar trabones largos.

Valores recomendados actuales:

- `STARTUP_STABILIZE_FRAMES = 8`
- `RESUME_STABILIZE_FRAMES = 6`
- `DELTA_SPIKE_RESET_MS = 90`
- `MAX_CATCH_UP_STEPS = 4`

## Formula actual de resultados

Archivo principal: `repartidor-io/server/index.js`

Objetivo del sistema:

- `200 pts` es el score perfecto.
- Ese score perfecto solo ocurre si un jugador termina primero y ademas trae `100%` de calidad.
- El tiempo del primer lugar es la referencia para medir a todos los demas.

Formula para jugadores que si terminan:

```txt
deltaSeg = round((tiempoJugadorMs - tiempoPrimerLugarMs) / 1000)

calidadPts = clamp(calidadPorcentaje, 0, 100)
tiempoPts = round(100 * tiempoPrimerLugarMs / tiempoJugadorMs)

scoreFinal = calidadPts + tiempoPts
scoreFinal maximo = 200
```

Como se interpreta:

- El primer lugar siempre tiene `tiempoPrimerLugarMs = tiempoJugadorMs`.
- Por eso el primer lugar siempre conserva `100 pts` de tiempo.
- Entonces al primer lugar solo se le resta por calidad.
- No existe una barrera fija de `5s`, `7s` o `10s`.
- El castigo de tiempo es relacional: depende de que tan lejos quedaste respecto al tiempo real del primer lugar.

Ejemplos:

```txt
Primer lugar con calidad 100:
score = 100 + 100 = 200

Primer lugar con calidad 82:
score = 82 + 100 = 182

Segundo lugar en 45s con calidad 96, si el primero hizo 40s:
tiempoPts = round(100 * 40/45) = 89
score = 96 + 89 = 185

Primer lugar en 40s con calidad 20:
score = 20 + 100 = 120

Segundo lugar en 80s con calidad 100:
tiempoPts = round(100 * 40/80) = 50
score = 100 + 50 = 150
```

Con esto, un jugador puede seguir ganando por mucha calidad aunque haya llegado despues, pero de forma proporcional al tiempo real del lider y no por una ventana fija de segundos.

Desempate para jugadores que no terminan (`DNF`):

- Un `DNF` nunca se pone arriba de un jugador que si termino.
- Si dos o mas jugadores quedan `DNF`, el desempate se hace asi:

```txt
1. Mayor numero de etapa / pedido alcanzado (`objectiveIndex`)
2. Si empatan en etapa, mayor calidad viva registrada
3. Si siguen empatados, menor tiempo acumulado
```

Orden de etapas usado:

```txt
inicio -> R1 -> E1 -> R2 -> E2 -> R3 -> E3 -> final
```

Lectura practica:

- Ir mas a la derecha en esa secuencia te da mejor lugar.
- Si dos jugadores quedaron en la misma etapa, gana el que traia mejor calidad.
