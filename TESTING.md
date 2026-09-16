# Verificaciones realizadas

Fecha: 2026-09-16

- Sintaxis de `server.js` y todos los scripts del cliente.
- Contrato HTML/JavaScript: 57 identificadores revisados, sin duplicados ni referencias faltantes.
- Estrés de física: 50 semillas y hasta 12.000 pasos por partida, sin `NaN` ni estados infinitos.
- Regla de canasta izquierda/derecha y actualización de marcador.
- Emparejamiento público con dos clientes Socket.IO.
- Sala privada con código, inicio con dos jugadores y rechazo correcto del tercer jugador.
- Snapshots del servidor con cuatro personajes y una pelota.

## Prueba manual recomendada después de publicar

1. Abrir dos ventanas privadas.
2. Crear una sala en la primera y copiar el código.
3. Unirse desde la segunda.
4. Verificar que cada ventana controle un equipo distinto y que ambos marcadores coincidan.
5. Para probar el torneo otra vez sin esperar durante desarrollo, borrar el almacenamiento local del sitio.
