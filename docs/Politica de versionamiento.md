# Política de Versionamiento y Flujo Alternativo para Releases Selectivos

|| Responsable        | Revisor             | Aprobador |
|----|--------------------|---------------------|-----------|
| Nombre ||||
| Cargo ||||
| Fecha ||||

## Objetivo

Definir un flujo que permita publicar funcionalidades específicas aprobadas por el Product Owner (PO) sin arrastrar otras features ya integradas en ramas principales, manteniendo coherencia con Semantic Versioning (SemVer) y buenas prácticas en GitHub.

## Principios Clave

1. Versionamiento SemVer: `MAJOR.MINOR.PATCH`.
2. Publicación mediante GitHub Releases y tags.
3. Aislamiento de funcionalidades para evitar contaminación entre features.
4. Integración controlada hacia entornos: `develop → test → staging → master`.

## Flujo Alternativo

Cada feature parte desde `master` (última versión estable) y se promueve individualmente hasta producción:

```text
master ──┐
         ├─> feature/1 ──> develop ──> test ──> staging ──> master ──> tag v1.2.0
         └─> feature/2 ──> develop ──> test ──> staging ──> master ──> tag v1.3.0
```

## Reglas del Flujo

### Creación de ramas

```bash
git switch master
git pull --ff-only
git switch -c feature/<nombre>
```

### Integración en develop

```bash
git switch develop
git merge --no-ff feature/<nombre>
```

### Promoción individual

`feature/* → test → staging → master` mediante PRs aprobados.

### Release en GitHub

```bash
VERSION=1.2.0
git tag -a "v$VERSION" -m "Release $VERSION"
git push origin "v$VERSION"
gh release create "v$VERSION" --generate-notes --title "Release $VERSION"
```

## Checklist Operativo

- Crear rama `feature/*` desde `master`.
- Merge a `develop` para integración continua.
- Merge a `test` y ejecutar QA.
- Merge a `staging` y validar con negocio.
- Merge a `master` solo si el PO aprueba la publicación.
- Crear tag SemVer y GitHub Release.
- Back-merge de `master` a `develop`.

## Convenciones de Versionamiento

| Formato            | Uso                                      |
|--------------------|-------------------------------------------|
| `vX.Y.Z`           | Release estable.                          |
| `vX.Y.Z-alpha.N`   | Pre-release en `develop`.                 |
| `vX.Y.Z-beta.N`    | Pre-release en `test`.                    |
| `vX.Y.Z-rc.N`      | Release candidate en `staging`.           |

## Ejemplo Práctico: Dos Features Simultáneas

### Contexto

- `master` está en `v1.1.0`.
- Se desarrollan `feature/1` (exportación de reportes) y `feature/2` (nuevo dashboard).
- El PO decide publicar primero `feature/2` como `v1.3.0`.

### Pasos para `feature/1`

```bash
git switch master
git pull --ff-only
git switch -c feature/1
## Desarrollar y hacer commits
git add .
git commit -m "feat(reports): exportación CSV/XLSX"
git push -u origin feature/1
gh pr create --base develop --head feature/1 --title "Feature 1" --body "Exportación de reportes"
git switch test && git merge --no-ff feature/1
git switch staging && git merge --no-ff test
git switch master && git merge --no-ff staging
VERSION=1.2.0
git tag -a "v$VERSION" -m "Release $VERSION"
git push origin "v$VERSION"
gh release create "v$VERSION" --generate-notes --title "Release $VERSION"
```

### Pasos para `feature/2`

```bash
git switch master
git pull --ff-only
git switch -c feature/2
## Desarrollar y hacer commits
git add .
git commit -m "feat(dashboard): nuevo panel de métricas"
git push -u origin feature/2
gh pr create --base develop --head feature/2 --title "Feature 2" --body "Nuevo dashboard"
git switch test && git merge --no-ff feature/2
git switch staging && git merge --no-ff test
git switch master && git merge --no-ff staging
VERSION=1.3.0
git tag -a "v$VERSION" -m "Release $VERSION"
git push origin "v$VERSION"
gh release create "v$VERSION" --generate-notes --title "Release $VERSION"
```

## Buenas Prácticas y Advertencias

- Feature toggles: implementar banderas para activar/desactivar funcionalidades en producción.
- Evitar dependencias fuertes: diseñar features independientes para facilitar releases selectivos.
- Automatización: configurar pipelines para validaciones, merges y generación de releases.
- Documentación clara: PRs y releases deben incluir referencias a tickets, ADRs y plan de rollback.
- Rollback definido: cada release debe tener estrategia de reversión probada.
