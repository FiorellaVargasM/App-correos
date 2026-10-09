# Correos de bancos desde oficios judiciales

App estática (HTML/JS), sin IA ni servidor. Todo se procesa en el navegador.

## Uso
1. Carga el directorio (CSV o Excel con columnas BANCO, NIT, CORREO y opcional ALIAS). Queda guardado en el navegador.
2. Selecciona el PDF del oficio y revisa la lista de entidades detectadas.
3. Pulsa "Generar resultado" y copia el listado de correos.

Para añadir bancos: "Ver, buscar o añadir bancos" y luego "Descargar CSV actualizado" como respaldo.

## Publicar
1. `git init`, `git add .`, `git commit`, y súbelo a un repo privado en GitHub.
2. Netlify: Add new site → Import from Git → elige el repo (sin comando de build, publish directory `.`).
3. Opcional: protege el sitio con contraseña en Netlify.

Los `.csv` y `.pdf` están en `.gitignore` para no subir datos sensibles.
