import mongoose from 'mongoose';
import { createAccount } from '@/lib/accounts/signup';
import { createRecord } from '@/lib/records/service';

/**
 * Datos demo realistas (~200 registros) para probar la app con volumen. Crea una
 * cuenta demo, imprime sus credenciales y siembra empresas, contactos y
 * oportunidades con relaciones y etapas. Uso:
 *   MONGODB_URI=... node --loader ./scripts/alias-loader.mjs scripts/seed.js
 */

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const int = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const COMPANY_NAMES = [
  'Acme',
  'Globex',
  'Initech',
  'Umbrella',
  'Soylent',
  'Hooli',
  'Stark Industries',
  'Wayne Enterprises',
  'Cyberdyne',
  'Tyrell',
  'Wonka',
  'Aperture',
  'Massive Dynamic',
  'Vehement',
  'Pied Piper',
  'Vandelay',
  'Gekko & Co',
  'Prestige Worldwide',
  'Bluth Company',
  'Dunder Mifflin',
];
const INDUSTRIES = ['Software', 'Retail', 'Finanzas', 'Salud', 'Educación', 'Industria'];
const FIRST = [
  'Ada',
  'Alan',
  'Grace',
  'Linus',
  'Marie',
  'Nikola',
  'Rosa',
  'Hedy',
  'Katherine',
  'Tim',
];
const LAST = [
  'Lovelace',
  'Turing',
  'Hopper',
  'Torvalds',
  'Curie',
  'Tesla',
  'Parks',
  'Lamarr',
  'Johnson',
  'Berners-Lee',
];
const CITIES = ['Madrid', 'Barcelona', 'Sevilla', 'Valencia', 'Bilbao', 'Málaga'];
const JOBS = ['CEO', 'CTO', 'Ventas', 'Marketing', 'Operaciones', 'Producto'];
const STAGES = ['new', 'proposal', 'negotiation', 'won', 'lost'];

const stamp = Date.now();
const email = `demo_${stamp}@silmari.dev`;
const { userId, workspaceId } = await createAccount({
  firstName: 'Demo',
  lastName: 'User',
  email,
  password: 'demo1234',
  workspaceName: 'Demo',
});
const ctx = { userId, workspaceId, role: 'OWNER' };

const companies = [];
for (let i = 0; i < 20; i += 1) {
  const rec = await createRecord(ctx, {
    objectSlug: 'companies',
    source: 'SYSTEM',
    data: {
      name: COMPANY_NAMES[i] ?? `Empresa ${i + 1}`,
      employees: int(5, 5000),
      industry: rand(INDUSTRIES),
    },
  });
  companies.push(rec.id);
}

const people = [];
for (let i = 0; i < 120; i += 1) {
  const rec = await createRecord(ctx, {
    objectSlug: 'people',
    source: 'SYSTEM',
    data: {
      name: { firstName: rand(FIRST), lastName: rand(LAST) },
      emails: [`persona${i}@ejemplo.com`],
      jobTitle: rand(JOBS),
      city: rand(CITIES),
      company: rand(companies),
    },
  });
  people.push(rec.id);
}

for (let i = 0; i < 60; i += 1) {
  await createRecord(ctx, {
    objectSlug: 'opportunities',
    source: 'SYSTEM',
    data: {
      name: `Oportunidad ${i + 1}`,
      amount: { amount: int(1, 200) * 1000, currencyCode: 'EUR' },
      stage: rand(STAGES),
      probability: int(0, 100),
      closeDate: new Date(stamp + int(-30, 90) * 86400000).toISOString(),
      company: rand(companies),
      pointOfContact: rand(people),
    },
  });
}

console.log(`Sembrado: 20 empresas, 120 contactos, 60 oportunidades`);
console.log(`Cuenta demo → email: ${email}  contraseña: demo1234`);
await mongoose.disconnect();
