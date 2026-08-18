# API pública

Referencia de la API REST de Silmari. Para el resto de la documentación, ver
[el índice](./README.md) o el [README del repositorio](../README.md).

## Autenticación y endpoints

La API REST autentica por **API key** (créala en Ajustes → API keys; el token se
muestra una única vez). Se envía como `Authorization: Bearer <token>`.

| Método   | Ruta                                  | Descripción                              |
| -------- | ------------------------------------- | ---------------------------------------- |
| `GET`    | `/api/v1/metadata/objects`            | Lista los objetos del workspace          |
| `GET`    | `/api/v1/metadata/objects/:id/fields` | Campos de un objeto                      |
| `GET`    | `/api/v1/:objectSlug`                 | Lista registros (filtros, orden, cursor) |
| `POST`   | `/api/v1/:objectSlug`                 | Crea un registro                         |
| `GET`    | `/api/v1/:objectSlug/:recordId`       | Un registro                              |
| `PATCH`  | `/api/v1/:objectSlug/:recordId`       | Actualiza (parcial)                      |
| `DELETE` | `/api/v1/:objectSlug/:recordId`       | Borra (soft delete)                      |
| `POST`   | `/api/v1/intake/meta`                 | Recibe un lead de Meta Lead Ads          |

**Parámetros de listado**: `?filter=campo:operador:valor` (repetible),
`?sort=campo:asc|desc`, `?cursor=<opaco>`, `?limit=`. Operadores según el tipo
de campo (p. ej. `eq`, `contains`, `gte`, `is`, `isEmpty`). La respuesta incluye
`{ data, nextCursor }`; pásale `nextCursor` como `cursor` para la siguiente
página. Hay **rate limiting** por key.

```bash
API=http://localhost:3000/api/v1
AUTH="Authorization: Bearer $TOKEN"

# Crear
curl -s -X POST "$API/companies" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"data":{"name":"Acme","employees":25}}'

# Listar con filtro, orden y paginación
curl -s "$API/companies?filter=employees:gte:10&sort=employees:asc&limit=50" -H "$AUTH"

# Actualizar / borrar
curl -s -X PATCH "$API/companies/<id>" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"data":{"employees":99}}'
curl -s -X DELETE "$API/companies/<id>" -H "$AUTH"
```

### Entrada de leads desde Meta (Facebook e Instagram)

`POST /api/v1/intake/meta` convierte un lead de **Meta Lead Ads** en un registro.
Se configura en **Ajustes → Entrada de leads**: por cada formulario (su `form_id`)
eliges el objeto destino, la correspondencia entre preguntas y campos, y —
opcionalmente — un **campo clave** para actualizar en vez de duplicar. Una
configuración con el ID de formulario vacío actúa de comodín.

No hace falta integración nativa con Meta: **Zapier o Make** ponen el trigger
_New Lead_ (su app ya pasó el App Review de Meta) y reenvían el lead aquí con una
acción _Webhooks → Custom Request_. El endpoint acepta el lead tal cual lo
entrega la Graph API (`field_data`) o ya aplanado, y tolera diferencias de
mayúsculas, tildes y signos en el nombre de las preguntas.

```bash
curl -s -X POST "$API/intake/meta" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"form_id":"123456","id":"99887766","field_data":[
        {"name":"full_name","values":["Ana Ruiz"]},
        {"name":"email","values":["ana@ejemplo.com"]}]}'
# → { "data": { "action": "created", "recordId": "…", "mapped": [...], "ignored": [...] } }
```

Los errores se devuelven como `{ "error": { "code", "message", "fieldErrors" } }`
con el código HTTP correspondiente (400/401/403/404/409/429).
