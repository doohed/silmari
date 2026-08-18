import { LEGAL } from '@/lib/config/legal';
import { appName, appUrl } from '@/lib/config/app';

export const metadata = { title: 'Aviso legal · Silmari' };

export default function AvisoLegalPage() {
  return (
    <>
      <h1>Aviso legal</h1>

      <h2>Identificación del titular</h2>
      <p>
        En cumplimiento del deber de información de la Ley 34/2002, de servicios de la sociedad de
        la información y de comercio electrónico:
      </p>
      <ul>
        <li>
          <strong>Titular:</strong> {LEGAL.companyName}
        </li>
        <li>
          <strong>NIF/CIF:</strong> {LEGAL.taxId}
        </li>
        <li>
          <strong>Domicilio:</strong> {LEGAL.address}
        </li>
        <li>
          <strong>Contacto:</strong> {LEGAL.contactEmail}
        </li>
        <li>
          <strong>Datos registrales:</strong> {LEGAL.registryInfo}
        </li>
        <li>
          <strong>Sitio web:</strong> {appUrl()}
        </li>
      </ul>

      <h2>Objeto</h2>
      <p>
        Este aviso regula el acceso y uso del sitio web y de la aplicación {appName()}. El mero
        acceso implica la aceptación de estas condiciones.
      </p>

      <h2>Propiedad intelectual</h2>
      <p>
        El software, el diseño, los textos y las marcas del sitio pertenecen a su titular o se usan
        con licencia. Queda prohibida su reproducción o distribución sin autorización expresa. Los
        contenidos que tú introduces en el servicio siguen siendo tuyos.
      </p>

      <h2>Responsabilidad</h2>
      <p>
        El titular no se hace responsable del uso que hagas del servicio ni de los contenidos que
        introduzcas, ni de los daños derivados de un uso contrario a estas condiciones o a la ley.
      </p>

      <h2>Legislación aplicable</h2>
      <p>
        Estas condiciones se rigen por la legislación española. Para cualquier controversia, las
        partes se someten a los juzgados y tribunales que correspondan conforme a derecho.
      </p>
    </>
  );
}
