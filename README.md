# Basket Random Arena

Juego de basquet arcade 2 contra 2 hecho con Canvas y fisica Box2D mediante Planck.js. Incluye modos local/CPU, online mediante Socket.IO, tienda, perfil y torneo eliminatorio.

## Modos incluidos

- 1 jugador contra CPU.
- 2 jugadores en el mismo teclado.
- Partida rápida online y navegador de salas públicas visibles.
- Sala privada con codigo de 5 caracteres.
- Torneo persistente: cuadro completo, resultados CPU, octavos, cuartos, semifinal y final.
- Tienda de personajes con monedas.
- Perfil editable y progreso guardado en el navegador.

Cada jugador controla sus dos personajes con una sola tecla, como en Basket Random:

- Equipo izquierdo: `W`.
- Equipo derecho: `FLECHA ARRIBA`.
- En celular: boton tactil grande.

La tecla no dispara automaticamente al aro: hay que mantenerla para saltar, levantar el brazo y conservar la pelota cuando la mano hace contacto. Al soltarla, la pelota sale con la velocidad fisica del brazo y del cuerpo.

Los personajes usan torso, cabeza, brazo y dos piernas físicas. Un sistema de torque y centro de masa bajo los devuelve gradualmente a la vertical cuando quedan libres; no se recolocan por teletransporte. El salto toma la inclinación y el momento actual del cuerpo, la pelota puede robarse por contacto, y las salidas tienen una reposición animada.

## Probar todo localmente

```bash
npm install
npm start
```

Abrir `http://localhost:3000`. Para probar online, abrir dos ventanas.

Para ejecutar las pruebas de fisica, interfaz y dos clientes online:

```bash
npm test
```

## Publicar el cliente en Netlify

1. Abrir `public/js/config.js`.
2. Colocar en `SERVER_URL` la URL final de Render.
3. Arrastrar la carpeta completa a Netlify. El archivo `netlify.toml` publica automaticamente `public`.

Tambien se puede seleccionar `public` como carpeta de publicacion manual.

## Publicar el servidor en Render

1. Subir esta carpeta a GitHub.
2. En Render elegir **New > Blueprint** y seleccionar el repositorio.
3. Render detecta `render.yaml` y crea el servidor.
4. Abrir la URL que entrega Render: ahí funciona el juego completo, incluido el online.

Si además se publica el cliente separado en Netlify, copiar la URL de Render en `public/js/config.js` y volver a publicar Netlify.

El servidor tambien sirve el cliente, por lo que la URL de Render permite probar el juego completo sin Netlify. En una URL `*.onrender.com`, el cliente detecta automaticamente que debe usar ese mismo servidor.

## Datos importantes

- Las salas se guardan en memoria. Si el servicio gratuito de Render se reinicia, las salas activas se cierran.
- Perfil, monedas, compras y espera del torneo se guardan en `localStorage`.
- Las salas tienen un maximo estricto de 2 conexiones. Las públicas muestran anfitrión, rango y ocupación; las privadas no aparecen en el navegador.
- El servidor es autoritativo: recibe pulsaciones y transmite el estado fisico del partido a ambos jugadores por igual.
- Los snapshots salen a 30 Hz con número de secuencia y son descartables: una conexión lenta no acumula estados viejos. El cliente usa un búfer de interpolación de 90 ms para absorber variaciones de red.
- La pantalla online muestra la latencia aproximada al servidor.
- La cancha vuelve a ocupar toda la pantalla disponible, sin bordes ni reducción visible del área de juego.
- Navegador y servidor usan el mismo motor Planck/Box2D y los mismos modificadores.
- El juego se renderiza primero en una superficie de 320 x 180 y se escala sin suavizado para que personajes, pelota, canchas y efectos sean pixel art real.
- Los escenarios, uniformes e interfaz son originales y estan dibujados por el propio juego; no se incluyen assets copiados.
- La licencia de Planck.js está incluida en `THIRD_PARTY_NOTICES.md`.
