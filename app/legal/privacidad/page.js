import { LEGAL, SUBPROCESSORS } from '@/lib/config/legal';

export const metadata = { title: 'Política de privacidad · Silmari' };

export default function PrivacidadPage() {
  return (
    <>
      <h1>Política de privacidad</h1>

      <h2>Quién trata tus datos</h2>
      <p>
        {LEGAL.companyName}, con {LEGAL.taxId} y domicilio en {LEGAL.address}. Para cualquier asunto
        relacionado con tus datos personales: {LEGAL.privacyEmail}.
      </p>

      <h2>Dos papeles distintos</h2>
      <p>
        Esta distinción es la más importante de todo el documento, porque de ella depende quién
        responde de qué:
      </p>
      <ul>
        <li>
          <strong>Somos responsables</strong> de los datos de las personas que se registran y usan
          Silmari: tu nombre, tu email, tu foto y los datos de facturación.
        </li>
        <li>
          <strong>Somos encargados</strong> de los datos que tú introduces en el CRM sobre tus
          propios contactos, empresas y oportunidades. Esos datos son tuyos; nosotros solo los
          alojamos y procesamos siguiendo tus instrucciones. El responsable frente a esas personas
          eres tú, y por eso necesitas firmar con nosotros un contrato de encargo del tratamiento.
        </li>
      </ul>

      <h2>Qué datos tratamos y con qué base legal</h2>
      <ul>
        <li>
          <strong>Cuenta</strong> (email, nombre, contraseña cifrada, foto): para prestarte el
          servicio. Base legal: la ejecución del contrato.
        </li>
        <li>
          <strong>Facturación</strong> (datos fiscales, historial de pagos): para cobrarte y cumplir
          las obligaciones contables. Base legal: contrato y obligación legal.
        </li>
        <li>
          <strong>Registros de uso</strong> (accesos, direcciones IP en los intentos de inicio de
          sesión): para proteger las cuentas frente a accesos no autorizados. Base legal: interés
          legítimo en la seguridad del servicio.
        </li>
        <li>
          <strong>Contenido del CRM</strong>: lo tratamos únicamente por cuenta tuya, según el
          contrato de encargo.
        </li>
      </ul>

      <h2>A quién se comunican</h2>
      <p>
        No vendemos datos ni los cedemos con fines publicitarios. Recurrimos a estos proveedores,
        cada uno con su contrato de encargo firmado:
      </p>
      <table>
        <thead>
          <tr>
            <th>Proveedor</th>
            <th>Para qué</th>
            <th>Ubicación</th>
          </tr>
        </thead>
        <tbody>
          {SUBPROCESSORS.map((s) => (
            <tr key={s.name}>
              <td>{s.name}</td>
              <td>{s.purpose}</td>
              <td>{s.location}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Algunos están fuera del Espacio Económico Europeo. En esos casos la transferencia se ampara
        en las cláusulas contractuales tipo aprobadas por la Comisión Europea.
      </p>

      <h2>Cuánto tiempo los conservamos</h2>
      <p>
        Mientras tengas la cuenta activa. Al borrarla, los datos quedan inaccesibles de inmediato y
        se eliminan definitivamente pasado un periodo de gracia de 30 días, que existe para poder
        recuperar un borrado hecho por error. Los datos de facturación se conservan el plazo que
        exige la normativa fiscal.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Puedes acceder a tus datos, rectificarlos, suprimirlos, oponerte al tratamiento, limitarlo y
        pedir su portabilidad escribiendo a {LEGAL.privacyEmail}. Desde Ajustes puedes además
        exportar todo el contenido de tu espacio de trabajo y eliminar tu cuenta sin pedírnoslo.
      </p>
      <p>
        Si crees que no hemos atendido bien tu solicitud, puedes reclamar ante la Agencia Española
        de Protección de Datos (www.aepd.es).
      </p>

      <h2>Seguridad</h2>
      <p>
        Las contraseñas se guardan con un algoritmo de derivación diseñado para ello, nunca en
        claro. Las credenciales de las integraciones se cifran en reposo. El acceso a los datos está
        separado por espacio de trabajo, y las copias de seguridad se guardan cifradas fuera del
        servidor principal.
      </p>
    </>
  );
}
