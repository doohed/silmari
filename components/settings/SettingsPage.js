/**
 * Envoltorio de una sección de Ajustes: la columna estrecha y el título.
 *
 * Existe para que las doce secciones no repitan el mismo `div` con sus
 * márgenes, que era de donde venía la deriva: cada página había ido ajustando
 * el suyo y ninguna medía igual que la de al lado.
 *
 * **La cabecera es solo el título, sin acciones a la derecha.** La ventana de
 * Ajustes mide lo mismo en todas las secciones y se navega entre ellas sin
 * recargar: cualquier cosa que cambie la altura de la cabecera hace que el
 * título salte de sitio al pasar de una a otra. Los controles de "añadir" van
 * en una fila del primer grupo, que además es donde los pone macOS — dentro de
 * la lista, no en la barra de título.
 *
 * **Sin párrafo de descripción**, por el mismo criterio que la página de Perfil:
 * el título de la sección, el del grupo y una descripción decían casi siempre lo
 * mismo tres veces. Lo que hay que explicar va donde se usa — el `hint` de la
 * fila o el `footnote` del grupo—, no en una frase suelta arriba que se lee una
 * vez y estorba siempre.
 *
 * @param {{ title: string, children: import('react').ReactNode }} props
 */
export function SettingsPage({ title, children }) {
  return (
    <div className="mx-auto max-w-2xl px-8 py-8">
      <h1 className="text-primary mb-6 text-xl font-semibold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}

export default SettingsPage;
