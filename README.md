# juego-io

Juego tipo repartidor construido con Phaser + Vite.

## Requisitos

- Node.js LTS
- npm

## Ejecutar proyecto

```bash
cd repartidor-io
npm install
npm run dev
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

## Controles

- Flechas: mover y girar
- Shift: derrape
- Space: freno
- 1: mapa abierto
- 2: mapa pista

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
