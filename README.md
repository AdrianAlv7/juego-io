# juego-io

Juego tipo repartidor construido con Phaser + Vite.

## Requisitos

- Node.js LTS
- npm

## Ejecutar proyecto (multijugador)

```bash
cd repartidor-io
npm install
npm run dev:server
```

En otra terminal:

```bash
cd repartidor-io
npm run dev:client
```

El cliente conecta por defecto a `http://localhost:3000`.
No necesitas pasar `--host`: Vite ya queda expuesto en LAN desde `vite.config.js`.

Para pruebas en otro dispositivo:

1. Abre en el dispositivo cliente `http://IP_DE_TU_PC:5173`.
2. Socket.IO usa esa misma IP automaticamente (`http://IP_DE_TU_PC:3000`).

Solo si quieres forzar otra URL de socket:

```bash
set VITE_SOCKET_SERVER_URL=http://192.168.1.50:3000
npm run dev:client
```

## Compartir por internet con LocalTunnel

Si quieres mandar un link publico (sin abrir puertos del router), usa LocalTunnel.

### Modo rapido (cliente web)

Instalas el paquete global:

```bash
npm install -g localtunnel
```

Luego corres tu juego normalmente:

```bash
cd repartidor-io
npm run dev
```

Tu dev server queda en `http://localhost:5173`.

En otra terminal ejecutas:

```bash
lt --port 5173
```

LocalTunnel crea un tunel hacia tu PC y te devuelve algo como:

```text
https://purple-dog-12.loca.lt
```

Ese link:

- apunta a tu localhost
- cualquier persona puede abrirlo
- sirve para probar tu juego online

### Modo multijugador completo (cliente + Socket.IO)

Para que un amigo juegue online en la misma sala, tambien debes exponer el socket server (`3000`).

Terminal 1 (socket server):

```bash
cd repartidor-io
npm run dev:server
```

Terminal 2 (tunel para socket server):

```bash
lt --port 3000
```

Guarda esa URL (ejemplo: `https://blue-server-77.loca.lt`) y usala al levantar el cliente:

```bash
cd repartidor-io
set VITE_SOCKET_SERVER_URL=https://blue-server-77.loca.lt
npm run dev
```

En PowerShell puedes usar:

```bash
$env:VITE_SOCKET_SERVER_URL="https://blue-server-77.loca.lt"
npm run dev
```

Terminal 3 (tunel para cliente web):

```bash
lt --port 5173
```

Comparte la URL `https://...loca.lt` del cliente con tu amigo.

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
