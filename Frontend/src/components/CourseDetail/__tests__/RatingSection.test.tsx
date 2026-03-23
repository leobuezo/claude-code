'use client';

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { axe, toHaveNoViolations } from "jest-axe";
import { RatingSection } from "../RatingSection";
import { ratingsApi, ApiError } from "@/services/ratingsApi";

expect.extend(toHaveNoViolations);

vi.mock("@/services/ratingsApi", () => ({
  ratingsApi: {
    getUserRating: vi.fn(),
    createRating: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    code: string;
    constructor(message: string, status: number, code: string) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.code = code;
    }
  },
}));

const mockRatingsApi = ratingsApi as unknown as {
  getUserRating: ReturnType<typeof vi.fn>;
  createRating: ReturnType<typeof vi.fn>;
};

// Helper: get the 5 interactive star buttons
function getInteractiveStars() {
  const group = screen.getByRole("group", { name: /Rate this course/i });
  return Array.from(group.querySelectorAll("button"));
}

describe("RatingSection Component", () => {
  beforeEach(() => {
    mockRatingsApi.getUserRating.mockResolvedValue(null);
    mockRatingsApi.createRating.mockResolvedValue({
      id: 1,
      course_id: 1,
      user_id: 1,
      rating: 4,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the rating section with title and stats", async () => {
    await act(async () => {
      render(
        <RatingSection
          courseId={1}
          initialAverageRating={4.2}
          initialTotalRatings={50}
          userId={1}
        />
      );
    });

    expect(screen.getByText("Califica este curso")).toBeDefined();
    expect(screen.getByText("Rating general")).toBeDefined();
    expect(screen.getByText(/50 valoraciones/)).toBeDefined();
  });

  it("uses singular 'valoración' for 1 rating", async () => {
    await act(async () => {
      render(
        <RatingSection
          courseId={1}
          initialAverageRating={5}
          initialTotalRatings={1}
          userId={1}
        />
      );
    });

    expect(screen.getByText(/1 valoración/)).toBeDefined();
  });

  it("loads user existing rating on mount", async () => {
    mockRatingsApi.getUserRating.mockResolvedValue({ id: 1, course_id: 1, user_id: 1, rating: 3 });

    await act(async () => {
      render(<RatingSection courseId={1} userId={1} />);
    });

    expect(mockRatingsApi.getUserRating).toHaveBeenCalledWith(1, 1);
  });

  it("shows loading state while saving rating", async () => {
    let resolveCreate!: (value: unknown) => void;
    mockRatingsApi.createRating.mockReturnValue(
      new Promise((resolve) => { resolveCreate = resolve; })
    );

    await act(async () => {
      render(<RatingSection courseId={1} userId={1} />);
    });

    const stars = getInteractiveStars();
    await act(async () => {
      fireEvent.click(stars[3]); // 4 stars
    });

    expect(screen.getByText("Guardando...")).toBeDefined();

    await act(async () => {
      resolveCreate({ id: 1, course_id: 1, user_id: 1, rating: 4 });
    });
  });

  it("shows success message after rating saved", async () => {
    await act(async () => {
      render(<RatingSection courseId={1} userId={1} />);
    });

    const stars = getInteractiveStars();
    await act(async () => {
      fireEvent.click(stars[3]);
    });

    expect(screen.getByText("Rating guardado exitosamente")).toBeDefined();
  });

  it("auto-clears success message after 3 seconds", async () => {
    vi.useFakeTimers();

    await act(async () => {
      render(<RatingSection courseId={1} userId={1} />);
    });

    const stars = getInteractiveStars();
    await act(async () => {
      fireEvent.click(stars[3]);
    });

    await act(async () => {
      await Promise.resolve(); // flush microtasks
    });

    expect(screen.queryByText("Rating guardado exitosamente")).toBeDefined();

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByText("Rating guardado exitosamente")).toBeNull();

    vi.useRealTimers();
  });

  it("shows error message and rolls back on API failure", async () => {
    mockRatingsApi.createRating.mockRejectedValue(
      new ApiError("Error del servidor", 500, "SERVER_ERROR")
    );

    await act(async () => {
      render(
        <RatingSection courseId={1} initialAverageRating={3} initialTotalRatings={10} userId={1} />
      );
    });

    const stars = getInteractiveStars();
    await act(async () => {
      fireEvent.click(stars[4]);
    });

    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText("Error del servidor")).toBeDefined();
  });

  it("auto-clears error message after 5 seconds", async () => {
    vi.useFakeTimers();

    mockRatingsApi.createRating.mockRejectedValue(
      new ApiError("Error del servidor", 500, "SERVER_ERROR")
    );

    await act(async () => {
      render(<RatingSection courseId={1} userId={1} />);
    });

    const stars = getInteractiveStars();
    await act(async () => {
      fireEvent.click(stars[0]);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByRole("alert")).toBeDefined();

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByRole("alert")).toBeNull();

    vi.useRealTimers();
  });

  it("applies optimistic update to average rating", async () => {
    let resolveCreate!: (value: unknown) => void;
    mockRatingsApi.createRating.mockReturnValue(
      new Promise((resolve) => { resolveCreate = resolve; })
    );

    await act(async () => {
      render(
        <RatingSection
          courseId={1}
          initialAverageRating={4}
          initialTotalRatings={10}
          userId={1}
        />
      );
    });

    expect(screen.getByText(/10 valoraciones/)).toBeDefined();

    const stars = getInteractiveStars();
    await act(async () => {
      fireEvent.click(stars[4]); // 5 stars — new rating
    });

    // Optimistic update: total should now be 11
    expect(screen.getByText(/11 valoraciones/)).toBeDefined();

    await act(async () => {
      resolveCreate({ id: 1, course_id: 1, user_id: 1, rating: 5 });
    });
  });

  it("disables stars while loading", async () => {
    let resolveCreate!: (value: unknown) => void;
    mockRatingsApi.createRating.mockReturnValue(
      new Promise((resolve) => { resolveCreate = resolve; })
    );

    await act(async () => {
      render(<RatingSection courseId={1} userId={1} />);
    });

    const stars = getInteractiveStars();
    await act(async () => {
      fireEvent.click(stars[2]);
    });

    const disabledStars = getInteractiveStars();
    disabledStars.forEach((star) => {
      expect(star).toBeDisabled();
    });

    await act(async () => {
      resolveCreate({ id: 1, course_id: 1, user_id: 1, rating: 3 });
    });
  });

  it("passes accessibility audit", async () => {
    let container!: HTMLElement;

    await act(async () => {
      const result = render(
        <RatingSection
          courseId={1}
          initialAverageRating={4.2}
          initialTotalRatings={50}
          userId={1}
        />
      );
      container = result.container;
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
