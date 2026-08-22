'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Trash2, Plus, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SettingsGroup, SettingsRow, SettingsEmpty } from '@/components/ui/SettingsGroup';
import { Select } from '@/components/ui/Select';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import {
  listAutomationsAction,
  createAutomationAction,
  toggleAutomationAction,
  deleteAutomationAction,
} from '@/app/(workspace)/settings/automations/actions';

const EVENTS = [
  { value: 'record.created', label: 'Se crea un registro' },
  { value: 'record.updated', label: 'Se actualiza un registro' },
];

const ACTIONS = [
  { value: 'create_task', label: 'Crear una tarea' },
  { value: 'update_field', label: 'Actualizar un campo' },
  { value: 'notify', label: 'Avisar a alguien' },
];

// Operadores sin valor a la derecha.
const NO_VALUE = new Set(['isEmpty', 'isNotEmpty']);

const OPERATOR_LABELS = {
  eq: 'es igual a',
  neq: 'no es igual a',
  contains: 'contiene',
  notContains: 'no contiene',
  startsWith: 'empieza por',
  endsWith: 'termina en',
  isEmpty: 'está vacío',
  isNotEmpty: 'no está vacío',
  gt: 'mayor que',
  gte: 'mayor o igual que',
  lt: 'menor que',
  lte: 'menor o igual que',
  before: 'antes de',
  after: 'después de',
  is: 'es',
  isNot: 'no es',
  isAnyOf: 'es alguno de',
  isNoneOf: 'no es ninguno de',
  containsAny: 'contiene alguno de',
  containsAll: 'contiene todos',
};

const opLabel = (op) => OPERATOR_LABELS[op] ?? op;

/** Fila de chips para elegir varios miembros. */
function MemberPicker({ members, selected, onToggle }) {
  if (members.length === 0) return <p className="text-tertiary text-xs">No hay miembros</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {members.map((m) => {
        const on = selected.includes(m.userId);
        return (
          <button
            key={m.userId}
            type="button"
            onClick={() => onToggle(m.userId)}
            className={`rounded-md border px-2 py-0.5 text-xs ${on ? 'border-accent bg-accent-subtle text-primary' : 'border-border text-secondary'}`}
          >
            {m.name}
          </button>
        );
      })}
    </div>
  );
}

export function AutomationsPanel({ initialAutomations, objects, members }) {
  const confirm = useConfirm();
  const [automations, setAutomations] = useState(initialAutomations);
  const [name, setName] = useState('');
  const [objectSlug, setObjectSlug] = useState(objects[0]?.slug ?? '');
  const [event, setEvent] = useState('record.created');
  const [conditions, setConditions] = useState([]);
  const [actions, setActions] = useState([{ type: 'create_task', config: { title: '' } }]);
  const [saving, setSaving] = useState(false);

  const object = useMemo(() => objects.find((o) => o.slug === objectSlug), [objects, objectSlug]);
  const fields = object?.fields ?? [];
  const writableFields = fields.filter((f) => f.writable);

  const memberName = (id) => members.find((m) => m.userId === id)?.name ?? id;

  async function refresh() {
    const r = await listAutomationsAction();
    if (r.ok) setAutomations(r.data);
  }

  // --- Condiciones ---
  function addCondition() {
    const f = fields[0];
    if (!f) return;
    setConditions((c) => [...c, { fieldName: f.name, operator: f.operators[0], value: '' }]);
  }
  function setCondition(i, patch) {
    setConditions((c) => c.map((cond, j) => (j === i ? { ...cond, ...patch } : cond)));
  }
  function removeCondition(i) {
    setConditions((c) => c.filter((_, j) => j !== i));
  }

  // --- Acciones ---
  function addAction() {
    setActions((a) => [...a, { type: 'create_task', config: { title: '' } }]);
  }
  function setAction(i, patch) {
    setActions((a) => a.map((act, j) => (j === i ? { ...act, ...patch } : act)));
  }
  function setActionConfig(i, patch) {
    setActions((a) =>
      a.map((act, j) => (j === i ? { ...act, config: { ...act.config, ...patch } } : act)),
    );
  }
  function removeAction(i) {
    setActions((a) => a.filter((_, j) => j !== i));
  }
  function toggleActionMember(i, key, userId) {
    setActions((a) =>
      a.map((act, j) => {
        if (j !== i) return act;
        const list = act.config[key] ?? [];
        const next = list.includes(userId) ? list.filter((x) => x !== userId) : [...list, userId];
        return { ...act, config: { ...act.config, [key]: next } };
      }),
    );
  }

  function resetForm() {
    setName('');
    setConditions([]);
    setActions([{ type: 'create_task', config: { title: '' } }]);
  }

  async function create(e) {
    e.preventDefault();
    setSaving(true);
    const r = await createAutomationAction({
      name,
      trigger: { event, objectSlug },
      conditions: conditions.map((c) => ({
        fieldName: c.fieldName,
        operator: c.operator,
        value: NO_VALUE.has(c.operator) ? null : c.value,
      })),
      actions,
    });
    setSaving(false);
    if (!r.ok) return toast.error(r.message);
    resetForm();
    refresh();
    toast.success('Automatización creada');
  }

  async function toggle(id) {
    const r = await toggleAutomationAction({ id });
    if (r.ok) setAutomations((prev) => prev.map((a) => (a.id === id ? r.data : a)));
  }

  async function remove(id, autoName) {
    const ok = await confirm({
      title: 'Borrar automatización',
      message: `Se eliminará "${autoName}". Esta acción no se puede deshacer.`,
      confirmLabel: 'Borrar',
      danger: true,
    });
    if (!ok) return;
    const r = await deleteAutomationAction({ id });
    if (r.ok) refresh();
  }

  const objectLabel = (slug) => objects.find((o) => o.slug === slug)?.labelSingular ?? slug;
  const fieldLabel = (slug, fieldName) =>
    objects.find((o) => o.slug === slug)?.fields.find((f) => f.name === fieldName)?.label ??
    fieldName;

  /**
   * Cola del resumen: qué pasó la última vez. «ok» a secas era una mentira útil
   * para nadie — una acción `notify` sin destinatarios se ejecuta sin error y no
   * avisa a nadie, y una regla cuyas condiciones no casan nunca no dejaba rastro
   * ninguno. Ahora se distinguen los tres finales: sin efecto, omitida y ok.
   */
  function lastRunLabel(a) {
    const last = a.runLog[0];
    if (!last) {
      if (a.skippedCount > 0) {
        return ` · evaluada ${a.skippedCount} ${a.skippedCount === 1 ? 'vez' : 'veces'}, sin coincidencias`;
      }
      return ' · sin ejecuciones todavía';
    }
    if (!last.ok) return ' · última ejecución con error';
    if (last.details.some((d) => !d.ok)) return ' · última ejecución sin efecto';
    return ' · última ejecución ok';
  }

  /**
   * Resume una regla en una línea para el `hint` de su fila. Antes eran tres
   * párrafos apilados dentro de la tarjeta; en una lista agrupada, el resumen
   * tiene que caber en un renglón y el detalle vive al editar.
   */
  function describe(a) {
    const when = EVENTS.find((e) => e.value === a.trigger.event)?.label.toLowerCase();
    const conds = a.conditions.length
      ? ` y ${a.conditions.length} ${a.conditions.length === 1 ? 'condición' : 'condiciones'}`
      : '';
    const acts = `${a.actions.length} ${a.actions.length === 1 ? 'acción' : 'acciones'}`;
    return `Cuando ${when} en ${objectLabel(a.trigger.objectSlug)}${conds} → ${acts}${lastRunLabel(a)}`;
  }

  return (
    <div>
      <form onSubmit={create}>
        <SettingsGroup
          title="Nueva automatización"
          footnote="Se dispara con el evento que elijas, comprueba las condiciones y ejecuta las acciones en orden. Una regla que se dispara a sí misma se corta a los cinco saltos."
        >
          <SettingsRow label="Nombre">
            <Input
              aria-label="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="p. ej. Avisar al asignar"
              className="w-56"
            />
          </SettingsRow>

          <SettingsRow label="Cuando">
            <Select value={event} onChange={setEvent} options={EVENTS} className="w-56" />
          </SettingsRow>
          <SettingsRow label="En">
            <Select
              value={objectSlug}
              onChange={(v) => {
                setObjectSlug(v);
                setConditions([]);
              }}
              options={objects.map((o) => ({ value: o.slug, label: o.labelSingular }))}
              className="w-56"
            />
          </SettingsRow>

          <SettingsRow stacked label="Y se cumple (opcional)">
            <div className="space-y-2">
              {conditions.length === 0 && (
                <p className="text-tertiary text-xs">Sin condiciones: se ejecuta siempre.</p>
              )}
              {conditions.map((c, i) => {
                const field = fields.find((f) => f.name === c.fieldName);
                const operators = field?.operators ?? [];
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <Select
                        value={c.fieldName}
                        onChange={(v) => {
                          const nf = fields.find((f) => f.name === v);
                          setCondition(i, { fieldName: v, operator: nf?.operators[0] });
                        }}
                        options={fields.map((f) => ({ value: f.name, label: f.label }))}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Select
                        value={c.operator}
                        onChange={(v) => setCondition(i, { operator: v })}
                        options={operators.map((op) => ({ value: op, label: opLabel(op) }))}
                      />
                    </div>
                    {!NO_VALUE.has(c.operator) && (
                      <div className="min-w-0 flex-1">
                        <Input
                          value={c.value ?? ''}
                          onChange={(e) => setCondition(i, { value: e.target.value })}
                          placeholder="valor"
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeCondition(i)}
                      className="text-tertiary hover:text-danger shrink-0"
                      aria-label="Quitar condición"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
              <Button type="button" variant="secondary" size="sm" onClick={addCondition}>
                <Plus size={13} /> Añadir condición
              </Button>
            </div>
          </SettingsRow>

          <SettingsRow stacked label="Entonces">
            <div className="space-y-2">
              {actions.map((act, i) => (
                <div key={i} className="border-border space-y-2 rounded-md border p-2.5">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <Select
                        value={act.type}
                        onChange={(v) => setAction(i, { type: v, config: {} })}
                        options={ACTIONS}
                      />
                    </div>
                    {actions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAction(i)}
                        className="text-tertiary hover:text-danger shrink-0"
                        aria-label="Quitar acción"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {act.type === 'create_task' && (
                    <div className="space-y-2">
                      <Input
                        value={act.config.title ?? ''}
                        onChange={(e) => setActionConfig(i, { title: e.target.value })}
                        placeholder="Título de la tarea"
                      />
                      <div>
                        <span className="text-tertiary mb-1 block text-xs">Responsables</span>
                        <MemberPicker
                          members={members}
                          selected={act.config.assigneeIds ?? []}
                          onToggle={(id) => toggleActionMember(i, 'assigneeIds', id)}
                        />
                      </div>
                      <Input
                        type="number"
                        value={act.config.dueInDays ?? ''}
                        onChange={(e) =>
                          setActionConfig(i, {
                            dueInDays: e.target.value === '' ? undefined : Number(e.target.value),
                          })
                        }
                        placeholder="Vence en (días) — opcional"
                      />
                    </div>
                  )}

                  {act.type === 'update_field' && (
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        value={act.config.fieldName ?? ''}
                        onChange={(v) => setActionConfig(i, { fieldName: v })}
                        options={writableFields.map((f) => ({ value: f.name, label: f.label }))}
                        placeholder="Campo"
                      />
                      <Input
                        value={act.config.value ?? ''}
                        onChange={(e) => setActionConfig(i, { value: e.target.value })}
                        placeholder="Nuevo valor"
                      />
                    </div>
                  )}

                  {act.type === 'notify' && (
                    <div className="space-y-2">
                      <Input
                        value={act.config.title ?? ''}
                        onChange={(e) => setActionConfig(i, { title: e.target.value })}
                        placeholder="Título del aviso"
                      />
                      <Input
                        value={act.config.body ?? ''}
                        onChange={(e) => setActionConfig(i, { body: e.target.value })}
                        placeholder="Detalle (opcional)"
                      />
                      <div>
                        <span className="text-tertiary mb-1 block text-xs">Destinatarios</span>
                        <MemberPicker
                          members={members}
                          selected={act.config.userIds ?? []}
                          onToggle={(id) => toggleActionMember(i, 'userIds', id)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <Button type="button" variant="secondary" size="sm" onClick={addAction}>
                <Plus size={13} /> Añadir acción
              </Button>
            </div>
          </SettingsRow>

          <SettingsRow label="Crear la automatización">
            <Button size="md" type="submit" disabled={saving || !name.trim() || !objectSlug}>
              {saving ? 'Creando…' : 'Crear'}
            </Button>
          </SettingsRow>
        </SettingsGroup>
      </form>

      <SettingsGroup title="Automatizaciones">
        {automations.length === 0 && <SettingsEmpty>Todavía no has creado ninguna</SettingsEmpty>}
        {automations.map((a) => (
          <SettingsRow
            key={a.id}
            icon={<Zap size={15} className={a.enabled ? 'text-accent' : 'text-tertiary'} />}
            label={a.name}
            hint={describe(a)}
          >
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => toggle(a.id)}
                aria-pressed={a.enabled}
                className={a.enabled ? 'border-accent text-accent' : 'text-tertiary'}
              >
                {a.enabled ? 'Activa' : 'Inactiva'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove(a.id, a.name)}
                aria-label={`Borrar ${a.name}`}
                className="hover:text-danger"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </SettingsRow>
        ))}
      </SettingsGroup>
    </div>
  );
}

export default AutomationsPanel;
