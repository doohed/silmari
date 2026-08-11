import { describe, it, expect } from 'vitest';
import { normalizeLeadPayload, normalizeKey } from '@/lib/leads/normalize-payload';

describe('normalizeKey', () => {
  it('quita tildes, signos y mayúsculas', () => {
    expect(normalizeKey('¿Cuál es tu e-mail?')).toBe('cual_es_tu_e_mail');
    expect(normalizeKey('  Full Name  ')).toBe('full_name');
    expect(normalizeKey('phone_number')).toBe('phone_number');
  });
});

describe('normalizeLeadPayload', () => {
  it('lee el lead tal cual lo devuelve la Graph API (field_data)', () => {
    const lead = normalizeLeadPayload({
      created_time: '2026-08-10T09:00:00+0000',
      id: '99887766',
      form_id: '123456',
      field_data: [
        { name: 'full_name', values: ['Ana Ruiz'] },
        { name: 'email', values: ['ana@ejemplo.com'] },
        { name: '¿Qué presupuesto tienes?', values: ['10.000 €'] },
      ],
    });

    expect(lead.formId).toBe('123456');
    expect(lead.leadId).toBe('99887766');
    expect(lead.fields).toEqual({
      full_name: 'Ana Ruiz',
      email: 'ana@ejemplo.com',
      que_presupuesto_tienes: '10.000 €',
    });
  });

  it('lee el objeto aplanado que entrega Zapier e ignora los metadatos de Meta', () => {
    const lead = normalizeLeadPayload({
      id: '1',
      form_id: '777',
      page_id: '42',
      ad_id: '9',
      campaign_name: 'Verano',
      created_time: '2026-08-10',
      full_name: 'Luis Paz',
      email: 'luis@ejemplo.com',
    });

    expect(lead.formId).toBe('777');
    expect(lead.fields).toEqual({ full_name: 'Luis Paz', email: 'luis@ejemplo.com' });
  });

  it('desenvuelve el payload anidado bajo data/lead', () => {
    const lead = normalizeLeadPayload({
      data: { lead: { form_id: '5', email: 'a@b.com' } },
    });
    expect(lead.formId).toBe('5');
    expect(lead.fields).toEqual({ email: 'a@b.com' });
  });

  it('lee los ids del webhook crudo de Meta (entry/changes/value)', () => {
    const lead = normalizeLeadPayload({
      entry: [
        {
          changes: [
            {
              value: { form_id: '321', leadgen_id: '654', created_time: 1754812800, page_id: '1' },
            },
          ],
        },
      ],
    });
    expect(lead.formId).toBe('321');
    expect(lead.leadId).toBe('654');
    expect(lead.fields).toEqual({});
  });

  it('aplana los valores múltiples y tolera un payload vacío', () => {
    const multi = normalizeLeadPayload({
      field_data: [{ name: 'intereses', values: ['a', 'b'] }],
    });
    expect(multi.fields.intereses).toEqual(['a', 'b']);

    const empty = normalizeLeadPayload({});
    expect(empty).toEqual({ formId: '', leadId: null, createdTime: null, fields: {} });
  });
});
