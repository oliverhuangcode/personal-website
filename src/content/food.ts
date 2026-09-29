import type { Restaurant } from "./types";

export const MAX_DISHES = 8;

// ⚠️ PLACEHOLDER — invented entries. Replace with the real log; order doesn't matter, rank comes from score.
// Photos live in /public/photos/food/<restaurant>-<n>.jpg.
export const restaurants: Restaurant[] = [
  {
    name: "ICHIRAN",
    city: "FUKUOKA",
    cuisine: "RAMEN",
    visited: "MAR 2026",
    score: 9.2,
    review: "Solo booth, no small talk, broth that coats the spoon. Worth the queue.",
    dishes: [
      { name: "TONKOTSU", tag: "MUST ORDER" },
      { name: "KAEDAMA" },
      { name: "MATCHA ANNIN" },
    ],
  },
  {
    name: "MANTEIGARIA",
    city: "LISBON",
    cuisine: "PASTRY",
    visited: "JUN 2025",
    score: 8.7,
    review: "One thing on the menu and they have it down. Eat it standing, still warm.",
    dishes: [{ name: "PASTEL DE NATA", tag: "MUST ORDER" }],
  },
  {
    name: "EULJIRO JJIGAE",
    city: "SEOUL",
    cuisine: "KOREAN",
    visited: "NOV 2025",
    score: 9.0,
    review: "Bubbling at the table before you sit down. Banchan refills without asking.",
    dishes: [
      { name: "KIMCHI JJIGAE", tag: "MUST ORDER" },
      { name: "GYERAN MARI" },
      { name: "SPAM FRIED RICE", tag: "SKIP" },
    ],
  },
];
