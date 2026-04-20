# Artillery load test para Deliver IO

Esta carpeta deja una prueba de carga lista para correr contra tu deploy:

- target actual: `https://deliver-io.onrender.com`
- protocolo: `Socket.IO`
- flujo modelado: entrar a sala publica, marcar `ready`, esperar arranque, mandar movimiento repetido y reportar fin de partida

## Que esta simulando

Cada jugador virtual hace esto:

1. Pega a `/health` y `/` para medir que el servicio responda por HTTP.
2. Se conecta por Socket.IO.
3. Hace `registerPlayer` en modo `public`.
4. Marca `ready`.
5. Espera una ventana fija para que la sala se llene y arranque la partida.
6. Manda `updatePosition` 200 veces con `progress` y `hud` parecidos a tu juego.
7. Envia `finishMatch`.
8. Cierra la corrida al terminar el guion completo.

No abre navegador real ni renderiza Phaser. Esto esta midiendo sobre todo:

- backend
- Socket.IO
- colas de sala
- latencia de handshake
- estabilidad bajo trafico

No mide FPS del cliente ni jank visual del navegador.

Importante: quite las validaciones duras de `initState` y `lobbyState` para que Artillery no corte la prueba antes de llegar a la partida. Ahora el flujo prioriza completar una partida simulada de punta a punta.

## Instalacion

Desde `c:\Users\hashi\Documents\juego-io\artillery-load`:

```powershell
npm install
```

## Comandos listos

```powershell
npm run smoke
npm run load:50
npm run load:50:burst
npm run load:soak
```

Cada corrida genera un JSON en `artillery-load/reports/`.

## Que hace cada perfil

`smoke`

- Lanza 6 jugadores en 1 segundo.
- Sirve para validar que una sala publica se llene y no truene.

`load:50`

- Lanza 50 jugadores en 10 segundos.
- Es la mejor aproximacion a "50 personas entrando casi al mismo tiempo".
- Te dice si el servicio se estabiliza o si empieza a subir la latencia.

`load:50:burst`

- Lanza 50 jugadores de golpe en 1 segundo.
- Es una prueba mas agresiva.
- Buena para ver picos, errores de Socket.IO y cold starts.

`load:soak`

- Lanza 1 jugador por segundo durante 60 segundos.
- Buena para ver comportamiento sostenido y desconexiones raras.

## Como cambiarle cosas al YAML

Archivo: `artillery-load/tests/public-rooms.yml`

`config.target`

- Es la URL del juego a probar.
- Si cambias de deploy, cambialo aqui.

`config.socketio.transports`

- Ahora esta forzado a `websocket` para evitar errores de `xhr poll error` con el handshake de `polling` en algunos deploys.
- Si algun dia quieres probar ambos transportes, vuelve a agregar `polling`, pero para Render conviene empezar solo con `websocket`.

`config.environments`

- Aqui viven los perfiles de carga.
- `duration` = cuantos segundos llegan jugadores nuevos.
- `arrivalRate` = cuantos jugadores nuevos por segundo.
- Regla rapida: `duration * arrivalRate = jugadores creados`.

`scenarios[0].flow`

- Es el guion que sigue cada jugador virtual.
- Si quieres meter mas acciones, se agregan aqui.

`think: 14`

- Es la espera para dar tiempo a que se llenen salas y arranque la partida.
- Si ves que tus partidas arrancan mas lento, subelo a `18` o `20`.

`loop ... count: 200`

- Son 200 ticks de movimiento por jugador.
- Con `think: 0.05` equivale a 20 updates por segundo durante 10 segundos.
- Si quieres menos trafico, baja `count` o sube el `think`.

## Como cambiar la intensidad

Si quieres simular menos o mas movimiento:

- mas realista y pesado: deja `think: 0.05`
- mas suave: usa `think: 0.1`
- mas agresivo: sube `count` a `300` o `400`

Si quieres otras cantidades de jugadores:

- 24 jugadores: `duration: 6` y `arrivalRate: 4`
- 60 jugadores: `duration: 12` y `arrivalRate: 5`
- 100 jugadores burst: `duration: 1` y `arrivalRate: 100`

## Como leer los resultados

En consola fijate sobre todo en:

- `http.response_time`: latencia HTTP de `/health` y `/`
- `socketio.response_time`: tiempo entre emitir y recibir los eventos con respuesta
- `errors.*`: errores de conexion, timeouts, resets o handshakes fallidos
- `vusers.failed`: usuarios virtuales que no completaron el flujo
- `vusers.completed`: usuarios que si terminaron
- `deliver.lobby.ready.sent`: usuarios que alcanzaron a mandar `ready`
- `deliver.gameplay.started`: usuarios que entraron a la fase de partida simulada
- `deliver.finish.sent`: usuarios que mandaron `finishMatch`
- `deliver.scenario.completed`: usuarios que llegaron al final del script

Senales de problema:

- `vusers.failed` sube
- aparecen `ECONNRESET`, `ETIMEDOUT` o `connect_error`
- el `p95` o `p99` se dispara al entrar en `load:50` o `burst`
- `smoke` falla aunque solo haya 6 usuarios
- `deliver.finish.sent` queda muy por debajo de `vusers.created`
- `deliver.scenario.completed` no sigue de cerca a `vusers.completed`

## Lo que yo esperaria de tu Render gratis

Esto es inferencia basada en tu codigo y en la doc oficial de Render, no una medicion real.

Tu cliente manda posicion cada `50ms`, o sea unas 20 actualizaciones por segundo por jugador:

- referencia: `deliver-io/src/network/MultiplayerSystem.js:4`

Tu servidor arma salas de maximo 6 jugadores:

- referencia: `deliver-io/server/index.js:23`

Con 50 jugadores simultaneos, eso significa aproximadamente:

- 50 updates de jugador cada `50ms`
- cerca de 1000 mensajes entrantes por segundo al servidor
- y varios miles de broadcasts salientes por segundo hacia los otros jugadores de cada sala

En Render Free, ademas de la potencia limitada, tienes estas restricciones oficiales:

- se apaga tras 15 minutos sin trafico
- solo hay 1 instancia
- puede reiniciarse en cualquier momento
- Render no recomienda Free para produccion

Fuentes oficiales:

- https://render.com/docs/free
- https://render.com/pricing
- https://www.artillery.io/docs/reference/engines/socketio
- https://www.artillery.io/docs/reference/test-script

Mi estimacion honesta:

- `smoke` y pruebas chicas deberian pasar si no hay bugs de logica.
- `load:50` puede pasar a ratos, pero no me confiaria en estabilidad sostenida en Render Free.
- `burst50` tiene bastantes probabilidades de mostrar lag, handshakes lentos o desconexiones, sobre todo si el servicio venia frio.

## Siguiente paso recomendado

1. Corre `npm install`
2. Corre `npm run smoke`
3. Si pasa, corre `npm run load:50`
4. Guarda el JSON del reporte
5. Si ahi ya salen errores, ni vale la pena subir aun mas hasta arreglarlos

## Nota importante

No pude ejecutar la prueba real contra `https://deliver-io.onrender.com` desde este entorno porque la red esta bloqueada en la sandbox. Te deje todo listo para correrlo en tu maquina con el mismo repo.

Si vuelves a ver errores de conexion, corre esto en PowerShell para sacar mas detalle:

```powershell
$Env:DEBUG = "socketio"
npm run smoke
```
