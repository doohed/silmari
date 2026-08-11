'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Trash2, Plus, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
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
    setActions((a) => a.map((act, j) => (j === i ? { ...act, config: { ...act.config, ...patch } } : act)));
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

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="border-border bg-bg space-y-4 rounded-lg border p-4">
        <div>
          <Label htmlFor="auto-name">Nombre</Label>
          <Input
            id="auto-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="p. ej. Avisar al asignar una oportunidad grande"
          />
        </div>

        {/* Disparador */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Cuando</Label>
            <Select value={event} onChange={setEvent} options={EVENTS} />
          </div>
          <div>
            <Label>En</Label>
            <Select
              value={objectSlug}
              onChange={(v) => {
                setObjectSlug(v);
                setConditions([]);
              }}
              options={objects.map((o) => ({ value: o.slug, label: o.labelSingular }))}
            />
          </div>
        </div>

        {/* Condiciones */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="mb-0">Y se cumple (opcional)</Label>
            <button
              type="button"
              onClick={addCondition}
              className="text-accent flex items-center gap-1 text-xs"
            >
              <Plus size={13} /> Condición
            </button>
          </div>
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
        </div>

        {/* Acciones */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="mb-0">Entonces</Label>
            <button
              type="button"
              onClick={addAction}
              className="text-accent flex items-center gap-1 text-xs"
            >
              <Plus size={13} /> Acción
            </button>
          </div>
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
        </div>

        <Button size="sm" type="submit" disabled={saving || !name.trim() || !objectSlug}>
          {saving ? 'Creando…' : 'Crear automatización'}
        </Button>
      </form>

      {/* Lista */}
      <ul className="space-y-3">
        {automations.length === 0 && <li className="text-tertiary text-sm">Sin automatizaciones</li>}
        {automations.map((a) => (
          <li key={a.id} className="border-border bg-surface rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Zap size={14} className={a.enabled ? 'text-accent' : 'text-tertiary'} />
                  <p className="text-primary truncate text-sm font-medium">{a.name}</p>
                </div>
                <p className="text-secondary mt-0.5 text-xs">
                  Cuando {EVENTS.find((e) => e.value === a.trigger.event)?.label.toLowerCase()} en{' '}
                  <span className="text-primary">{objectLabel(a.trigger.objectSlug)}</span>
                  {a.conditions.length > 0 && (
                    <>
                      {' '}
                      y {a.conditions.length}{' '}
                      {a.conditions.length === 1 ? 'condición' : 'condiciones'}
                    </>
                  )}{' '}
                  → {a.actions.length} {a.actions.length === 1 ? 'acción' : 'acciones'}
                </p>
                {a.conditions.length > 0 && (
                  <p className="text-tertiary mt-1 truncate text-xs">
                    {a.conditions
                      .map(
                        (c) =>
                          `${fieldLabel(a.trigger.objectSlug, c.fieldName)} ${opLabel(c.operator)}${
                            NO_VALUE.has(c.operator) ? '' : ` "${c.value ?? ''}"`
                          }`,
                      )
                      .join(' · ')}
                  </p>
                )}
                {a.runLog.length > 0 && (
                  <p className="text-tertiary mt-1 text-xs">
                    Última ejecución: {a.runLog[0].ok ? 'ok' : `error (${a.runLog[0].error})`}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggle(a.id)}
                  className={`rounded-md border px-2 py-0.5 text-xs ${a.enabled ? 'border-accent text-accent' : 'border-border text-tertiary'}`}
                >
                  {a.enabled ? 'Activa' : 'Inactiva'}
                </button>
                <button
                  type="button"
                  onClick={() => remove(a.id, a.name)}
                  className="text-tertiary hover:text-danger"
                  aria-label="Borrar automatización"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default AutomationsPanel;
