# Exportador de Pull Requests a PDF

## Uso en GitHub Actions

1. Ir a la pestaña **Actions**.
2. Seleccionar el workflow "Export Pull Request to PDF Completo".
3. Click en **Run workflow** y rellenar el número del PR.
4. Ajustar flags si es necesario:
   - `exclude_diff`: Solo estadísticas, sin contenido de patches.
   - `summary_only`: Omite secciones detalladas (commits, comentarios, diffs) dejando solo resumen y metadatos.
   - `exclude_review_comments`: Omite comentarios en línea sobre el código.
   - `force_large_diffs`: Fuerza inclusión de diffs muy grandes (el PDF puede ser pesado).
5. Descargar el artefacto generado (pr-<numero>-pdf).

## Uso local

```bash
export GITHUB_TOKEN=ghp_xxx
export REPO_FULL_NAME=BDO-Outsourcing-S-A-C/SDLC
node export-pr-to-pdf.js --pr 123
```

El PDF se genera en `out/pr-123.pdf`.

## Renderizado de Markdown

La descripción del PR ahora se renderiza como HTML utilizando `markdown-it`. Comentarios y revisiones siguen en texto plano escapado para seguridad (se pueden habilitar más adelante).

## Flags disponibles

- `--exclude-diff`
- `--summary-only`
- `--exclude-review-comments`
- `--force-large-diffs`

## Seguridad

Se aplica una sanitización básica al HTML generado de la descripción (elimina `<script>` y atributos que empiezan con `on`). Para requisitos más estrictos puede añadirse una librería adicional.

## Próximas mejoras sugeridas

- Renderizar también comentarios y bodies de reviews en Markdown.
- Watermark de entorno.
- Hash SHA256 publicado como comentario.
