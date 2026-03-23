import { notFound } from "next/navigation";
import { CourseDetail } from "@/types";
import { CourseDetailComponent } from "@/components/CourseDetail/CourseDetail";

interface CoursePageProps {
  params: {
    slug: string;
  };
}

async function getCourseData(slug: string): Promise<CourseDetail> {
  const response = await fetch(`http://localhost:8000/courses/${slug}`, {
    cache: "no-store", // Ensures fresh data on each request
  });

  if (response.status === 404) {
    notFound();
  }

  if (!response.ok) {
    throw new Error("Failed to fetch course data");
  }

  const data = await response.json();
  return {
    ...data,
    average_rating: data.average_rating ?? 0,
    total_ratings: data.total_ratings ?? 0,
  };
}

export default async function CoursePage({ params }: CoursePageProps) {
  const courseData = await getCourseData(params.slug);

  return <CourseDetailComponent course={courseData} />;
}

export async function generateMetadata({ params }: CoursePageProps) {
  const courseData = await getCourseData(params.slug);

  return {
    title: `${courseData.title} - Curso Online`,
    description: courseData.description,
  };
}
