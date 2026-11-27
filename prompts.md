# PanSync — User Prompts Log

This file records every user prompt/instruction given during the design and build of **PanSync**, maintained chronologically and updated in the repository whenever new instructions arrive.

---

## Prompt 1 — `2026-11-27 12:28:14 +08:00`

````markdown
# PanSync — design & build plan

## Context
People throw away food because they don't know what to cook with the leftovers in their fridge. PanSync lets them enter what they have and get recipes that use it up, then plan the week and track what's going off. This is a **portfolio project**: it has to look polished, work every time a visitor opens it, and need no sign-up or secret keys. We're starting from nothing, in the folder the app made for this session.

**Goals (the user's picks):** a leftovers → recipes finder, a weekly meal plan with a shopping list, a fridge tracker with use-by dates, and favourites.
**Non-goals:** user accounts, a backend, AI-generated recipes, nutrition data, native mobile apps.
**Anti-goals:** a demo that breaks when an external service is down, and a demo that needs an API key or costs the owner money.

## Approaches considered
- **TheMealDB + built-in backup set: chosen by the user.** About 300 real recipes with photos from a free public database (its free key "1" covers learning and demo use). A small built-in set covers the case where the service is unreachable.
- Built-in collection only: always works, but fewer recipes and no photos.
- AI-generated recipes (Claude API): handles any ingredients, but needs a server and a paid key, and visitors would spend the owner's money.

## Stack (my calls)
- Vite + React + TypeScript, React Router, Tailwind CSS.
- Zustand with `persist` middleware for fridge, plan, favourites and staples (stored in localStorage).
- `idb-keyval` (IndexedDB) to cache the full recipe index, which is roughly 1 MB.
- `@dnd-kit/core` to drag recipes onto days in the plan.
- Vitest + React Testing Library.
- A static build that deploys free to Vercel. Deploying is optional and happens only with the user's go-ahead.

## How the recipe data works
`src/data/mealdb.ts`
- On first visit, fetch every recipe through `search.php?f=a` … `f=z` (26 parallel requests to `https://www.themealdb.com/api/json/v1/1/`), then map each one to a `Recipe`: `{id, name, image, category, area, instructions[], youtube, ingredients: {name, measure}[]}`, flattening `strIngredient1..20` / `strMeasure1..20`.
- Cache the index in IndexedDB with a timestamp and refresh it after 7 days. While the cache is valid, all matching runs locally, so a search makes no network calls and multi-ingredient search is instant.
- Ingredient autocomplete comes from `list.php?i=list`, also cached.
- If the fetch fails and there's no cache, load `src/data/fallback-recipes.json`: about 20 original, leftover-friendly recipes (fried rice, frittata, bubble-and-squeak-style hash, soups, wraps…) that use emoji/gradient cards instead of photos. Show a small "offline recipes" banner.

## Matching (the core logic, fully unit-tested)
`src/lib/matching.ts`
- `normalize(name)`: lowercase, trim, strip simple plurals, and apply an alias map (`cooked rice→rice`, `scallion↔spring onion`, `aubergine↔eggplant`, `courgette↔zucchini`, `minced beef↔ground beef`…).
- An ingredient the user has matches a recipe ingredient if they're equal after normalizing, or if the user's term is a whole-word part of it ("chicken" matches "chicken breast").
- **Staples** (salt, pepper, oil, water, plus anything the user adds in settings) count as "have" and never as "missing".
- Score = share of the recipe's non-staple ingredients the user has, plus a bonus for each of the user's items used. In **fridge mode**, items that expire sooner add more to the score.
- Results are sorted by score. Each card shows "uses 3 of yours · missing 2" and a filter for "missing at most N".

## Screens
1. **Find** (`/`): a "What's in your fridge?" chip input with autocomplete, a "Use my fridge" toggle that pre-fills from the tracker, and a grid of results. Each card has the photo, name, used/missing counts, a heart, and "+ Plan".
2. **Recipe** (`/recipe/:id`): ingredients ticked off (have) or flagged (missing), the steps, the YouTube link, a favourite button, and "Add to plan" with a day/meal picker.
3. **Fridge** (`/fridge`): items with quantity and use-by date, plus colour badges for expired, today, ≤3 days and fine. You can add, edit, delete and mark items used. "Cook with what's expiring" jumps to Find in fridge mode.
4. **Plan** (`/plan`): a Mon–Sun week with Lunch and Dinner slots. Recipes go in by dragging from a sidebar of favourites and recent results, or by clicking a slot. The **shopping list** is the planned recipes' ingredients, with duplicates merged and anything already in the fridge or on the staples list removed. Each item has a checkbox, and the whole list can be copied to the clipboard.
5. **Favourites** (`/favourites`): a grid of saved recipes.

Design direction (my call): fresh and warm. A cream background, a sage-green accent and a tomato-red highlight for expiring items, rounded cards, a friendly display font for headings and a clean sans-serif for body text. Mobile-first, with a bottom nav on phones and a top nav on desktop. A first-visit empty state offers a "Try sample fridge" button so visitors to the portfolio see results straight away.

## File layout
```
src/
  data/mealdb.ts, fallback-recipes.json, aliases.ts
  lib/matching.ts, shopping.ts, dates.ts      (pure, tested)
  store/useFridge.ts, usePlan.ts, useFavourites.ts, useSettings.ts
  hooks/useRecipes.ts                          (load + cache + fallback)
  components/IngredientInput, RecipeCard, ExpiryBadge, DaySlot, Nav, …
  pages/Find, Recipe, Fridge, Plan, Favourites
  test/ (matching, shopping, dates, store, one page-level flow)
```

## Build order
1. Scaffold Vite/React/TS/Tailwind/Vitest, set up routing and the nav shell.
2. `matching.ts`, `shopping.ts`, `dates.ts` with tests written first.
3. The recipe loader with IndexedDB caching and the fallback, plus the Find page.
4. The Recipe detail page and favourites.
5. The Fridge tracker and fridge mode on Find.
6. The Plan page with drag-and-drop and the shopping list.
7. Visual polish, empty states, the sample fridge, a README with screenshots.

## Left to the builder
Exact copy, the icon set (lucide-react), spacing, and the contents of the alias and fallback recipe lists.

## Verification
- `npm test`: unit tests for normalizing and aliases, scoring, staples, expiry ordering, merging the shopping list and subtracting the fridge, and the persisted stores.
- `npm run build` succeeds with no TypeScript errors.
- Run the dev server through the in-app browser preview (`.claude/launch.json`, port 5173) and walk through it end to end: add "rice, egg, onion" and see ranked recipes; open one and confirm have/missing ticks; favourite it; add fridge items with dates and check the badges and fridge-mode ordering; drag recipes onto the plan and check that the shopping list leaves out fridge items; reload and confirm everything persisted. Check the mobile size too.
- Fallback check: block the themealdb.com requests (or simulate offline) with an empty cache, and confirm the built-in recipes and the banner appear.  
````

---

## Prompt 2 — `2026-11-27 12:29:14 +08:00`

````markdown
# PanSync — design & build plan

## Context
People throw away food because they don't know what to cook with the leftovers in their fridge. PanSync lets them enter what they have and get recipes that use it up, then plan the week and track what's going off. This is a **portfolio project**: it has to look polished, work every time a visitor opens it, and need no sign-up or secret keys. We're starting from nothing, in the folder the app made for this session.

**Goals (the user's picks):** a leftovers → recipes finder, a weekly meal plan with a shopping list, a fridge tracker with use-by dates, and favourites.
**Non-goals:** user accounts, a backend, AI-generated recipes, nutrition data, native mobile apps.
**Anti-goals:** a demo that breaks when an external service is down, and a demo that needs an API key or costs the owner money.

## Approaches considered
- **TheMealDB + built-in backup set: chosen by the user.** About 300 real recipes with photos from a free public database (its free key "1" covers learning and demo use). A small built-in set covers the case where the service is unreachable.
- Built-in collection only: always works, but fewer recipes and no photos.
- AI-generated recipes (Claude API): handles any ingredients, but needs a server and a paid key, and visitors would spend the owner's money.

## Stack (my calls)
- Vite + React + TypeScript, React Router, Tailwind CSS.
- Zustand with `persist` middleware for fridge, plan, favourites and staples (stored in localStorage).
- `idb-keyval` (IndexedDB) to cache the full recipe index, which is roughly 1 MB.
- `@dnd-kit/core` to drag recipes onto days in the plan.
- Vitest + React Testing Library.
- A static build that deploys free to Vercel. Deploying is optional and happens only with the user's go-ahead.

## How the recipe data works
`src/data/mealdb.ts`
- On first visit, fetch every recipe through `search.php?f=a` … `f=z` (26 parallel requests to `https://www.themealdb.com/api/json/v1/1/`), then map each one to a `Recipe`: `{id, name, image, category, area, instructions[], youtube, ingredients: {name, measure}[]}`, flattening `strIngredient1..20` / `strMeasure1..20`.
- Cache the index in IndexedDB with a timestamp and refresh it after 7 days. While the cache is valid, all matching runs locally, so a search makes no network calls and multi-ingredient search is instant.
- Ingredient autocomplete comes from `list.php?i=list`, also cached.
- If the fetch fails and there's no cache, load `src/data/fallback-recipes.json`: about 20 original, leftover-friendly recipes (fried rice, frittata, bubble-and-squeak-style hash, soups, wraps…) that use emoji/gradient cards instead of photos. Show a small "offline recipes" banner.

## Matching (the core logic, fully unit-tested)
`src/lib/matching.ts`
- `normalize(name)`: lowercase, trim, strip simple plurals, and apply an alias map (`cooked rice→rice`, `scallion↔spring onion`, `aubergine↔eggplant`, `courgette↔zucchini`, `minced beef↔ground beef`…).
- An ingredient the user has matches a recipe ingredient if they're equal after normalizing, or if the user's term is a whole-word part of it ("chicken" matches "chicken breast").
- **Staples** (salt, pepper, oil, water, plus anything the user adds in settings) count as "have" and never as "missing".
- Score = share of the recipe's non-staple ingredients the user has, plus a bonus for each of the user's items used. In **fridge mode**, items that expire sooner add more to the score.
- Results are sorted by score. Each card shows "uses 3 of yours · missing 2" and a filter for "missing at most N".

## Screens
1. **Find** (`/`): a "What's in your fridge?" chip input with autocomplete, a "Use my fridge" toggle that pre-fills from the tracker, and a grid of results. Each card has the photo, name, used/missing counts, a heart, and "+ Plan".
2. **Recipe** (`/recipe/:id`): ingredients ticked off (have) or flagged (missing), the steps, the YouTube link, a favourite button, and "Add to plan" with a day/meal picker.
3. **Fridge** (`/fridge`): items with quantity and use-by date, plus colour badges for expired, today, ≤3 days and fine. You can add, edit, delete and mark items used. "Cook with what's expiring" jumps to Find in fridge mode.
4. **Plan** (`/plan`): a Mon–Sun week with Lunch and Dinner slots. Recipes go in by dragging from a sidebar of favourites and recent results, or by clicking a slot. The **shopping list** is the planned recipes' ingredients, with duplicates merged and anything already in the fridge or on the staples list removed. Each item has a checkbox, and the whole list can be copied to the clipboard.
5. **Favourites** (`/favourites`): a grid of saved recipes.

Design direction (my call): fresh and warm. A cream background, a sage-green accent and a tomato-red highlight for expiring items, rounded cards, a friendly display font for headings and a clean sans-serif for body text. Mobile-first, with a bottom nav on phones and a top nav on desktop. A first-visit empty state offers a "Try sample fridge" button so visitors to the portfolio see results straight away.

## File layout
```
src/
  data/mealdb.ts, fallback-recipes.json, aliases.ts
  lib/matching.ts, shopping.ts, dates.ts      (pure, tested)
  store/useFridge.ts, usePlan.ts, useFavourites.ts, useSettings.ts
  hooks/useRecipes.ts                          (load + cache + fallback)
  components/IngredientInput, RecipeCard, ExpiryBadge, DaySlot, Nav, …
  pages/Find, Recipe, Fridge, Plan, Favourites
  test/ (matching, shopping, dates, store, one page-level flow)
```

## Build order
1. Scaffold Vite/React/TS/Tailwind/Vitest, set up routing and the nav shell.
2. `matching.ts`, `shopping.ts`, `dates.ts` with tests written first.
3. The recipe loader with IndexedDB caching and the fallback, plus the Find page.
4. The Recipe detail page and favourites.
5. The Fridge tracker and fridge mode on Find.
6. The Plan page with drag-and-drop and the shopping list.
7. Visual polish, empty states, the sample fridge, a README with screenshots.

## Left to the builder
Exact copy, the icon set (lucide-react), spacing, and the contents of the alias and fallback recipe lists.

## Verification
- `npm test`: unit tests for normalizing and aliases, scoring, staples, expiry ordering, merging the shopping list and subtracting the fridge, and the persisted stores.
- `npm run build` succeeds with no TypeScript errors.
- Run the dev server through the in-app browser preview (`.claude/launch.json`, port 5173) and walk through it end to end: add "rice, egg, onion" and see ranked recipes; open one and confirm have/missing ticks; favourite it; add fridge items with dates and check the badges and fridge-mode ordering; drag recipes onto the plan and check that the shopping list leaves out fridge items; reload and confirm everything persisted. Check the mobile size too.
- Fallback check: block the themealdb.com requests (or simulate offline) with an empty cache, and confirm the built-in recipes and the banner appear.       use the miro link for the ideation as well: https://miro.com/app/board/uXjVEJ7KFnM=/?share_link_id=350646627233
````

---

## Prompt 3 — `2026-11-27 12:44:18 +08:00`

```text
you can stop with miro already and proceed
```

---

## Prompt 4 — `2026-11-27 13:46:24 +08:00`

```text
push to github and create a new repo
```

---

## Prompt 5 — `2026-11-27 13:51:26 +08:00`

```text
how to add collarborators?
```

---

## Prompt 6 — `2026-11-27 13:54:22 +08:00`

```text
it's done
```

---

## Prompt 7 — `2026-11-27 13:55:17 +08:00`

```text
save all the previous instructions into a file named prompts.md and save it in the repo everytime there are new instructions.
```

---

## Prompt 8 — `2026-11-27 14:04:03 +08:00`

```text
1. add a serverless connection that pulls from mealsdb.com using the following guides https://www.themealdb.com/AGENTS.md, https://www.themealdb.com/SKILL.md  and the endpoints at (https://www.themealdb.com/api/spec/openapi-v1.yaml)                                                                                      2. store this in/api at project root level (not the src file)
   
   3. include a /health.ts and /mealsdb.ts within the same subfolder
   
   4. do not hardcode any key, I will input them manually.    5. let me know if you have any questions to clarify.
```

### Prompt 8 Clarifications Confirmed
- **Frontend wiring**: Route frontend (`src/data/mealdb.ts`) through `/api/mealsdb` (keep IndexedDB cache & offline fallback).
- **Environment variable**: `THEMEALDB_API_KEY` (with `.env.example` template; no hardcoded key).
- **Runtime & local dev**: Vercel Functions (`api/health.ts` & `api/mealsdb.ts`) + updated `vercel.json` rewrite + local Vite middleware for dev.

---

## Prompt 9 — `2026-11-26 22:06:44 -08:00`

```text
For Recipe page.

1. Change the multiplier to be for how many pax instead of ingredients.
2. For ingredients. if i choose to undo a checked item marked as "have" i can click the tick again to say that it is missing.
```

---

## Prompt 10 — `2026-11-26 22:12:33 -08:00`

```text
In my meal planner, can we also include some form of calendar? And add some form of date. I at most 1 week expanded at most but still be able to scroll between weeks. and have a overview calendar that shows which days are already planned
```

---

## Prompt 11 — `2026-11-26 22:17:47 -08:00`

```text
Now my planner doesnt have breakfast in there. Lets add breakfast section above lunch.

Also the format of reading mon tue wed in a zig zag form hard to read. can we do it in a more linear form?
```

---

## Prompt 12 — `2026-11-27 14:22:21 +08:00`

```text
could you do a smoke test to check if this api is working normally?
```

---

## Prompt 13 — `2026-11-26 22:13:47 -08:00`

```text
enhance app further using Jakob Nielsen’s 10 usability heuristics
```

---

## Prompt 14 — `2026-11-26 22:22:59 -08:00`

```text
fix any conflicts before i publish to github
```

---

## Prompt 15 — `2026-11-26 22:27:53 -08:00`

```text
it still says the push overwrites previous 5 commits. relook into conflicts as my teammates are working on this concurrently
```

---

## Prompt 16 — `2026-11-26 22:42:10 -08:00`

```text
Instead of staples on the top right, change it to preferences.
```

---

## Prompt 17 — `2026-11-26 22:44:20 -08:00`

```text
1. Under the bubble segment, what's waiting in your fridge, add categories that categorizes meal recipe priorities. Like "high protein, vegetatrian, crustacean, low calorie, no carbs"

2. Change website color scheme to the image attached, which orange as the accents.
```

---

## Prompt 18 — `2026-11-27 14:54:20 +08:00`

```text
with the openfoodfacts api, can you suggest any additional information you can put for each recipes as indicated? I would need this to be applied to all recipes on the website. 
```

*(Attached screenshot of the Find page with areas circled on the right side of each `RecipeCard` header next to the recipe title: Bread omelette, Tortang Talong, Peanut Butter Cookies.)*

---

## Prompt 19 — `2026-11-27 14:58:13 +08:00`

```text
option  1 and option3. Ensure the image is not too cramped. 
```
