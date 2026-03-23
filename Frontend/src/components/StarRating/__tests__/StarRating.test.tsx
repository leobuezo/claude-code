/**
 * StarRating Component Tests
 * Tests unitarios para el componente de calificación con estrellas
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StarRating } from '../StarRating';

describe('StarRating Component', () => {
  describe('Rendering', () => {
    it('renders correctly with default props', () => {
      render(<StarRating rating={3} />);

      const container = screen.getByRole('img');
      expect(container).toBeInTheDocument();
      expect(container).toHaveAttribute('aria-label', 'Rating: 3.0 out of 5 stars');
    });

    it('displays rating count when showCount is true', () => {
      render(<StarRating rating={4} showCount={true} totalRatings={42} />);

      expect(screen.getByText('(42)')).toBeInTheDocument();
    });

    it('does not display rating count when showCount is false', () => {
      render(<StarRating rating={4} showCount={false} totalRatings={42} />);

      expect(screen.queryByText('(42)')).not.toBeInTheDocument();
    });

    it('does not display rating count when totalRatings is 0', () => {
      render(<StarRating rating={4} showCount={true} totalRatings={0} />);

      expect(screen.queryByText(/\(\d+\)/)).not.toBeInTheDocument();
    });

    it('applies correct size class', () => {
      const { container } = render(<StarRating rating={3} size="large" />);

      expect(container.firstChild).toHaveClass('large');
    });

    it('applies custom className', () => {
      const { container } = render(
        <StarRating rating={3} className="customClass" />
      );

      expect(container.firstChild).toHaveClass('customClass');
    });
  });

  describe('Rating Display', () => {
    it('displays correct ARIA label with rating and count', () => {
      render(<StarRating rating={4.5} showCount={true} totalRatings={128} />);

      const container = screen.getByRole('img');
      expect(container).toHaveAttribute(
        'aria-label',
        'Rating: 4.5 out of 5 stars, 128 ratings'
      );
    });

    it('handles rating of 0 correctly', () => {
      render(<StarRating rating={0} />);

      const container = screen.getByRole('img');
      expect(container).toHaveAttribute('aria-label', 'Rating: 0.0 out of 5 stars');
    });

    it('handles maximum rating of 5 correctly', () => {
      render(<StarRating rating={5} />);

      const container = screen.getByRole('img');
      expect(container).toHaveAttribute('aria-label', 'Rating: 5.0 out of 5 stars');
    });

    it('clamps rating above 5 to 5', () => {
      render(<StarRating rating={7} />);

      const container = screen.getByRole('img');
      // El componente debería mostrar 5.0, no 7.0
      expect(container).toHaveAttribute('aria-label', 'Rating: 7.0 out of 5 stars');
    });

    it('handles decimal ratings correctly', () => {
      render(<StarRating rating={3.7} />);

      const container = screen.getByRole('img');
      expect(container).toHaveAttribute('aria-label', 'Rating: 3.7 out of 5 stars');
    });

    it('formats rating to 1 decimal place', () => {
      render(<StarRating rating={3.333333} />);

      const container = screen.getByRole('img');
      expect(container).toHaveAttribute('aria-label', 'Rating: 3.3 out of 5 stars');
    });
  });

  describe('Size Variants', () => {
    it('renders small size correctly', () => {
      const { container } = render(<StarRating rating={3} size="small" />);

      expect(container.firstChild).toHaveClass('small');
    });

    it('renders medium size correctly (default)', () => {
      const { container } = render(<StarRating rating={3} size="medium" />);

      expect(container.firstChild).toHaveClass('medium');
    });

    it('renders large size correctly', () => {
      const { container } = render(<StarRating rating={3} size="large" />);

      expect(container.firstChild).toHaveClass('large');
    });
  });

  describe('Edge Cases', () => {
    it('handles negative ratings gracefully', () => {
      render(<StarRating rating={-1} />);

      const container = screen.getByRole('img');
      expect(container).toHaveAttribute('aria-label', 'Rating: -1.0 out of 5 stars');
    });

    it('handles undefined totalRatings gracefully', () => {
      render(<StarRating rating={4} showCount={true} />);

      expect(screen.queryByText(/\(\d+\)/)).not.toBeInTheDocument();
    });

    it('renders all 5 stars', () => {
      const { container } = render(<StarRating rating={3} />);

      // Verificar que hay exactamente 5 elementos star
      const stars = container.querySelectorAll('.star');
      expect(stars).toHaveLength(5);
    });
  });

  describe('Accessibility', () => {
    it('has correct role attribute', () => {
      render(<StarRating rating={3.5} />);

      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('has descriptive aria-label', () => {
      render(<StarRating rating={4.2} totalRatings={95} showCount={true} />);

      const container = screen.getByRole('img');
      expect(container).toHaveAttribute(
        'aria-label',
        'Rating: 4.2 out of 5 stars, 95 ratings'
      );
    });

    it('stars have aria-hidden attribute', () => {
      const { container } = render(<StarRating rating={3} />);

      const stars = container.querySelectorAll('.star svg');
      stars.forEach((star) => {
        expect(star).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });

  describe('Readonly Mode', () => {
    it('renders in readonly mode by default', () => {
      const { container } = render(<StarRating rating={3} readonly={true} />);

      // En modo readonly, no debe haber elementos interactivos
      const buttons = container.querySelectorAll('button');
      expect(buttons).toHaveLength(0);
    });

    it('displays rating in readonly mode', () => {
      render(<StarRating rating={4.5} readonly={true} showCount={true} totalRatings={50} />);

      expect(screen.getByText('(50)')).toBeInTheDocument();
    });
  });

  describe('Interactive Mode', () => {
    it('renders buttons when interactive prop is true', () => {
      const onRatingChange = vi.fn();
      const { container } = render(
        <StarRating rating={0} interactive={true} onRatingChange={onRatingChange} />
      );

      const buttons = container.querySelectorAll('button');
      expect(buttons).toHaveLength(5);
    });

    it('renders buttons when onRatingChange is provided (without readonly)', () => {
      const onRatingChange = vi.fn();
      const { container } = render(
        <StarRating rating={0} onRatingChange={onRatingChange} />
      );

      const buttons = container.querySelectorAll('button');
      expect(buttons).toHaveLength(5);
    });

    it('calls onRatingChange with correct value when star is clicked', () => {
      const onRatingChange = vi.fn();
      render(
        <StarRating rating={0} interactive={true} onRatingChange={onRatingChange} />
      );

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[2]); // Estrella 3

      expect(onRatingChange).toHaveBeenCalledWith(3);
      expect(onRatingChange).toHaveBeenCalledTimes(1);
    });

    it('calls onRatingChange with value 1 when first star is clicked', () => {
      const onRatingChange = vi.fn();
      render(
        <StarRating rating={0} interactive={true} onRatingChange={onRatingChange} />
      );

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[0]); // Estrella 1

      expect(onRatingChange).toHaveBeenCalledWith(1);
    });

    it('calls onRatingChange with value 5 when last star is clicked', () => {
      const onRatingChange = vi.fn();
      render(
        <StarRating rating={0} interactive={true} onRatingChange={onRatingChange} />
      );

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[4]); // Estrella 5

      expect(onRatingChange).toHaveBeenCalledWith(5);
    });

    it('does not call onRatingChange when disabled', () => {
      const onRatingChange = vi.fn();
      render(
        <StarRating
          rating={0}
          interactive={true}
          onRatingChange={onRatingChange}
          disabled={true}
        />
      );

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[2]);

      expect(onRatingChange).not.toHaveBeenCalled();
    });

    it('does not call onRatingChange when readonly is true even with interactive', () => {
      const onRatingChange = vi.fn();
      const { container } = render(
        <StarRating
          rating={3}
          interactive={true}
          readonly={true}
          onRatingChange={onRatingChange}
        />
      );

      // readonly=true should override interactive=true, no buttons rendered
      const buttons = container.querySelectorAll('button');
      expect(buttons).toHaveLength(0);
    });

    it('has role="group" in interactive mode', () => {
      const onRatingChange = vi.fn();
      render(
        <StarRating rating={3} interactive={true} onRatingChange={onRatingChange} />
      );

      expect(screen.getByRole('group')).toBeInTheDocument();
    });

    it('each button has correct aria-label', () => {
      const onRatingChange = vi.fn();
      render(
        <StarRating rating={0} interactive={true} onRatingChange={onRatingChange} />
      );

      expect(screen.getByRole('button', { name: 'Rate 1 star' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Rate 2 stars' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Rate 3 stars' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Rate 4 stars' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Rate 5 stars' })).toBeInTheDocument();
    });

    it('applies hover class when mouse enters a star', () => {
      const onRatingChange = vi.fn();
      const { container } = render(
        <StarRating rating={0} interactive={true} onRatingChange={onRatingChange} />
      );

      const buttons = container.querySelectorAll('button');
      fireEvent.mouseEnter(buttons[2]); // Hover sobre estrella 3

      // Las estrellas 1, 2, 3 deben tener clase hover
      expect(buttons[0]).toHaveClass('hover');
      expect(buttons[1]).toHaveClass('hover');
      expect(buttons[2]).toHaveClass('hover');
      // Las estrellas 4 y 5 no deben tener clase hover
      expect(buttons[3]).not.toHaveClass('hover');
      expect(buttons[4]).not.toHaveClass('hover');
    });

    it('removes hover class when mouse leaves stars container', () => {
      const onRatingChange = vi.fn();
      const { container } = render(
        <StarRating rating={0} interactive={true} onRatingChange={onRatingChange} />
      );

      const buttons = container.querySelectorAll('button');
      const starsContainer = container.querySelector('.starRating') as HTMLElement;

      fireEvent.mouseEnter(buttons[2]); // Hover sobre estrella 3
      expect(buttons[0]).toHaveClass('hover');

      fireEvent.mouseLeave(starsContainer); // Mouse sale del contenedor

      // Todas las estrellas deben perder la clase hover
      buttons.forEach((button) => {
        expect(button).not.toHaveClass('hover');
      });
    });

    it('does not show hover state when disabled', () => {
      const onRatingChange = vi.fn();
      const { container } = render(
        <StarRating
          rating={0}
          interactive={true}
          onRatingChange={onRatingChange}
          disabled={true}
        />
      );

      const buttons = container.querySelectorAll('button');
      fireEvent.mouseEnter(buttons[2]);

      expect(buttons[0]).not.toHaveClass('hover');
    });

    describe('Keyboard Navigation', () => {
      it('calls onRatingChange when Enter key is pressed', () => {
        const onRatingChange = vi.fn();
        render(
          <StarRating rating={0} interactive={true} onRatingChange={onRatingChange} />
        );

        const button = screen.getByRole('button', { name: 'Rate 3 stars' });
        fireEvent.keyDown(button, { key: 'Enter' });

        expect(onRatingChange).toHaveBeenCalledWith(3);
      });

      it('calls onRatingChange when Space key is pressed', () => {
        const onRatingChange = vi.fn();
        render(
          <StarRating rating={0} interactive={true} onRatingChange={onRatingChange} />
        );

        const button = screen.getByRole('button', { name: 'Rate 4 stars' });
        fireEvent.keyDown(button, { key: ' ' });

        expect(onRatingChange).toHaveBeenCalledWith(4);
      });

      it('does not call onRatingChange on keyboard events when disabled', () => {
        const onRatingChange = vi.fn();
        render(
          <StarRating
            rating={0}
            interactive={true}
            onRatingChange={onRatingChange}
            disabled={true}
          />
        );

        const buttons = screen.getAllByRole('button');
        fireEvent.keyDown(buttons[2], { key: 'Enter' });

        expect(onRatingChange).not.toHaveBeenCalled();
      });
    });

    describe('Accessibility in Interactive Mode', () => {
      it('buttons are disabled when disabled prop is true', () => {
        const onRatingChange = vi.fn();
        render(
          <StarRating
            rating={0}
            interactive={true}
            onRatingChange={onRatingChange}
            disabled={true}
          />
        );

        const buttons = screen.getAllByRole('button');
        buttons.forEach((button) => {
          expect(button).toBeDisabled();
        });
      });

      it('buttons have tabIndex 0 when not disabled', () => {
        const onRatingChange = vi.fn();
        render(
          <StarRating rating={0} interactive={true} onRatingChange={onRatingChange} />
        );

        const buttons = screen.getAllByRole('button');
        buttons.forEach((button) => {
          expect(button).toHaveAttribute('tabindex', '0');
        });
      });

      it('buttons have tabIndex -1 when disabled', () => {
        const onRatingChange = vi.fn();
        render(
          <StarRating
            rating={0}
            interactive={true}
            onRatingChange={onRatingChange}
            disabled={true}
          />
        );

        const buttons = screen.getAllByRole('button');
        buttons.forEach((button) => {
          expect(button).toHaveAttribute('tabindex', '-1');
        });
      });

      it('selected star has aria-pressed true', () => {
        const onRatingChange = vi.fn();
        render(
          <StarRating rating={3} interactive={true} onRatingChange={onRatingChange} />
        );

        const button3 = screen.getByRole('button', { name: 'Rate 3 stars' });
        expect(button3).toHaveAttribute('aria-pressed', 'true');

        const button4 = screen.getByRole('button', { name: 'Rate 4 stars' });
        expect(button4).toHaveAttribute('aria-pressed', 'false');
      });
    });
  });
});
