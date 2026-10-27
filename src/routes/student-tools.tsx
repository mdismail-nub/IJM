import { createFileRoute } from "@tanstack/react-router";
import { CategoryPage, categoryHead } from "@/components/category-page";
import { getCategory } from "@/lib/tools";

export const Route = createFileRoute("/student-tools")({
  head: () => categoryHead(getCategory("student-tools")),
  component: StudentToolsRoutePage,
});

function StudentToolsRoutePage() {
  return <CategoryPage cat={getCategory("student-tools")} />;
}
