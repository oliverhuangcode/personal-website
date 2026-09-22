import type { Metadata } from "next";

import { ProjectSelect } from "@/components/projects/ProjectSelect";
import { projects } from "@/content/projects";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return <ProjectSelect projects={projects} />;
}
