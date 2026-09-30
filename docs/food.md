# Food log: sheet, photos, and the site

The food section is built from two sources:

- **A Google Sheet** holds the restaurants: names, scores, reviews and dishes. A GitHub Action syncs it daily into `src/content/food.generated.json`.
- **Cloudflare R2** holds the photos. `npm run photos` converts and uploads them, and records each one in `src/content/media.generated.json`.

Both JSON files are committed. The site only ever reads those files, so if the sheet or R2 is down, the site keeps its last good copy.

```
Google Sheet ──(daily Action / npm run food:sync)──▶ food.generated.json ─┐
                                                                         ├─▶ /food, /food/<city>
.photo-inbox/ ──(npm run photos)──▶ R2 + media.generated.json ───────────┘
```

---

## One-time setup

### 1. Cloudflare R2
1. In the Cloudflare dashboard, open **R2 Object Storage** and enable it. It asks for a card, but the free tier is 10 GB of storage with free egress.
2. **Create bucket**: name it `oh-media`, with location hint *Oceania*.
3. In the bucket, go to **Settings → Custom Domains → Connect Domain**. Enter `media.<your-domain>` and confirm; Cloudflare adds the DNS record.
4. Leave **Public Development URL (r2.dev)** disabled. It's rate-limited and isn't cached.
5. Back on the R2 overview, go to **API → Manage API tokens → Create API token**:
   - Permissions: **Object Read & Write**
   - Specify bucket: **oh-media** only
   - Create it, then copy the **Access Key ID** and the **Secret Access Key** (the secret is only shown once). Also copy your **Account ID**, which is on the R2 overview page.
6. Run `cp .env.example .env.local` (or `.env`) and fill in the R2 values. Both are gitignored.
7. `MEDIA_BASE` in `src/content/site.ts` is already `https://media.olivrhuang.com`.
8. Run `npm run photos -- --check`. It should print `R2 OK`.

Only your machine uploads photos, so these keys never go into GitHub.

### 2. The Google Sheet
1. Create a Google Sheet, then use **File → Import → Upload** to import `docs/food-sheet-template.csv` ("Replace current sheet"). That gives you the columns. Delete the placeholder rows once you've added real ones.
2. Go to **File → Share → Publish to web**. Choose the tab with your log and **Comma-separated values (.csv)**, then **Publish**. Copy the URL.
3. Put the URL in `.env.local` as `FOOD_SHEET_CSV_URL`, and run `npm run food:sync` to test it.
4. On GitHub, go to the repo's **Settings → Secrets and variables → Actions → New repository secret**. Name it `FOOD_SHEET_CSV_URL` and paste the same URL.
5. In **Actions → Food sync → Run workflow**, run it once by hand to check it works. After that it runs daily.

---

## Sheet columns
| column | required | example | notes |
|---|---|---|---|
| name | ✓ | Ichiran | |
| city | ✓ | Melbourne | groups spots into city pages |
| score | ✓ | 9.2 | 0–10, one decimal |
| area | | CBD | suburb or neighbourhood |
| cuisine | | Ramen | becomes a filter chip |
| price | | $$ | `$` to `$$$$` |
| visited | | 2026-03-14 | `YYYY-MM-DD` (or `YYYY-MM`) |
| review | | Solo booth, broth that coats the spoon. | |
| dishes | | `Tonkotsu [MUST ORDER]; Kaedama; Spam rice [SKIP]` | separate with `;`; an optional `[TAG]` becomes a chip |
| coords | | `-37.8136, 144.9631` | long-press the place in Google Maps and copy; used by the map later |

- Rank is worked out from the score, so row order doesn't matter.
- A row missing its name, city or a valid score is **skipped with a warning**; it doesn't block the rest. Skipped rows are listed on the Action's run page.
- If the sheet can't be fetched at all, the run fails, GitHub emails you, and nothing on the site changes.

### Keeping the sheet tidy
Filters and city pages group by **exact text** (case is ignored), so `Ramen` and `Ramen bar` become two chips. In Google Sheets, select a column and use **Data → Data validation → Dropdown** to make these pick-lists:

| column | dropdown values |
|---|---|
| city | the cities you've eaten in, spelled one way (`Melbourne`, not `Melb`) |
| price | `$`, `$$`, `$$$`, `$$$$` (about under $20, $20–40, $40–80, and $80+ per person) |
| cuisine | a short fixed list, e.g. `Japanese`, `Ramen`, `Sushi`, `Korean`, `Chinese`, `Dumplings`, `Thai`, `Vietnamese`, `Indian`, `Italian`, `Pizza`, `Mexican`, `Middle Eastern`, `Burgers`, `BBQ`, `Seafood`, `Cafe`, `Bakery`, `Dessert`, `Modern Australian`, `Bar` |

Add a cuisine the first time you need it, but reuse the existing one when it's close enough. Around 15–25 cuisines keeps the filter chips useful.

**Dish tags:** keep to a few so they mean something. Suggested:
- `MUST ORDER`
- `SIGNATURE`
- `SKIP`
- `SHARE`
- `SPICY`

Write one in square brackets after the dish, e.g. `Tonkotsu [MUST ORDER]`.

**Scores:** a rough scale keeps them comparable across years. On the site, score bars run from 5 to 10:

| score | meaning |
|---|---|
| 9.5+ | one of the best meals you've had; you'd plan a trip around it |
| 9 | would go back often, top of its city |
| 8 | very good, happily recommend |
| 7 | good, glad you went |
| 6 | fine, wouldn't seek out |
| below 6 | not worth it |

---

## Adding photos
1. Copy the photos into the inbox, one folder per restaurant, and **name each file after its dish**:
   ```
   .photo-inbox/food/Ichiran/Tonkotsu.HEIC
   .photo-inbox/food/Ichiran/Kaedama.jpg
   .photo-inbox/travel/Japan/1.jpg
   ```
   - Case, spaces and extension don't matter; HEIC straight from an iPhone is fine.
   - The folder name must match the restaurant's **name** in the sheet, and the file name must match a **dish**. Both are compared as slugs, so `Ichiran` and `ichiran` are the same.
   - Travel folders match the trip names in `src/content/trips.ts`.
2. Run `npm run photos`. For each photo it:
   - turns the photo upright;
   - removes all metadata, **including GPS location**;
   - saves a 1600px and a 640px WebP;
   - uploads both to R2 with a year-long cache;
   - records the photo in `media.generated.json`;
   - moves the original to `.photo-inbox/done/`.
3. Commit `src/content/media.generated.json`.

**Notes:**
- `npm run photos -- --dry-run` converts into `.photo-inbox/preview/` without uploading, so you can check the output first.
- Re-uploading a photo with the same name replaces it; the new file gets a new URL, so browsers never show the old one.
- If a photo's name doesn't match any dish in the sheet, it still uploads, but you get a warning so you can fix the typo.

---

## Deploying (Vercel, for now)
The site is a static export, so any static host works; moving to the Oracle server later only changes where `out/` is served from.

1. At vercel.com, sign in with GitHub, choose **Add New → Project**, and import `personal-website`. The defaults are right: Next.js, with `npm run build`. No environment variables are needed, since the site only reads the committed JSON.
2. In **Project → Settings → Domains**, add `olivrhuang.com` and `www.olivrhuang.com`, with one redirecting to the other.
3. In Cloudflare DNS, add the records Vercel shows and set each to **DNS only (grey cloud)**, not proxied:
   - `www` → CNAME `cname.vercel-dns.com`
   - `@` → A `76.76.21.21`

   Leave the `media` record that R2 created as it is (proxied).
4. Every push to main now deploys, including the daily food-sync commit.
