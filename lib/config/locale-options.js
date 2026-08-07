/** Monedas y zonas horarias frecuentes para los desplegables de ajustes. */

/** @type {Array<{ value: string, label: string, symbol: string }>} */
export const CURRENCIES = [
  { value: 'EUR', label: 'Euro (€)', symbol: '€' },
  { value: 'USD', label: 'Dólar estadounidense ($)', symbol: '$' },
  { value: 'MXN', label: 'Peso mexicano ($)', symbol: '$' },
  { value: 'GBP', label: 'Libra esterlina (£)', symbol: '£' },
  { value: 'JPY', label: 'Yen japonés (¥)', symbol: '¥' },
  { value: 'CAD', label: 'Dólar canadiense ($)', symbol: '$' },
  { value: 'AUD', label: 'Dólar australiano ($)', symbol: '$' },
  { value: 'CHF', label: 'Franco suizo (CHF)', symbol: 'CHF' },
  { value: 'CNY', label: 'Yuan chino (¥)', symbol: '¥' },
  { value: 'BRL', label: 'Real brasileño (R$)', symbol: 'R$' },
  { value: 'ARS', label: 'Peso argentino ($)', symbol: '$' },
  { value: 'COP', label: 'Peso colombiano ($)', symbol: '$' },
  { value: 'CLP', label: 'Peso chileno ($)', symbol: '$' },
  { value: 'PEN', label: 'Sol peruano (S/)', symbol: 'S/' },
];

/** Zonas horarias frecuentes (IANA). */
export const TIMEZONES = [
  'Europe/Madrid',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Atlantic/Canary',
  'America/Mexico_City',
  'America/Mazatlan',
  'America/Tijuana',
  'America/Cancun',
  'America/Monterrey',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/Sao_Paulo',
  'UTC',
].map((tz) => ({ value: tz, label: tz.replace(/_/g, ' ') }));

/** Símbolo de una moneda por su código (o el propio código si no se conoce). */
export function currencySymbol(code) {
  return CURRENCIES.find((c) => c.value === code)?.symbol ?? code;
}
