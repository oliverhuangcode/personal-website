import { links, site, SITE_URL } from "@/content/site";

/**
 * schema.org Person data for the homepage. `sameAs` ties this site to the profiles that link
 * back to it, which is how search engines tell this Oliver Huang apart from others.
 */
export const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: site.name,
  url: SITE_URL,
  jobTitle: "Software Engineer",
  description: site.bio,
  homeLocation: { "@type": "Place", name: "Melbourne, Australia" },
  alumniOf: [
    { "@type": "CollegeOrUniversity", name: "Monash University" },
    { "@type": "CollegeOrUniversity", name: "Auckland University of Technology" },
  ],
  affiliation: { "@type": "Organization", name: "Monash Association of Coding" },
  sameAs: links.filter((l) => l.href.startsWith("https://")).map((l) => l.href),
};

/** Serialised for a `<script type="application/ld+json">`, with `<` escaped so it can't close the tag. */
export const personSchemaJson = JSON.stringify(personSchema).replace(/</g, "\\u003c");
