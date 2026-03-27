# deliver-io

Proyecto oficial del juego, consolidado en una sola carpeta activa: `deliver-io/`.

## Estructura

```text
juego-io/
  deliver-io/
```

Todo el trabajo vigente del lobby, garage, HUD y multijugador vive ahi.

## Como correr

1. Entra al proyecto:

```bash
cd deliver-io
```

2. Instala dependencias:

```bash
npm install
```

3. Levanta el backend:

```bash
npm run dev:server
```

4. En otra terminal levanta el cliente:

```bash
npm run dev
```

5. Abre:

```text
http://localhost:5173
```

## Tunnel con Cloudflare

1. Backend:

```bash
cloudflared tunnel --url http://localhost:3000
```

2. Crea `deliver-io/.env` usando `.env.example`:

```bash
copy .env.example .env
```

3. Coloca la URL del tunnel del backend:

```env
VITE_SOCKET_SERVER_URL=https://tu-url.trycloudflare.com
```

4. Inicia el cliente y, si quieres compartirlo, abre otro tunnel:

```bash
cloudflared tunnel --url http://localhost:5173
```

## Notas

- El nombre oficial del proyecto ya es `Deliver.io`.
- La carpeta `deliver-io/` reemplaza al preview y al proyecto duplicado anterior.
- Los archivos sueltos de prototipo del lobby/HUD ya no forman parte del flujo oficial.
