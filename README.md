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
  public/
    assets/
      moto.png
  src/
    config/
      gameConfig.js
    entities/
      moto.js
    scenes/
      GameScene.js
    systems/
      InputSystem.js
    ui/
      DebugHUD.js
    world/
      Map.js
      TrackMap.js
    main.js
    style.css
```

## Flujo online

- Sala unica de hasta 4 jugadores.
- Login rapido con username corto antes de entrar a sala.
- El host ve boton `Play` para iniciar.
- Todos cargan el mapa 4 al iniciar.
- La partida termina para todos cuando un jugador completa la ruta.
- Host puede reiniciar sala con `R` al finalizar.

## Notas

- Los archivos que no estan conectados al juego se movieron a `repartidor-io/unused-assets/`.
- Esta version usa solo sprite PNG para evitar dependencias de mapas Tiled por ahora.
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
