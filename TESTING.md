# Verificaciones realizadas

Fecha: 2026-09-17

- Carga del mismo bundle Planck/Box2D en navegador y Node.
- Sintaxis de `server.js` y todos los scripts del cliente.
- Contrato HTML/JavaScript: referencias directas de la interfaz sin IDs faltantes.
- Las 384 combinaciones de pelota, cuerpo, aro y mapa bajo entradas mantenidas y soltadas.
- Límite vertical de los cuatro ragdolls, sin `NaN`, infinitos ni personajes que salgan volando.
- Agarre únicamente por contacto real de mano/antebrazo, unión mientras la tecla sigue presionada y liberación al soltarla.
- Robo de pelota por contacto del brazo rival y lanzamiento según postura, carga y velocidad física, sin apuntar a coordenadas del aro.
- Salto superior a 125 px sin superar el límite vertical seguro.
- Comparación del mismo lanzamiento con aros a distinta altura para comprobar que no existe apuntado automático.
- Autoequilibrio desde una caída casi horizontal, movimiento horizontal según inclinación y dos piernas físicas por personaje.
- Zona de canasta ajustada al hueco real, colisiones de aro/tablero/poste y reposición animada sin reiniciar el marcador.
- Canasta en ambos lados y pelota arcoíris de dos puntos.
- Simulación espejo: los dos lados producen resultados equivalentes, sin ventaja fija para el jugador 1.
- Dificultad de torneo progresiva entre octavos, cuartos, semifinal y final.
- Sala privada con código, dos clientes, rechazo del tercero y snapshots sincronizados.
- Creación, listado y entrada a una sala pública visible desde otro cliente Socket.IO.
- Snapshots autoritativos a 30 Hz, con secuencia creciente, cuatro personajes articulados, una pelota y estado de tecla mantenida.

## Ejecutar todo

```bash
npm install
npm test
```

## Prueba manual recomendada después de publicar

1. Abrir dos ventanas privadas.
2. Crear una sala pública en la primera y comprobar que aparece con anfitrión y rango en la segunda.
3. Entrar con el botón de la lista y verificar movimiento continuo en las dos ventanas.
4. Repetir con Partida rápida y con una sala privada por código.
5. Verificar que cada ventana controle un equipo distinto y que ambos marcadores coincidan.
6. Avanzar un torneo, recargar la página y comprobar que conserva cuadro, resultados y ronda.
7. Para probar el torneo otra vez sin esperar durante desarrollo, borrar el almacenamiento local del sitio.
