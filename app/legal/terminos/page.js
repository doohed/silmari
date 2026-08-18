import { LEGAL } from '@/lib/config/legal';
import { appName } from '@/lib/config/app';

export const metadata = { title: 'Términos del servicio · Silmari' };

export default function TerminosPage() {
  return (
    <>
      <h1>Términos del servicio</h1>
      <p>
        Estas condiciones regulan la contratación y el uso de {appName()}, prestado por{' '}
        {LEGAL.companyName}. Al crear una cuenta las aceptas.
      </p>

      <h2>La cuenta</h2>
      <p>
        Debes ser mayor de edad y facilitar datos veraces. Eres responsable de la confidencialidad
        de tu contraseña y de la actividad de tu espacio de trabajo, incluida la de las personas a
        las que invites. Avísanos en cuanto detectes un acceso no autorizado.
      </p>

      <h2>Planes, precios y pago</h2>
      <ul>
        <li>
          Los planes y sus límites son los publicados en la aplicación. Cada plan tiene topes de
          miembros, registros, API keys, webhooks y entradas de leads.
        </li>
        <li>
          Los precios se muestran sin impuestos; el IVA aplicable se calcula en el momento del pago
          según tu país.
        </li>
        <li>
          La suscripción se renueva automáticamente por periodos iguales salvo que la canceles antes
          del final del periodo en curso. Puedes cancelar en cualquier momento desde Ajustes.
        </li>
        <li>
          Al cancelar mantienes el servicio hasta el final del periodo ya pagado. No se devuelve la
          parte proporcional del periodo en curso salvo que la ley lo exija.
        </li>
        <li>
          Si un cobro falla, se reintenta durante unos días. Si no llega a buen fin, la cuenta pasa
          al plan gratuito y dejan de poder crearse recursos por encima de sus límites, sin que se
          borre nada de lo existente.
        </li>
      </ul>

      <h2>Uso aceptable</h2>
      <p>No puedes usar el servicio para:</p>
      <ul>
        <li>Enviar comunicaciones no solicitadas ni tratar datos obtenidos ilícitamente.</li>
        <li>Vulnerar derechos de terceros o la normativa de protección de datos.</li>
        <li>
          Intentar acceder a datos de otros clientes, sobrecargar la infraestructura o eludir los
          límites del plan por medios técnicos.
        </li>
      </ul>
      <p>
        Podemos suspender una cuenta que incumpla esto, avisando salvo que la gravedad o una
        obligación legal exijan actuar de inmediato.
      </p>

      <h2>Tus datos</h2>
      <p>
        El contenido que introduces es tuyo. Puedes exportarlo en cualquier momento desde Ajustes, y
        también durante los 30 días de gracia posteriores a la baja. Pasado ese plazo se elimina de
        forma definitiva. El tratamiento se rige por la política de privacidad y por el contrato de
        encargo del tratamiento.
      </p>

      <h2>Disponibilidad</h2>
      <p>
        Trabajamos para que el servicio esté disponible de forma continuada, pero puede haber
        interrupciones por mantenimiento o por causas ajenas. Salvo que se pacte por escrito un
        acuerdo de nivel de servicio, no garantizamos un porcentaje concreto de disponibilidad.
      </p>

      <h2>Responsabilidad</h2>
      <p>
        En la medida que permita la ley, nuestra responsabilidad se limita al importe abonado en los
        doce meses anteriores al hecho que la origine. No respondemos del lucro cesante ni de daños
        indirectos. Nada de esto limita la responsabilidad que legalmente no se pueda excluir.
      </p>

      <h2>Cambios</h2>
      <p>
        Podemos modificar estas condiciones avisando con antelación razonable por correo o desde la
        propia aplicación. Si no las aceptas, puedes cancelar antes de que entren en vigor.
      </p>

      <h2>Ley aplicable</h2>
      <p>
        Se aplica la legislación española. Si contratas como consumidor, conservas los derechos que
        te reconozca la normativa de consumo de tu país de residencia.
      </p>
    </>
  );
}
