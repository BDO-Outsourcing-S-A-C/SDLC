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
export GITHUB_TOKEN=ghp_xxx # token con permiso repo
export REPO_FULL_NAME=BDO-Outsourcing-S-A-C/SDLC
node export-pr-pdf.js --pr 123
```

El PDF se genera en `out/pr-123.pdf`.

## Firma electrónica

El PDF incluye un bloque al final para completar firmas de: Responsable Técnico, QA, Seguridad, Product Owner, Fecha y Observaciones.

## Personalización

Puede editar estilos en la sección `<style>` del HTML dentro de `export-pr-pdf.js`.

## Flags disponibles

- `--exclude-diff`
- `--summary-only`
- `--exclude-review-comments`
- `--force-large-diffs`

## Próximas mejoras sugeridas (no implementadas aún)

- Enviar automáticamente el PDF a sistema externo de firma.
- Añadir watermark de ambiente.
- Publicar hash SHA256 del PDF como comentario en el PR.
