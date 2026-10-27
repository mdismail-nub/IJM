import { createFileRoute } from "@tanstack/react-router";
import { CategoryPage, categoryHead } from "@/components/category-page";
import { getCategory } from "@/lib/tools";

export const Route = createFileRoute("/business-tools")({
  head: () => categoryHead(getCategory("business-tools")),
  component: BusinessToolsRoutePage,
});

function BusinessToolsRoutePage() {
  return <CategoryPage cat={getCategory("business-tools")} />;
}
