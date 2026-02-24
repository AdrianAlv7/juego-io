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
    main.js
    style.css
```

## Controles

- Flechas: mover y girar
- Shift: derrape
- Space: freno

## Notas

- Los archivos que no estan conectados al juego se movieron a `repartidor-io/unused-assets/`.
- Esta version usa solo sprite PNG para evitar dependencias de mapas Tiled por ahora.
