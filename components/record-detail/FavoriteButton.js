'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import {
  isFavoriteAction,
  addFavoriteAction,
  removeFavoriteAction,
} from '@/app/(workspace)/objects/actions';

/** Botón de favorito para un registro. */
export function FavoriteButton({ recordId }) {
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
      className={`shrink-0 transition-colors ${fav ? 'text-yellow-500' : 'text-tertiary hover:text-primary'}`}
    >
      <Star size={16} fill={fav ? 'currentColor' : 'none'} />
    </button>
  );
}

export default FavoriteButton;
