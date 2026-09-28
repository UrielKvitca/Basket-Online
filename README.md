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

- En 1P, torneo y online: cualquier tecla de `WASD` o cualquiera de las cuatro flechas.
- En 2P local: equipo izquierdo con `WASD`; equipo derecho con las flechas.
- En celular: boton tactil grande.

La pelota se agarra cuando pasa cerca del brazo mientras la tecla está mantenida: el alcance es generoso y hace un snap exacto a la mano. Al soltar la tecla se lanza con la velocidad fisica del brazo y del cuerpo, como en el Basket Random original.

El lanzamiento tiene asistencia parcial: conserva el movimiento físico del personaje, pero lo mezcla con una trayectoria hacia el aro rival y garantiza una fuerza mínima. La altura del aro, la carga del tiro y la gravedad propia de cada pelota modifican la parábola, sin convertir cada lanzamiento en una canasta automática.

Los personajes usan torso, cabeza, brazo y dos piernas físicas. Los brazos se balancean también en reposo y el salto reparte el impulso entre todas las piezas para que el cuerpo se incline de manera visible. Un sistema de torque y centro de masa bajo los devuelve gradualmente a la vertical cuando quedan libres; no se recolocan por teletransporte. En el mapa de nieve la fricción y la amortiguación bajan de verdad para que los jugadores patinen mucho más. La pelota puede robarse por contacto y las salidas tienen una reposición animada.

Si una pelota queda atrapada debajo de un jugador, el apoyo sobre ella cuenta para saltar y al mantener el control se recupera directamente en la mano. La pelota liviana cae más lento y rebota más, la pesada cae más rápido y casi no rebota, y la multicolor suma dos puntos. Cada canasta muestra durante dos segundos una de las reacciones visuales incluidas, elegida al azar y con movimiento aleatorio.

## Probar todo localmente

```bash
npm install
npm start
```

Abrir `http://localhost:3000`. Para probar online, abrir dos ventanas.

### Jugar por la misma red WiFi

Al iniciar el servidor, la consola muestra una o más direcciones con el texto `Misma WiFi`, por ejemplo `http://192.168.1.20:3000`. Abrir esa misma dirección en los dos dispositivos conectados al mismo router. El partido usa el servidor de la PC anfitriona y evita el viaje hasta Render. En Windows puede ser necesario permitir Node.js en el Firewall para redes privadas.

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
- Los snapshots salen a 60 Hz, llevan confirmación de la última entrada procesada y son descartables: una conexión lenta no acumula estados viejos. El cliente usa interpolación adaptativa de 22 a 55 ms y extrapolación física corta para evitar congelamientos entre paquetes.
- La pantalla online muestra la latencia aproximada al servidor.
- La cancha vuelve a ocupar toda la pantalla disponible, sin bordes ni reducción visible del área de juego.
- Navegador y servidor usan el mismo motor Planck/Box2D y los mismos modificadores.
- El juego se renderiza primero en una superficie de 320 x 180 y se escala sin suavizado para que personajes, pelota, canchas y efectos sean pixel art real.
- Los escenarios, uniformes e interfaz son originales y estan dibujados por el propio juego; no se incluyen assets copiados.
- La licencia de Planck.js está incluida en `THIRD_PARTY_NOTICES.md`.
