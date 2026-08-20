import { describe, it, expect } from 'vitest';
import { isPrivateAddress, assertPublicUrl } from '@/lib/http/safe-url';

describe('isPrivateAddress', () => {
  it('marca como interna toda la IPv4 que no debe salir de casa', () => {
    for (const ip of [
      '127.0.0.1',
      '127.1.2.3',
      '10.0.0.1',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254', // metadatos de la nube: el objetivo clásico
      '100.64.0.1', // CGNAT
      '0.0.0.0',
      '224.0.0.1', // multicast
      '255.255.255.255',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it('deja pasar la IPv4 pública', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '192.169.0.1', '99.99.99.99']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it('mira la IPv4 encajada dentro de una IPv6', () => {
    expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateAddress('::ffff:169.254.169.254')).toBe(true);
    expect(isPrivateAddress('64:ff9b::10.0.0.1')).toBe(true);
    expect(isPrivateAddress('::ffff:8.8.8.8')).toBe(false);
  });

  it('marca como interna la IPv6 local', () => {
    expect(isPrivateAddress('::1')).toBe(true);
    expect(isPrivateAddress('::')).toBe(true);
    expect(isPrivateAddress('fd00::1')).toBe(true); // ULA
    expect(isPrivateAddress('fe80::1%eth0')).toBe(true); // link-local con zona
    expect(isPrivateAddress('ff02::1')).toBe(true); // multicast
    expect(isPrivateAddress('2606:4700::1111')).toBe(false); // pública
  });

  it('ante lo que no sabe leer, no sale', () => {
    expect(isPrivateAddress('')).toBe(true);
    expect(isPrivateAddress(null)).toBe(true);
    expect(isPrivateAddress('no-es-una-ip')).toBe(true);
  });
});

describe('assertPublicUrl', () => {
  // Dos cosas de estos tests:
  // - `enforce: true` porque la guardia de red solo se aplica sola en producción.
  // - Con IP literal, `dns.lookup` no sale a la red: no dependen de la conexión.
  const check = (url) => assertPublicUrl(url, { enforce: true });
  it('rechaza apuntar a la red interna', async () => {
    await expect(check('http://127.0.0.1/hook')).rejects.toThrow(/interna/i);
    await expect(check('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(/interna/i);
    await expect(check('http://[::1]/hook')).rejects.toThrow(/interna/i);
  });

  it('rechaza esquemas y puertos fuera de la lista', async () => {
    await expect(check('file:///etc/passwd')).rejects.toThrow(/http/i);
    await expect(check('gopher://8.8.8.8/')).rejects.toThrow(/http/i);
    await expect(check('http://8.8.8.8:27017/')).rejects.toThrow(/puerto/i);
  });

  it('rechaza lo que no es una URL', async () => {
    await expect(check('no soy una url')).rejects.toThrow(/no es válida/i);
    await expect(check(undefined)).rejects.toThrow(/no es válida/i);
  });

  it('fuera de producción no bloquea el receptor local (si no, no se puede probar)', async () => {
    // NODE_ENV en los tests no es 'production', así que va sin `enforce`.
    await expect(assertPublicUrl('http://127.0.0.1:4010/hook')).resolves.toBeInstanceOf(URL);
    // El esquema sí se comprueba en todos los entornos.
    await expect(assertPublicUrl('file:///etc/passwd')).rejects.toThrow(/http/i);
  });

  it('admite un destino público', async () => {
    const url = await check('https://8.8.8.8:8443/hook');
    expect(url.hostname).toBe('8.8.8.8');
  });
});
