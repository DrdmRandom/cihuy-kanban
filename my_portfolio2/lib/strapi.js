const STRAPI_BASE_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL || "https://strapi.cihuy-familly.my.id";

async function fetchCollection(path) {
  const response = await fetch(`${STRAPI_BASE_URL}${path}`, {
    next: { revalidate: 300 }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload?.data) ? payload.data : [];
}

export async function getPortfolioData() {
  const [experiencesResult, projectsResult] = await Promise.allSettled([
    fetchCollection("/api/work-experiences-dawwis?populate=*"),
    fetchCollection("/api/projects-dawwis?populate=*")
  ]);

  const experiences =
    experiencesResult.status === "fulfilled" ? experiencesResult.value : [];
  const projects = projectsResult.status === "fulfilled" ? projectsResult.value : [];

  return {
    experiences,
    projects,
    sourceState: {
      experiences: experiencesResult.status,
      projects: projectsResult.status
    }
  };
}

export function splitTags(value) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
