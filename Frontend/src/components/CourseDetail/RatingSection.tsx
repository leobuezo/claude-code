'use client';

import { useState, useEffect, useRef } from 'react';
import { StarRating } from '@/components/StarRating/StarRating';
import { ratingsApi, ApiError } from '@/services/ratingsApi';
import styles from './RatingSection.module.scss';

interface RatingSectionProps {
  courseId: number;
  initialAverageRating?: number;
  initialTotalRatings?: number;
  userId: number; // TODO: Reemplazar con userId del sistema de auth
}

function calculateOptimisticAverage(
  currentAverage: number,
  currentTotal: number,
  oldRating: number,
  newRating: number,
  isNewRating: boolean
): number {
  if (currentTotal === 0) return newRating;
  if (isNewRating) {
    const sum = currentAverage * currentTotal + newRating;
    return sum / (currentTotal + 1);
  } else {
    const sum = currentAverage * currentTotal - oldRating + newRating;
    return sum / currentTotal;
  }
}

export const RatingSection = ({
  courseId,
  initialAverageRating = 0,
  initialTotalRatings = 0,
  userId,
}: RatingSectionProps) => {
  const [userRating, setUserRating] = useState<number>(0);
  const [averageRating, setAverageRating] = useState(initialAverageRating);
  const [totalRatings, setTotalRatings] = useState(initialTotalRatings);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const loadUserRating = async () => {
      try {
        const rating = await ratingsApi.getUserRating(courseId, userId);
        if (rating) {
          setUserRating(rating.rating);
        }
      } catch (err) {
        console.error('Failed to load user rating:', err);
      }
    };

    loadUserRating();
  }, [courseId, userId]);

  const handleRatingChange = async (newRating: number) => {
    const previousRating = userRating;
    const previousAverage = averageRating;
    const previousTotal = totalRatings;

    try {
      setUserRating(newRating);
      setIsLoading(true);
      setError(null);

      const isNewRating = previousRating === 0;
      const newTotal = isNewRating ? previousTotal + 1 : previousTotal;
      const newAverage = calculateOptimisticAverage(
        previousAverage,
        previousTotal,
        previousRating,
        newRating,
        isNewRating
      );

      setAverageRating(parseFloat(newAverage.toFixed(1)));
      setTotalRatings(newTotal);

      await ratingsApi.createRating(courseId, { user_id: userId, rating: newRating });

      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      setSuccessMessage('Rating guardado exitosamente');
      successTimerRef.current = setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setUserRating(previousRating);
      setAverageRating(previousAverage);
      setTotalRatings(previousTotal);

      const errorMessage =
        err instanceof ApiError
          ? err.message
          : 'Error al guardar rating. Por favor intenta de nuevo.';

      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      setError(errorMessage);
      errorTimerRef.current = setTimeout(() => setError(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className={styles.ratingSection}>
      <div className={styles.userRating}>
        <h3 className={styles.title}>Califica este curso</h3>
        <StarRating
          rating={userRating}
          onRatingChange={handleRatingChange}
          size="large"
          disabled={isLoading}
        />

        {isLoading && <p className={styles.loadingText}>Guardando...</p>}

        {error && (
          <p className={styles.errorText} role="alert">
            {error}
          </p>
        )}

        {successMessage && (
          <p className={`${styles.successText} ${styles.successAnimation}`} role="status">
            {successMessage}
          </p>
        )}
      </div>

      <div className={styles.ratingsStats}>
        <h4 className={styles.statsTitle}>Rating general</h4>
        <StarRating
          rating={averageRating}
          readonly={true}
          size="medium"
          showCount={true}
          totalRatings={totalRatings}
        />
        <p className={styles.statsDescription}>
          Basado en {totalRatings} {totalRatings === 1 ? 'valoración' : 'valoraciones'}
        </p>
      </div>
    </section>
  );
};
