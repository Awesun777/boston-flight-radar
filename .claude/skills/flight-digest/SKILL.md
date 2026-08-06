---
name: flight-digest
description: Research and publish today's BOS Flight Radar digest — the 5 cheapest US destinations flying from Boston (BOS) over the next 1–3 months, national-park-adjacent and solo-trip-friendly picks boosted, each with a mini travel guide. Writes deals/<date>.json + updates deals/index.json, then commits and pushes so GitHub Pages redeploys. Invoke as /flight-digest, or when the user asks to "run the flight radar" / "update the flight deals".
---

# BOS Flight Radar digest generator

You are curating a daily flight-deal brief for a solo traveler based in **Boston (BOS)**. The reader wants the **5 cheapest round-trip US-domestic destinations** departing BOS in the **next 1–3 months**, with a bias toward places **near national parks** or otherwise **great for solo trips** — and a short, practical travel guide for each.

Work from the root of this project (the `boston-flight-radar` repo). Produce real, researched, non-fabricated content.

## Step 1 — Today's key & prior coverage

1. Get today's date: `date +%F` → this is `DATE` (format `YYYY-MM-DD`).
2. If `deals/DATE.json` already exists, today's digest is done — say so and stop.
3. Read `deals/index.json` (may not exist on the very first run) and the **2 most recent** `deals/*.json` day files to see what was featured recently. Repeating a destination is fine when its fare is genuinely still among the cheapest — but refresh the price and note in `whyRanked` if it dropped or rose. Vary the guides: if a destination repeats, don't copy yesterday's guide verbatim.

## Step 2 — Research fares (real web data, not memory)

Use `WebSearch` and `WebFetch`. Google Flights itself is a heavy JS app that `WebFetch` cannot render — do **not** try to scrape it. Instead triangulate from public fare intelligence:

1. Search for current deals from Boston, e.g.:
   - `cheap flights from Boston deals <current month/year>`
   - `Boston flight deals site:goingawesome OR thriftytraveler OR secretflying` (Going, Thrifty Traveler, Secret Flying and similar deal blogs regularly post BOS fares)
   - `"from Boston" round trip $ deal <year>` and airline sale pages (JetBlue, Southwest, Delta, Breeze, Spirit, Frontier all run BOS sales)
   - Reddit r/flightdeals, r/boston travel threads from the past weeks
2. Only keep **US-domestic destinations** (50 states + DC + Puerto Rico is fine). Drop international fares even if cheaper.
3. Only keep fares plausibly bookable for travel in the **next 1–3 months** from `DATE`.
4. For each candidate, `WebFetch` the source page to confirm the fare claim is real and recent — never invent a price. Record a **price range** (`priceLow`–`priceHigh` USD round trip) rather than a false-precision single number, since deal posts age.
5. Typical cheap BOS routes to check when deal blogs are thin: Florida (MCO/TPA/FLL), Denver, Chicago, Atlanta, Nashville, Charleston, San Juan, Las Vegas, Phoenix, Salt Lake City. Verify with a search like `Boston to <city> cheapest month round trip` before including.

## Step 3 — Rank the top 5

Ranking is **price-first with a park/solo boost**: start from the cheapest verified fares, then let a destination jump a spot or two if it is
- within a reasonable drive of a **national park** (or a flagship state park / national seashore), or
- notably **solo-trip-friendly** (walkable, safe, hostels/transit, easy day trips).

A $79 fare to a dull layover city should still generally beat a $250 fare to a park gateway — the boost breaks ties and near-ties; it does not override price. Exactly 5 deals; if genuinely fewer verified fares exist, publish fewer rather than padding with guesses.

## Step 4 — Write the day file

Write `deals/DATE.json`:

```json
{
  "date": "<DATE>",
  "generatedAt": "<UTC ISO timestamp, date -u +%Y-%m-%dT%H:%M:%SZ>",
  "deals": [
    {
      "rank": 1,
      "destination": "Denver, CO",
      "airport": "DEN",
      "priceLow": 97,
      "priceHigh": 140,
      "travelWindow": "Sep 10 – Oct 25, cheapest midweek",
      "airlines": ["Southwest", "United"],
      "nonstop": true,
      "whyRanked": "One line: the fare + the boost, e.g. \"$97 RT and Rocky Mountain NP is 90 min away\"",
      "nearbyParks": [ { "name": "Rocky Mountain NP", "drive": "1.5 h" } ],
      "soloScore": 4,
      "soloWhy": "One sentence on why it works solo (walkability, hostels, transit, day-trip ease).",
      "guide": {
        "highlights": ["3–5 bullet highlights"],
        "itinerary": ["Day 1 — …", "Day 2 — …", "Day 3 — …"],
        "gettingAround": "One or two sentences (rental car needed? transit?).",
        "stayArea": "Which neighborhood/base to stay in and why.",
        "food": ["2–3 named places or local specialties"]
      },
      "verifyUrl": "https://www.google.com/travel/flights?q=Flights%20from%20BOS%20to%20DEN"
    }
  ]
}
```

Field rules:
- `rank` 1–5, cheapest-with-boost order; the UI sorts by it.
- `nearbyParks` — empty array if none; include realistic drive times.
- `soloScore` — integer 1–5.
- `verifyUrl` — always a Google Flights query URL of the form `https://www.google.com/travel/flights?q=Flights%20from%20BOS%20to%20<IATA>` so the reader can pull live prices in one click.
- Guides must be practical and specific (named trailheads, neighborhoods, restaurants), sized for a 2–3 day trip, written for a solo traveler. No marketing fluff.
- Prices are **indicative ranges from public fare intelligence**, and the site footer says so — never present them as live quotes.

## Step 5 — Update the catalog

Update `deals/index.json`. If it doesn't exist, create `{ "generatedAt": "...", "digests": [] }`. Then:
- Set `generatedAt` to the current UTC ISO timestamp.
- **Prepend** (or replace if same `DATE` already present):

```json
{ "date": "<DATE>", "title": "<3–6 word headline, e.g. Denver $97, Acadia shoulder season>",
  "destinations": ["DEN", "MCO", "SJU", "BNA", "CHS"] }
```

Keep `digests` newest-first. Validate both files parse (`python3 -m json.tool deals/<DATE>.json >/dev/null`).

## Step 6 — Publish

```sh
git add deals/
git commit -m "Deals <DATE>: <headline>"
git push
```

GitHub Pages redeploys automatically (~1 min). Stage **only `deals/`** — never edit `index.html` / `app.js` / `styles.css` to add content, and never touch any other repository (french-news-radar, french-voice-tutor).

## Step 7 — Recap

In chat, give a short bulleted recap — each destination with its price range and one-line hook — plus the live URL: https://awesun777.github.io/boston-flight-radar/. Flag the single best value of the day.

## Notes
- Fewer, verified deals beat a padded five. Never fabricate a fare or a source.
- The UI reads whatever is in `deals/`; you never edit the site files to add content.
- The nightly LaunchAgent `com.chen.flight-digest` runs this at 00:50 via `~/.local/bin/flight-digest.sh`; manual runs are safe because Step 1 skips an already-published day.
