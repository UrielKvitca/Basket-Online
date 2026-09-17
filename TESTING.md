# Verificaciones realizadas

Fecha: 2026-09-16

- Carga del mismo bundle Planck/Box2D en navegador y Node.
- Sintaxis de `server.js` y todos los scripts del cliente.
- Contrato HTML/JavaScript: referencias directas de la interfaz sin IDs faltantes.
- Seis combinaciones extremas de pelota, cuerpo, aro, gravedad y mapa bajo entradas agresivas.
- Límite vertical de los cuatro ragdolls, sin `NaN`, infinitos ni personajes que salgan volando.
- Agarre y tiro al aro desde cada uno de los cuatro personajes.
- Canasta en ambos lados y pelota arcoíris de dos puntos.
- Simulación espejo: los dos lados producen resultados equivalentes, sin ventaja fija para el jugador 1.
- Dificultad de torneo progresiva entre octavos, cuartos, semifinal y final.
- Sala privada con código, dos clientes, rechazo del tercero y snapshots sincronizados.
- Emparejamiento público de dos clientes Socket.IO.
- Snapshots autoritativos con cuatro personajes articulados y una pelota.

## Ejecutar todo

```bash
npm install
npm test
```

## Prueba manual recomendada después de publicar

1. Abrir dos ventanas privadas.
2. Crear una sala en la primera y copiar el código.
3. Unirse desde la segunda.
4. Verificar que cada ventana controle un equipo distinto y que ambos marcadores coincidan.
5. Para probar el torneo otra vez sin esperar durante desarrollo, borrar el almacenamiento local del sitio.
