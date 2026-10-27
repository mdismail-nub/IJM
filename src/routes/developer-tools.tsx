import { createFileRoute } from "@tanstack/react-router";
import { CategoryPage, categoryHead } from "@/components/category-page";
import { getCategory } from "@/lib/tools";

export const Route = createFileRoute("/developer-tools")({
  head: () => categoryHead(getCategory("developer-tools")),
  component: DeveloperToolsRoutePage,
});

function DeveloperToolsRoutePage() {
  return <CategoryPage cat={getCategory("developer-tools")} />;
}
