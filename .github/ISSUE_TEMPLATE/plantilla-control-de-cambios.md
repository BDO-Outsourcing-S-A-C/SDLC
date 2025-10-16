---
name: Plantilla control de cambios
about: Describe this issue template's purpose here.
title: Control de cambios
labels: ''
assignees: ''

---

name: "Control de Cambios"
description: "STI-ST-916 • Solicita y gestiona un cambio"
title: "CC: {sistema}/{modulo} - {titulo corto}"
labels: ["tipo:cambio"]
body:
  - type: dropdown
    id: sistema
    attributes:
      label: Sistema
      options: ["SMARTSYS","MyReporting","MDW","Otro"]
    validations: { required: true }
  - type: input
    id: modulo
    attributes: { label: Módulo }
    validations: { required: true }
  - type: textarea
    id: descripcion
    attributes: { label: Descripción general del cambio }
    validations: { required: true }
  - type: textarea
    id: justificacion
    attributes: { label: Justificación (negocio/operativa/seguridad) }
  - type: textarea
    id: impacto
    attributes: { label: Análisis de impacto (elementos afectados) }
  - type: input
    id: autorizado_por
    attributes: { label: Autorizado por }
  - type: input
    id: esfuerzo
    attributes: { label: Esfuerzo estimado (horas) }
  - type: input
    id: costo
    attributes: { label: Costo asociado (S/ o USD) }
  - type: input
    id: intellisign
    attributes: { label: Aprobación (Intellisign URL/ID) }
  - type: textarea
    id: evidencia
    attributes: { label: Evidencias y validaciones }
