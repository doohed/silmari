# Documentación

Índice de la documentación de Silmari. Empieza por el
[README del repositorio](../README.md) si buscas cómo arrancar el proyecto.

| Documento                                            | Qué contiene                                                                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [API pública](./api.md)                              | Referencia REST de `/api/v1`: autenticación por API key, endpoints, filtros y entrada de leads.            |
| [Runbook de operación](./runbook.md)                 | Despliegue, nginx y certificado, backup y restauración, diagnóstico de incidencias y rotación de secretos. |
| [Plan de puesta en producción](./plan-produccion.md) | Las fases pendientes hasta abrir el servicio, con su estado actual.                                        |
| [Pendientes](./pendientes.md)                        | Lista operativa de lo que queda por hacer antes y después de abrir el servicio.                            |
| [Plan de seguridad](./plan-seguridad.md)             | Revisión OWASP Top 10: hallazgos verificados y el plan de parches por fases.                               |

## Fuera de esta carpeta

- [`CLAUDE.md`](../CLAUDE.md) — arquitectura, modelo de datos, decisiones
  técnicas y convenciones. **Vive en la raíz a propósito**: es el fichero que
  Claude Code carga automáticamente desde el directorio del proyecto, y moverlo
  aquí lo dejaría sin efecto.
- `.env.example` — todas las variables de entorno, comentadas una a una.
