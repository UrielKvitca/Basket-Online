# Verificaciones realizadas

Fecha: 2026-09-17

- Carga del mismo bundle Planck/Box2D en navegador y Node.
- Sintaxis de `server.js` y todos los scripts del cliente.
- Contrato HTML/JavaScript: referencias directas de la interfaz sin IDs faltantes.
- Las 384 combinaciones de pelota, cuerpo, aro y mapa bajo entradas mantenidas y soltadas.
- Límite vertical de los cuatro ragdolls, sin `NaN`, infinitos ni personajes que salgan volando.
- Agarre por proximidad física desde cada uno de los cuatro personajes, unión mientras la tecla sigue presionada y liberación al soltarla.
- Contacto de mano y antebrazo, pelota visible en la mano y lanzamiento siempre delante del cuerpo, sin apuntar a coordenadas del aro.
- Salto superior a 125 px sin superar el límite vertical seguro.
- Comparación del mismo lanzamiento con aros a distinta altura para comprobar que no existe apuntado automático.
- Canasta en ambos lados y pelota arcoíris de dos puntos.
- Simulación espejo: los dos lados producen resultados equivalentes, sin ventaja fija para el jugador 1.
- Dificultad de torneo progresiva entre octavos, cuartos, semifinal y final.
- Sala privada con código, dos clientes, rechazo del tercero y snapshots sincronizados.
- Emparejamiento público de dos clientes Socket.IO.
- Snapshots autoritativos con cuatro personajes articulados, una pelota y estado de tecla mantenida.

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
