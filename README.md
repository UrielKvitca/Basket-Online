# Basket Random Arena

Juego de basquet arcade 2 contra 2 hecho con Canvas, fisicas propias, modos local/CPU, online mediante Socket.IO, tienda, perfil y torneo eliminatorio.

## Modos incluidos

- 1 jugador contra CPU.
- 2 jugadores en el mismo teclado.
- Sala publica online para 2 jugadores.
- Sala privada con codigo de 5 caracteres.
- Torneo: octavos, cuartos, semifinal y final.
- Tienda de personajes con monedas.
- Perfil editable y progreso guardado en el navegador.

Cada jugador controla sus dos personajes con una sola tecla, como en Basket Random:

- Equipo izquierdo: `W`.
- Equipo derecho: `FLECHA ARRIBA`.
- En celular: boton tactil grande.

## Probar todo localmente

```bash
npm install
npm start
```

Abrir `http://localhost:3000`. Para probar online, abrir dos ventanas.

## Publicar el cliente en Netlify

1. Abrir `public/js/config.js`.
2. Colocar en `SERVER_URL` la URL final de Render.
3. Arrastrar la carpeta completa a Netlify. El archivo `netlify.toml` publica automaticamente `public`.

Tambien se puede seleccionar `public` como carpeta de publicacion manual.

## Publicar el servidor en Render

1. Subir esta carpeta a GitHub.
2. En Render elegir **New > Blueprint** y seleccionar el repositorio.
3. Render detecta `render.yaml` y crea el servidor.
4. Copiar la URL que entrega Render en `public/js/config.js` y volver a publicar Netlify.

El servidor tambien sirve el cliente, por lo que la URL de Render permite probar el juego completo sin Netlify. En una URL `*.onrender.com`, el cliente detecta automaticamente que debe usar ese mismo servidor.

## Datos importantes

- Las salas se guardan en memoria. Si el servicio gratuito de Render se reinicia, las salas activas se cierran.
- Perfil, monedas, compras y espera del torneo se guardan en `localStorage`.
- Las salas tienen un maximo estricto de 2 conexiones.
- El servidor es autoritativo: recibe pulsaciones y transmite el estado fisico del partido.
- Los escenarios, uniformes e interfaz son originales y estan dibujados por el propio juego; no se incluyen assets copiados.
