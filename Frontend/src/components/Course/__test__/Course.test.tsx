import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { axe, toHaveNoViolations } from "jest-axe";
import { Course } from "../Course";

expect.extend(toHaveNoViolations);

describe("Course Component", () => {
  const mockCourse = {
    id: 1,
    name: "React Fundamentals",
    description: "Aprende React desde cero",
    thumbnail: "https://example.com/thumbnail.jpg",
    average_rating: 4.5,
    total_ratings: 120,
  };

  it("renders course information correctly", () => {
    render(<Course {...mockCourse} />);

    expect(screen.getByText(mockCourse.name)).toBeDefined();
    expect(screen.getByText(mockCourse.description)).toBeDefined();
  });

  it("renders thumbnail with correct alt text", () => {
    render(<Course {...mockCourse} />);

    const thumbnail = screen.getByAltText(mockCourse.name);
    expect(thumbnail).toHaveAttribute("src", mockCourse.thumbnail);
  });

  it("renders with correct structure", () => {
    const { container } = render(<Course {...mockCourse} />);

    expect(container.querySelector("article")).toBeDefined();
    expect(container.querySelector("div > img")).toBeDefined();
    expect(container.querySelector("div > h2")).toBeDefined();
    expect(container.querySelector("div > p")).toBeDefined();
  });

  it("renders star rating when average_rating is provided", () => {
    render(<Course {...mockCourse} />);

    const stars = screen.getAllByRole("img", { hidden: true });
    expect(stars.length).toBeGreaterThan(0);
  });

  it("does not render star rating when average_rating is undefined", () => {
    const { id, name, description, thumbnail } = mockCourse;
    const { container } = render(
      <Course id={id} name={name} description={description} thumbnail={thumbnail} />
    );

    expect(container.querySelector("[class*='ratingContainer']")).toBeNull();
  });

  it("passes accessibility audit", async () => {
    const { container } = render(<Course {...mockCourse} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
