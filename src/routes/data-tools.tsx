import { createFileRoute } from "@tanstack/react-router";
import { CategoryPage, categoryHead } from "@/components/category-page";
import { getCategory } from "@/lib/tools";

export const Route = createFileRoute("/data-tools")({
  head: () => categoryHead(getCategory("data-tools")),
  component: DataToolsRoutePage,
});

function DataToolsRoutePage() {
  return <CategoryPage cat={getCategory("data-tools")} />;
}
