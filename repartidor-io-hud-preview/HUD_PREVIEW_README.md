# HUD Preview (carpeta separada)

Esta carpeta es un clon de `repartidor-io` para validar el look del HUD sin tocar el proyecto original.

## Como correr

1. Entra a esta carpeta:

```bash
cd repartidor-io-hud-preview
```

2. Instala dependencias:

```bash
npm i
```

3. Levanta cliente:

```bash
npm run dev
```

4. (Opcional) Levanta backend local:

```bash
npm run dev:server
```

## Modo actual

Esta copia ya usa el HUD nuevo estilo kit como HUD principal en partida.
El HUD viejo se desactiva durante match en esta carpeta preview.

## Archivos clave del preview

- `src/ui/GameplayHudKitOverlay.js`
- `src/ui/gameplayHudKit.css`
- `src/scenes/gameScene/matchMethods.js` (instancia del HUD nuevo)
