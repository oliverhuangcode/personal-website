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
6. Create `.env.local` in the repo root. It's already gitignored.
   ```
   R2_ACCOUNT_ID=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET=oh-media
   ```
7. Set `MEDIA_BASE` in `src/content/site.ts` to `https://media.<your-domain>`.
8. Run `npm run photos -- --check`. It should print `R2 OK`.

Only your machine uploads photos, so these keys never go into GitHub.

### 2. The Google Sheet
1. Create a Google Sheet, then use **File → Import → Upload** to import `docs/food-sheet-template.csv` ("Replace current sheet"). That gives you the columns. Delete the placeholder rows once you've added real ones.
2. Go to **File → Share → Publish to web**. Choose the tab with your log and **Comma-separated values (.csv)**, then **Publish**. Copy the URL.
3. Put the URL in `.env.local` as `FOOD_SHEET_CSV_URL=...`, and run `npm run food:sync` to test it.
4. On GitHub, go to the repo's **Settings → Secrets and variables → Actions → New repository secret**. Name it `FOOD_SHEET_CSV_URL` and paste the same URL.
5. In **Actions → Food sync → Run workflow**, run it once by hand to check it works. After that it runs daily.

---

## Sheet columns
| column | required | example | notes |
|---|---|---|---|
| name | ✓ | Ichiran | |
| city | ✓ | Melbourne | groups spots into city pages |
| score | ✓ | 9.2 | 0–10, one decimal |
| country | | Australia | |
| area | | CBD | suburb or neighbourhood |
| cuisine | | Ramen | becomes a filter chip |
| price | | $$ | `$` to `$$$$` |
| visited | | 2026-03-14 | `YYYY-MM-DD` (or `YYYY-MM`) |
| review | | Solo booth, broth that coats the spoon. | |
| dishes | | `Tonkotsu [MUST ORDER]; Kaedama; Spam rice [SKIP]` | separate with `;`; an optional `[TAG]` becomes a chip |
| coords | | `-37.8136, 144.9631` | long-press the place in Google Maps and copy; used by the map later |

- Rank is worked out from the score, so row order doesn't matter.
- The tier shown next to each score comes from it too:

  | score | tier |
  |---|---|
  | 9.5+ | RADIANT |
  | 9+ | IMMORTAL |
  | 8+ | DIAMOND |
  | 7+ | PLATINUM |
  | 6+ | GOLD |
  | below 6 | IRON |

- A row missing its name, city or a valid score is **skipped with a warning**; it doesn't block the rest. Skipped rows are listed on the Action's run page.
- If the sheet can't be fetched at all, the run fails, GitHub emails you, and nothing on the site changes.

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
