import { randomUUID } from 'node:crypto';
import ObjectMetadata from '@/models/ObjectMetadata';
import FieldMetadata from '@/models/FieldMetadata';

/**
 * Definiciones de los objetos estándar que se siembran en cada workspace nuevo.
 * Se insertan directamente (no vía servicios) porque corren dentro de la
 * transacción de signup y son datos de bootstrap de confianza.
 */
export const STANDARD_OBJECTS = [
  {
    key: 'company',
    nameSingular: 'company',
    namePlural: 'companies',
    slug: 'companies',
    labelSingular: 'Empresa',
    labelPlural: 'Empresas',
    icon: 'Building2',
    fields: [
      { name: 'name', label: 'Nombre', type: 'TEXT', isNullable: false, identifier: true, isIndexed: true },
      { name: 'domainName', label: 'Dominio', type: 'LINKS' },
      { name: 'employees', label: 'Empleados', type: 'NUMBER' },
      { name: 'annualRecurringRevenue', label: 'ARR', type: 'CURRENCY' },
      { name: 'address', label: 'Dirección', type: 'ADDRESS' },
      { name: 'industry', label: 'Sector', type: 'TEXT' },
      { name: 'linkedinLink', label: 'LinkedIn', type: 'LINKS' },
    ],
  },
  {
    key: 'person',
    nameSingular: 'person',
    namePlural: 'people',
    slug: 'people',
    labelSingular: 'Contacto',
    labelPlural: 'Contactos',
    icon: 'User',
    fields: [
      { name: 'name', label: 'Nombre', type: 'FULL_NAME', isNullable: false, identifier: true, isIndexed: true },
      { name: 'emails', label: 'Emails', type: 'EMAILS' },
      { name: 'phones', label: 'Teléfonos', type: 'PHONES' },
      { name: 'jobTitle', label: 'Puesto', type: 'TEXT' },
      { name: 'city', label: 'Ciudad', type: 'TEXT' },
      { name: 'linkedinLink', label: 'LinkedIn', type: 'LINKS' },
      {
        name: 'company',
        label: 'Empresa',
        type: 'RELATION',
        isIndexed: true,
        relation: { type: 'MANY_TO_ONE', target: 'company' },
      },
    ],
  },
  {
    key: 'opportunity',
    nameSingular: 'opportunity',
    namePlural: 'opportunities',
    slug: 'opportunities',
    labelSingular: 'Oportunidad',
    labelPlural: 'Oportunidades',
    icon: 'Target',
    fields: [
      { name: 'name', label: 'Nombre', type: 'TEXT', isNullable: false, identifier: true, isIndexed: true },
      { name: 'amount', label: 'Monto', type: 'CURRENCY' },
      {
        name: 'stage',
        label: 'Etapa',
        type: 'SELECT',
        isIndexed: true,
        options: [
          { label: 'Nueva', value: 'new', color: 'gray' },
          { label: 'Propuesta', value: 'proposal', color: 'blue' },
          { label: 'Negociación', value: 'negotiation', color: 'orange' },
          { label: 'Ganada', value: 'won', color: 'green' },
          { label: 'Perdida', value: 'lost', color: 'red' },
        ],
      },
      { name: 'closeDate', label: 'Fecha de cierre', type: 'DATE' },
      { name: 'probability', label: 'Probabilidad', type: 'PERCENT' },
      {
        name: 'company',
        label: 'Empresa',
        type: 'RELATION',
        isIndexed: true,
        relation: { type: 'MANY_TO_ONE', target: 'company' },
      },
      {
        name: 'pointOfContact',
        label: 'Contacto',
        type: 'RELATION',
        isIndexed: true,
        relation: { type: 'MANY_TO_ONE', target: 'person' },
      },
      // Campo de sistema: su valor vive en la raíz del documento
      // (`records.createdBy`), no en `data`. Ver lib/records/field-path.js.
      { name: 'createdBy', label: 'Creado por', type: 'ACTOR', isSystem: true },
    ],
  },
];
// Nota: Notas, Tareas y Archivos NO son objetos estándar; se modelan como
// colecciones dedicadas (activities/attachments) con targets polimórficos.

function normalizeStandardOptions(options) {
  return options.map((o, i) => ({
    id: randomUUID(),
    label: o.label,
    value: o.value,
    color: o.color ?? 'gray',
    position: i,
  }));
}

/**
 * Siembra los objetos estándar en un workspace, dentro de una transacción.
 * Devuelve los campos que requieren índice dinámico (para sincronizarlos tras
 * el commit; Mongo no crea índices dentro de una transacción).
 * @param {{ workspaceId: any }} args
 * @param {{ session?: import('mongoose').ClientSession }} [opts]
 * @returns {Promise<{ toIndex: Array<object> }>}
 */
export async function seedStandardObjects({ workspaceId }, { session } = {}) {
  const idByKey = {};

  // 1. Objetos.
  for (let i = 0; i < STANDARD_OBJECTS.length; i += 1) {
    const def = STANDARD_OBJECTS[i];
    const [obj] = await ObjectMetadata.create(
      [
        {
          workspaceId,
          nameSingular: def.nameSingular,
          namePlural: def.namePlural,
          slug: def.slug,
          labelSingular: def.labelSingular,
          labelPlural: def.labelPlural,
          icon: def.icon,
          isCustom: false,
          isActive: true,
          position: i,
        },
      ],
      { session },
    );
    idByKey[def.key] = obj._id;
  }

  // 2. Campos (resolviendo relaciones e identificador).
  const toIndex = [];
  for (const def of STANDARD_OBJECTS) {
    const objectMetadataId = idByKey[def.key];
    let identifierId = null;

    for (let pos = 0; pos < def.fields.length; pos += 1) {
      const f = def.fields[pos];
      const [fieldDoc] = await FieldMetadata.create(
        [
          {
            workspaceId,
            objectMetadataId,
            name: f.name,
            label: f.label,
            type: f.type,
            isNullable: f.isNullable ?? true,
            isUnique: f.isUnique ?? false,
            isIndexed: f.isIndexed ?? false,
            isCustom: false,
            isSystem: f.isSystem ?? false,
            position: pos,
            options: f.options ? normalizeStandardOptions(f.options) : undefined,
            relation:
              f.type === 'RELATION'
                ? {
                    type: f.relation.type,
                    targetObjectMetadataId: idByKey[f.relation.target],
                    onDelete: 'SET_NULL',
                  }
                : undefined,
          },
        ],
        { session },
      );
      if (f.identifier) identifierId = fieldDoc._id;
      if (fieldDoc.isUnique || fieldDoc.isIndexed) toIndex.push(fieldDoc.toObject());
    }

    await ObjectMetadata.updateOne(
      { _id: objectMetadataId },
      { $set: { labelIdentifierFieldId: identifierId } },
      { session },
    );
  }

  return { toIndex };
}
