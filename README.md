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

La pelota se agarra cuando pasa cerca del brazo mientras la tecla está mantenida: el alcance es generoso, también cubre una zona corta detrás del cuerpo y hace un snap exacto a la mano. Mientras busca la pelota el brazo mantiene su balanceo amplio; después de agarrarla se estabiliza apuntando por encima del aro rival para producir una parábola útil. Al soltar, la orientación real del brazo manda: hacia arriba lanza arriba y hacia abajo lanza abajo. Una guía leve hacia el aro ajusta la potencia sin invertir esa dirección.

El lanzamiento tiene asistencia balística adaptativa: conserva la dirección del brazo y el movimiento físico, pero calcula una parábola útil según la distancia, altura del aro, carga y gravedad propia de cada pelota. Los tiros normales y hacia arriba reciben una corrección generosa de potencia y altura; un brazo que apunta claramente hacia abajo sigue lanzando hacia abajo. Al soltar, la pelota ignora durante una fracción de segundo a los compañeros cercanos y, si ya llega alta y descendiendo sobre el aro, recibe una corrección final suave hacia el hueco. Los tiros bajos o mal orientados no se convierten automáticamente en gol y los rivales siguen pudiendo bloquearlos.

Los personajes usan torso, cabeza, brazo y dos piernas físicas. Los brazos se balancean rápido y con recorrido hacia delante y atrás; el salto reparte un impulso mayor entre todas las piezas para que el cuerpo se incline de manera visible. Un sistema de torque y centro de masa bajo los devuelve gradualmente a la vertical cuando quedan libres; no se recolocan por teletransporte. En el mapa de nieve la fricción y la amortiguación bajan de verdad para que los jugadores patinen mucho más. La pelota puede robarse por contacto. Si queda inmóvil entre los bordes del aro, se libera sola hacia arriba y hacia la cancha. Sólo se considera afuera cuando cruza detrás de uno de los tableros: un tiro que sube por encima de la pantalla conserva su parábola y vuelve a caer. La salida se anima y comienza únicamente una ronda nueva, conservando el marcador del partido.

Si una pelota queda atrapada debajo de un jugador, el apoyo sobre ella cuenta para saltar y al mantener el control se recupera directamente en la mano. También se puede saltar cuando el apoyo es otro jugador, para que las pilas de cuerpos no bloqueen al de arriba. La pelota liviana cae más lento y rebota más, la pesada cae más rápido y casi no rebota, y la multicolor suma dos puntos. Cada canasta muestra durante dos segundos una de las 44 reacciones visuales incluidas, elegida al azar y con movimiento aleatorio. Las fuentes de las 30 reacciones web agregadas están documentadas en `MEME_SOURCES.md`.

## Probar todo localmente

```bash
npm install
npm start
```

Abrir `http://localhost:3000`. Para probar online, abrir dos ventanas.

### Jugar por la misma red WiFi

Al iniciar el servidor, la consola muestra una o más direcciones con el texto `Misma WiFi`, por ejemplo `http://192.168.1.20:3000`. Abrir esa misma dirección en los dos dispositivos conectados al mismo router. El partido usa el servidor de la PC anfitriona y evita el viaje hasta Render. En Windows puede ser necesario permitir Node.js en el Firewall para redes privadas.

Importante: estar ambos en la misma WiFi no alcanza si abren la URL de Render, porque el partido igualmente viaja hasta el servidor remoto. Para obtener latencia de red local hay que ejecutar `npm start` en una PC y abrir en ambos dispositivos la dirección `Misma WiFi` que aparece en esa consola.

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

El Blueprint crea servicios nuevos en Virginia, una región más conveniente que el valor predeterminado Oregon para jugadores de Argentina. Render no permite cambiar la región de un servicio existente: si el servicio actual fue creado en Oregon, hay que crear uno nuevo desde el Blueprint para aplicar `region: virginia` y luego usar su nueva URL.

Si además se publica el cliente separado en Netlify, copiar la URL de Render en `public/js/config.js` y volver a publicar Netlify.

El servidor tambien sirve el cliente, por lo que la URL de Render permite probar el juego completo sin Netlify. En una URL `*.onrender.com`, el cliente detecta automaticamente que debe usar ese mismo servidor.

## Datos importantes

- Las salas se guardan en memoria. Si el servicio gratuito de Render se reinicia, las salas activas se cierran.
- Perfil, monedas, compras y espera del torneo se guardan en `localStorage`.
- Las salas tienen un maximo estricto de 2 conexiones. Las públicas muestran anfitrión, rango y ocupación; las privadas no aparecen en el navegador.
- El servidor es autoritativo: recibe pulsaciones y transmite el estado fisico del partido a ambos jugadores por igual.
- La física autoritativa corre a 60 Hz y transmite estados compactos a 30 Hz desde el mismo reloj. Por WebSocket conserva sólo el estado más reciente para que una conexión lenta no acumule segundos de atraso; por polling mantiene entrega confiable. El cliente interpola a los FPS de la pantalla con un búfer adaptativo más corto, limita la extrapolación visible a 16 ms y mantiene la predicción local del salto hasta que el estado confirmado ya llegó visualmente.
- El indicador online muestra `WS` cuando usa WebSocket y `POLLING` cuando tuvo que usar el transporte alternativo. Para jugar por Internet se recomienda `WS`; si aparece `POLLING`, revisar bloqueos de red o probar otra conexión.
- Si ambos jugadores usan la URL pública, el número de milisegundos del indicador es el dato decisivo: el código puede suavizar la imagen, pero no eliminar el tiempo físico de ida y vuelta. Para una sensación casi local se recomienda el modo `Misma WiFi`; para Internet, WebSocket y un servidor siempre encendido en la región más cercana disponible.
- La pantalla online muestra la latencia aproximada al servidor.
- La cancha vuelve a ocupar toda la pantalla disponible, sin bordes ni reducción visible del área de juego.
- Navegador y servidor usan el mismo motor Planck/Box2D y los mismos modificadores.
- El juego se renderiza primero en una superficie de 320 x 180 y se escala sin suavizado para que personajes, pelota, canchas y efectos sean pixel art real.
- Los escenarios, uniformes e interfaz son originales y están dibujados por el propio juego. Las reacciones de gol aportadas por el usuario y las plantillas web se mantienen separadas en `public/assets/goal-reactions`.
- La licencia de Planck.js está incluida en `THIRD_PARTY_NOTICES.md`.
