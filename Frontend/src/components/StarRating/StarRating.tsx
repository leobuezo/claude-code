/**
 * StarRating Component
 * Componente de calificación con estrellas (modo readonly e interactivo)
 */

'use client';

import { useState, useCallback } from 'react';
import styles from './StarRating.module.scss';

interface StarRatingProps {
  rating: number; // 0-5, puede ser decimal
  totalRatings?: number; // Número total de ratings
  showCount?: boolean; // Mostrar contador de ratings
  size?: 'small' | 'medium' | 'large'; // Tamaño visual
  readonly?: boolean; // Modo solo lectura
  interactive?: boolean; // Modo interactivo (alias para !readonly)
  onRatingChange?: (rating: number) => void; // Callback al seleccionar rating
  disabled?: boolean; // Deshabilitar interacción
  className?: string; // Clase CSS adicional
  userId?: number; // Para marcar si usuario ya calificó
}

/**
 * Sub-componente: Icono de estrella con diferentes estados de relleno
 */
interface StarIconProps {
  fillState: 'empty' | 'half' | 'full';
}

const StarIcon = ({ fillState }: StarIconProps) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        {/* Gradient para media estrella */}
        <linearGradient id="halfStarGradient">
          <stop offset="50%" stopColor="currentColor" />
          <stop offset="50%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
        fill={
          fillState === 'full'
            ? 'currentColor'
            : fillState === 'half'
            ? 'url(#halfStarGradient)'
            : 'none'
        }
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

/**
 * Componente principal: StarRating
 */
export const StarRating = ({
  rating,
  totalRatings = 0,
  showCount = false,
  size = 'medium',
  readonly = false,
  interactive = false,
  onRatingChange,
  disabled = false,
  className = '',
}: StarRatingProps) => {
  const [hoverRating, setHoverRating] = useState<number>(0);

  // El modo interactivo se activa si interactive=true o si hay un callback onRatingChange y no es readonly
  const isInteractive = (interactive || Boolean(onRatingChange)) && !readonly;
  const isDisabled = disabled || readonly;

  /**
   * Determina el estado de relleno de cada estrella
   */
  const getStarFillState = (starIndex: number): 'empty' | 'half' | 'full' => {
    // En modo interactivo, el hover tiene prioridad sobre el rating actual
    const currentRating = isInteractive && hoverRating > 0 ? hoverRating : rating;
    const clampedRating = Math.max(0, Math.min(5, currentRating));

    if (clampedRating >= starIndex) return 'full';
    if (clampedRating >= starIndex - 0.5) return 'half';
    return 'empty';
  };

  /**
   * Handlers de interactividad
   */
  const handleMouseEnter = useCallback(
    (star: number) => {
      if (!isInteractive || disabled) return;
      setHoverRating(star);
    },
    [isInteractive, disabled]
  );

  const handleMouseLeave = useCallback(() => {
    if (!isInteractive || disabled) return;
    setHoverRating(0);
  }, [isInteractive, disabled]);

  const handleClick = useCallback(
    (star: number) => {
      if (!isInteractive || disabled || !onRatingChange) return;
      onRatingChange(star);
    },
    [isInteractive, disabled, onRatingChange]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, star: number) => {
      if (!isInteractive || disabled) return;

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowUp': {
          event.preventDefault();
          const nextStar = Math.min(5, star + 1);
          setHoverRating(nextStar);
          // Mover foco al siguiente botón
          const nextButton = event.currentTarget.nextElementSibling as HTMLButtonElement | null;
          if (nextButton) nextButton.focus();
          break;
        }
        case 'ArrowLeft':
        case 'ArrowDown': {
          event.preventDefault();
          const prevStar = Math.max(1, star - 1);
          setHoverRating(prevStar);
          // Mover foco al botón anterior
          const prevButton = event.currentTarget.previousElementSibling as HTMLButtonElement | null;
          if (prevButton) prevButton.focus();
          break;
        }
        case 'Enter':
        case ' ': {
          event.preventDefault();
          if (onRatingChange) {
            onRatingChange(star);
          }
          break;
        }
        case 'Escape': {
          event.preventDefault();
          setHoverRating(0);
          break;
        }
      }
    },
    [isInteractive, disabled, onRatingChange]
  );

  // Formatear el rating para mostrar (1 decimal)
  const formattedRating = rating.toFixed(1);

  if (!isInteractive) {
    // Modo readonly: renderizar como imagen (no interactivo)
    return (
      <div
        className={`${styles.starRating} ${styles[size]} ${className}`}
        role="img"
        aria-label={`Rating: ${formattedRating} out of 5 stars${
          showCount && totalRatings > 0 ? `, ${totalRatings} ratings` : ''
        }`}
      >
        <div className={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <span
              key={star}
              className={`${styles.star} ${styles[getStarFillState(star)]}`}
              aria-hidden="true"
            >
              <StarIcon fillState={getStarFillState(star)} />
            </span>
          ))}
        </div>

        {/* Contador de ratings (opcional) */}
        {showCount && totalRatings > 0 && (
          <span className={styles.count} aria-label={`${totalRatings} ratings`}>
            ({totalRatings})
          </span>
        )}
      </div>
    );
  }

  // Modo interactivo: renderizar con botones
  return (
    <div
      className={`${styles.starRating} ${styles[size]} ${styles.interactive} ${className}`}
      role="group"
      aria-label={`Rate this course. Current rating: ${formattedRating} out of 5 stars`}
      onMouseLeave={handleMouseLeave}
    >
      <div className={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`${styles.star} ${styles[getStarFillState(star)]} ${
              hoverRating >= star ? styles.hover : ''
            }`}
            onClick={() => handleClick(star)}
            onMouseEnter={() => handleMouseEnter(star)}
            onKeyDown={(e) => handleKeyDown(e, star)}
            disabled={isDisabled}
            aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
            aria-pressed={rating === star}
            tabIndex={isDisabled ? -1 : 0}
          >
            <StarIcon fillState={getStarFillState(star)} />
          </button>
        ))}
      </div>

      {/* Contador de ratings (opcional) */}
      {showCount && totalRatings > 0 && (
        <span className={styles.count} aria-label={`${totalRatings} ratings`}>
          ({totalRatings})
        </span>
      )}
    </div>
  );
};
