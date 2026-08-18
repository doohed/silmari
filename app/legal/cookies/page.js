import { COOKIES, LEGAL } from '@/lib/config/legal';

export const metadata = { title: 'Política de cookies · Silmari' };

export default function CookiesPage() {
  return (
    <>
      <h1>Política de cookies</h1>

      <h2>No verás un banner de cookies</h2>
      <p>
        No porque nos lo saltemos, sino porque no hace falta. Silmari no usa analítica, ni píxeles
        publicitarios, ni rastreadores de terceros. Las únicas cookies que existen son las que hacen
        falta para que el servicio funcione y las que guardan una preferencia que has elegido tú.
      </p>
      <p>
        La normativa exige consentimiento previo para las cookies que no son necesarias. Para estas
        no lo es, y pedirte permiso para algo que no lo necesita sería tan incorrecto como no
        pedirlo cuando toca.
      </p>

      <h2>Cookies que usamos</h2>
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Para qué</th>
            <th>Tipo</th>
            <th>Duración</th>
          </tr>
        </thead>
        <tbody>
          {COOKIES.map((c) => (
            <tr key={c.name}>
              <td>
                <code>{c.name}</code>
              </td>
              <td>{c.purpose}</td>
              <td>{c.category}</td>
              <td>{c.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Cómo eliminarlas</h2>
      <p>
        Puedes borrarlas desde la configuración de tu navegador. Ten en cuenta que si eliminas la
        cookie de sesión se cerrará tu sesión y tendrás que volver a entrar.
      </p>

      <h2>Si esto cambia</h2>
      <p>
        Si en el futuro incorporamos alguna herramienta de analítica, actualizaremos esta página e
        implantaremos un mecanismo de consentimiento previo antes de activarla. Para dudas:{' '}
        {LEGAL.privacyEmail}.
      </p>
    </>
  );
}
