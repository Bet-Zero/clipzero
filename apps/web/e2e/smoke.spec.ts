/**
 * ClipZero smoke suite — covers the highest-risk user flows.
 *
 * Setup assumptions:
 *   - Backend API is running on localhost:4000 (tests 1–4 hit real endpoints)
 *   - Next.js dev server is running on localhost:3000 (started by playwright.config.ts)
 *   - Test 5 is fully self-contained: it mocks the API and needs no backend
 *
 * Run: npx playwright test  (from apps/web/)
 */

import { test, expect } from "@playwright/test";

// ── 1. Game mode loads clips ────────────────────────────────────────────────

test("game mode: page loads, URL canonicalizes, clip browser renders", async ({
  page,
}) => {
  await page.goto("/");

  // Server redirects bare "/" to a canonical URL that always includes season + date
  await expect(page).toHaveURL(/[?&]season=/, { timeout: 10_000 });
  await expect(page).toHaveURL(/[?&]date=/);

  // Core controls render
  await expect(page.getByTestId("mode-game")).toBeVisible();
  await expect(page.getByTestId("mode-player")).toBeVisible();
  await expect(page.getByTestId("game-selector")).toBeVisible();

  // Clips section renders something meaningful — accepts any of the expected states:
  // clip rail (clips loaded), "select a game" prompt, or API-unavailable message.
  // The important thing: no crash, no blank page.
  await expect(
    page
      .getByTestId("clip-rail")
      .or(page.getByText("Select a game to load clips."))
      .or(page.getByText("No clips found"))
      .or(page.getByText("API unavailable", { exact: false })),
  ).toBeVisible({ timeout: 20_000 });
});

// ── 2. Switching games clears actionNumber ──────────────────────────────────

test("game mode: selecting a different game removes actionNumber from URL", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/[?&]season=/, { timeout: 10_000 });

  const selector = page.getByTestId("game-selector");
  await expect(selector).toBeVisible();

  // This test requires at least two selectable games; skip otherwise.
  const isDisabled = await selector.isDisabled();
  const optionCount = await selector.locator("option").count();
  if (isDisabled || optionCount < 2) {
    test.skip();
    return;
  }

  // Inject actionNumber into the URL exactly as clip navigation does (replaceState).
  await page.evaluate(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("actionNumber", "99");
    window.history.replaceState(null, "", url.toString());
  });
  expect(page.url()).toContain("actionNumber=99");

  // Pick whichever option is not currently selected.
  const currentValue = await selector.inputValue();
  const allOptions = await selector.locator("option").all();
  let targetValue: string | null = null;
  for (const opt of allOptions) {
    const val = await opt.getAttribute("value");
    if (val && val !== currentValue) {
      targetValue = val;
      break;
    }
  }
  if (!targetValue) {
    test.skip();
    return;
  }

  await selector.selectOption(targetValue);

  // GameSelector.onChange always deletes actionNumber before pushing the new URL.
  await expect(page).not.toHaveURL(/actionNumber=/, { timeout: 10_000 });
});

// ── 3. Player mode: search, select, URL updated ─────────────────────────────

test("player mode: searching and selecting a player updates the URL", async ({
  page,
}) => {
  await page.goto("/?mode=player&season=2025-26");

  const input = page.getByTestId("player-search-input");
  await expect(input).toBeVisible();

  // Type a query — the component debounces for 250 ms then fires the API call.
  await input.fill("LeBron");

  // First result in the autocomplete dropdown should appear.
  const firstResult = page.getByTestId("player-search-result").first();
  await expect(firstResult).toBeVisible({ timeout: 8_000 });
  await firstResult.click();

  // handlePlayerSelect calls router.push with personId + playerName in the URL.
  await expect(page).toHaveURL(/personId=/, { timeout: 5_000 });
  await expect(page).toHaveURL(/playerName=/);

  // Game log or clips loading state should begin rendering.
  await expect(
    page
      .getByText("Loading game log")
      .or(page.getByText(/Loading clips across/))
      .or(page.getByTestId("clip-rail"))
      .or(page.getByText("No clips found for this player")),
  ).toBeVisible({ timeout: 20_000 });
});

// ── 4. Player mode: exclusions persist in URL ────────────────────────────────

test("player mode: toggling a game chip adds excludeGameIds to the URL", async ({
  page,
}) => {
  // Navigate with a player already encoded in the URL — bypasses the search step.
  // personId 2544 is LeBron James, a stable long-tenured player ID.
  await page.goto(
    "/?mode=player&season=2025-26&personId=2544&playerName=LeBron%20James&teamTricode=LAL",
  );

  // Wait for the game log to load; PlayerGameList renders once games arrive.
  const firstChip = page.getByTestId("game-chip").first();
  await expect(firstChip).toBeVisible({ timeout: 20_000 });

  // Click the first game chip to exclude that game.
  await firstChip.click();

  // PlayerModeBrowser calls router.push with excludeGameIds after each toggle.
  await expect(page).toHaveURL(/excludeGameIds=/, { timeout: 5_000 });
});

// ── 5. API-down state: shows clear error message ────────────────────────────

test("API unavailable: player search shows error message when API is unreachable", async ({
  page,
}) => {
  // Block only the client-side player-search endpoint.
  // Server-side Next.js fetches are unaffected so the page shell still renders.
  await page.route("**/players*", (route) => route.abort());

  await page.goto("/?mode=player&season=2025-26");

  const input = page.getByTestId("player-search-input");
  await expect(input).toBeVisible();

  // Type enough to trigger the search (min 2 chars, debounce 250 ms).
  await input.fill("test");

  // PlayerSearch sets searchError when the fetch throws a TypeError (network abort).
  await expect(
    page.getByText("API unavailable", { exact: false }),
  ).toBeVisible({ timeout: 5_000 });
});
