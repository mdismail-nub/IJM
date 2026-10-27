import { createFileRoute } from "@tanstack/react-router";
import { CategoryPage, categoryHead } from "@/components/category-page";
import { getCategory } from "@/lib/tools";

export const Route = createFileRoute("/file-tools")({
  head: () => categoryHead(getCategory("file-tools")),
  component: FileToolsRoutePage,
});

function FileToolsRoutePage() {
  return <CategoryPage cat={getCategory("file-tools")} />;
}
