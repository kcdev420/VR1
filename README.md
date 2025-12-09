# Nube de Puntos Interactiva con Mano

Demo web que usa la webcam y MediaPipe Hands para detectar la mano y controlar una nube de puntos (Three.js) con movimiento y rotación.

Requisitos
- Navegador moderno con WebRTC (Chrome/Edge/Firefox).
- Permiso para usar la cámara.

Cómo ejecutar (PowerShell en Windows)

1. Abre una terminal (PowerShell) en la carpeta del proyecto (donde están `index.html`).

2. Inicia un servidor HTTP simple (evita problemas de permisos con la cámara desde `file://`):

```powershell
py -3 -m http.server 8000
# o alternativamente
python -m http.server 8000
```

3. Abre en el navegador: `http://localhost:8000/index.html`

Notas
- Cuando el navegador pida permiso para usar la cámara, acepta.
- Coloca la mano frente a la cámara; la nube responderá a posición y rotación. Acerca los dedos para hacer un "pinch" y ajustar la escala.
- Si quieres ajustar sensibilidad, edita `main.js` (mapeos y multiplicadores cerca de la función `onResults`).

¿Quieres que añada? Fantástico: puedo añadir controles de UI para calibrar sensibilidad, cambiar paleta de colores, o guardar capturas.
