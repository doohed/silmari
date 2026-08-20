'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import {
  isFavoriteAction,
  addFavoriteAction,
  removeFavoriteAction,
} from '@/app/(workspace)/objects/actions';

/**
 * Botón de favorito para un registro. La caja (tamaño y hover) la pasa quien lo
 * coloca vía `className`, para que case con el resto de botones de su barra sin
 * que este módulo tenga que importarla —y sin ciclo de imports—.
 * @param {{ recordId: string, className?: string }} props
 */
export function FavoriteButton({ recordId, className }) {
  const [fav, setFav] = useState(false);

  useEffect(() => {
    isFavoriteAction({ recordId }).then((r) => {
      if (r?.ok) setFav(r.data);
    });
  }, [recordId]);

  async function toggle() {
    if (fav) {
      await removeFavoriteAction({ recordId });
      setFav(false);
    } else {
      await addFavoriteAction({ recordId });
      setFav(true);
    }
    window.dispatchEvent(new Event('favorites:changed'));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={fav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
      aria-pressed={fav}
      className={`${className ?? 'shrink-0 transition-colors'} ${fav ? 'text-yellow-500' : 'hover:text-primary'}`}
    >
      <Star size={16} fill={fav ? 'currentColor' : 'none'} />
    </button>
  );
}

export default FavoriteButton;
