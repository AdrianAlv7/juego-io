# juego-io
Juego de repartidor .io

Paso 1 – Instalar lo básico
1️⃣ Node.js

Descarga la versión LTS:
👉 https://nodejs.org/

Luego verifica:

node -v
npm -v

Paso 2 – Crear proyecto Phaser con Vite

En una carpeta vacía:

npm create vite@latest repartidor-io


Te preguntará:

Framework → Vanilla

Variant → JavaScript

Entras al proyecto:

cd repartidor-io
npm install

Paso 3 – Instalar Phaser 3
npm install phaser

Paso 4 – Estructura inicial simple

Deja el proyecto así:

src/
 ├─ main.js
 ├─ game/
 │   └─ GameScene.js
 └─ style.css


 para correr proyecto

 npm run dev