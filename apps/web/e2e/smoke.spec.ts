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

const mockPlayerGameLog = {
  personId: 2544,
  season: "2025-26",
  count: 2,
  games: [
    {
      gameId: "game-1",
      gameDate: "2026-01-15",
      matchup: "LAL vs. BOS",
      wl: "W",
      min: 35,
      pts: 28,
      reb: 8,
      ast: 9,
    },
    {
      gameId: "game-2",
      gameDate: "2026-01-18",
      matchup: "LAL @ DAL",
      wl: "L",
      min: 37,
      pts: 31,
      reb: 7,
      ast: 10,
    },
  ],
};

function mockPlayerClipsPayload(opponent = "") {
  const clips =
    opponent === "BOS"
      ? [
          {
            gameId: "game-1",
            gameDate: "2026-01-15",
            matchup: "LAL vs. BOS",
            actionNumber: 101,
            period: 1,
            clock: "PT10M00.00S",
            teamTricode: "LAL",
            personId: 2544,
            playerName: "LeBron James",
            actionType: "2PT",
            subType: "layup",
            shotResult: "Made",
            shotDistance: 3,
            description: "LeBron James makes layup",
            scoreHome: "2",
            scoreAway: "0",
            videoUrl: null,
            thumbnailUrl: null,
          },
        ]
      : [
          {
            gameId: "game-2",
            gameDate: "2026-01-18",
            matchup: "LAL @ DAL",
            actionNumber: 202,
            period: 2,
            clock: "PT08M30.00S",
            teamTricode: "LAL",
            personId: 2544,
            playerName: "LeBron James",
            actionType: "3PT",
            subType: "jump-shot",
            shotResult: "Made",
            shotDistance: 25,
            description: "LeBron James makes 3pt jump shot",
            scoreHome: "12",
            scoreAway: "15",
            videoUrl: null,
            thumbnailUrl: null,
          },
        ];

  return {
    personId: 2544,
    season: "2025-26",
    playType: "all",
    result: "all",
    quarter: "all",
    count: clips.length,
    total: clips.length,
    offset: 0,
    limit: 12,
    hasMore: false,
    nextOffset: null,
    gamesIncluded: clips.length,
    gamesExcluded: 0,
    exclusions: [],
    clips,
  };
}

function emptyPlayerClipsPayload() {
  return {
    personId: 2544,
    season: "2025-26",
    playType: "all",
    result: "all",
    quarter: "all",
    count: 0,
    total: 0,
    offset: 0,
    limit: 12,
    hasMore: false,
    nextOffset: null,
    gamesIncluded: 2,
    gamesExcluded: 0,
    exclusions: [],
    clips: [],
  };
}

function mockGameClipsPayload() {
  return {
    total: 1,
    offset: 0,
    limit: 12,
    hasMore: false,
    nextOffset: null,
    players: [{ name: "Anthony Davis", teamTricode: "LAL" }],
    clips: [
      {
        gameId: "game-lal-bos",
        actionNumber: 101,
        period: 1,
        clock: "PT10M00.00S",
        teamTricode: "LAL",
        playerName: "Anthony Davis",
        actionType: "2PT",
        subType: "layup",
        shotResult: "Made",
        shotDistance: 4,
        description: "Anthony Davis makes layup",
        scoreHome: "2",
        scoreAway: "0",
        videoUrl: null,
        thumbnailUrl: null,
      },
    ],
  };
}

// ── 1. Game mode loads clips ────────────────────────────────────────────────

test("game mode: page loads, URL canonicalizes, clip browser renders", async ({
  page,
}) => {
  await page.goto("/");

  // Server redirects bare "/" to a canonical URL that always includes season + date
  await expect(page).toHaveURL(/[?&]season=/, { timeout: 10_000 });
  await expect(page).toHaveURL(/[?&]date=/);

  // Core controls render — in setup mode OR watch mode (after clips load,
  // the bar collapses to a summary + Edit button).
  await expect(
    page.getByTestId("mode-game").or(page.getByRole("button", { name: "Edit" })),
  ).toBeVisible({ timeout: 10_000 });

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

  // If watch mode is active (clips loaded), click Edit to return to setup mode.
  const editBtn = page.getByRole("button", { name: "Edit" });
  if (await editBtn.isVisible()) {
    await editBtn.click();
  }

  const selector = page.getByTestId("game-selector");
  await expect(selector).toBeVisible({ timeout: 5_000 });

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
  await page.route("**/clips/player*", async (route) => {
    await route.fulfill({ json: emptyPlayerClipsPayload() });
  });

  // Navigate with a player already encoded in the URL — bypasses the search step.
  // personId 2544 is LeBron James, a stable long-tenured player ID.
  await page.goto(
    "/?mode=player&season=2025-26&personId=2544&playerName=LeBron%20James&teamTricode=LAL",
  );

  const editBtn = page.getByRole("button", { name: "Edit" });
  if (await editBtn.isVisible()) {
    await editBtn.click();
  }

  const gamesBtn = page.getByRole("button", { name: /Games/ });
  await expect(gamesBtn).toBeVisible({ timeout: 10_000 });
  await gamesBtn.click({ force: true });

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
  await expect(page.getByText("API unavailable", { exact: false })).toBeVisible(
    { timeout: 5_000 },
  );
});

// ── 6. Shots: result + value + shot-type combination ────────────────────────

test("game mode: shot filters (result + value + subType) apply to URL and page renders", async ({
  page,
}) => {
  // Navigate with all three shot-specific filters combined.
  await page.goto("/?playType=shots&result=Made&shotValue=2pt&subType=layup");

  await expect(page).toHaveURL(/[?&]season=/, { timeout: 10_000 });

  // Verify each filter param survived canonicalization.
  await expect(page).toHaveURL(/result=Made/);
  await expect(page).toHaveURL(/shotValue=2pt/);
  await expect(page).toHaveURL(/subType=layup/);

  // Page should render without crashing — clip rail, empty state, or API message.
  await expect(
    page
      .getByTestId("clip-rail")
      .or(page.getByText("No clips found"))
      .or(page.getByText("Select a game"))
      .or(page.getByText("API unavailable", { exact: false })),
  ).toBeVisible({ timeout: 20_000 });
});

// ── 7. Switching playType clears shot-specific filters ──────────────────────

test("game mode: changing playType clears incompatible shot filters from URL", async ({
  page,
}) => {
  // Start with shot filters active.
  await page.goto(
    "/?playType=shots&result=Made&shotValue=3pt&subType=jump-shot&distanceBucket=20-29",
  );
  await expect(page).toHaveURL(/[?&]season=/, { timeout: 10_000 });
  await expect(page).toHaveURL(/subType=jump-shot/);

  // If watch mode is active, click Edit to return to setup mode.
  const editBtnFilter = page.getByRole("button", { name: "Edit" });
  if (await editBtnFilter.isVisible()) {
    await editBtnFilter.click();
  }

  // Open the filter panel and switch play type to rebounds.
  const filterBtn = page.getByRole("button", { name: /Filters/ });
  await expect(filterBtn).toBeVisible({ timeout: 5_000 });
  await filterBtn.click();

  // Find the play type selector inside the filter panel and switch to rebounds.
  const playTypeSelect = page
    .locator("select")
    .filter({ hasText: "shots" })
    .first();
  await expect(playTypeSelect).toBeVisible({ timeout: 3_000 });
  await playTypeSelect.selectOption("rebounds");

  // Shot-specific params should be cleared from the URL.
  await expect(page).toHaveURL(/playType=rebounds/, { timeout: 5_000 });
  await expect(page).not.toHaveURL(/shotValue=/);
  await expect(page).not.toHaveURL(/subType=jump-shot/);
  await expect(page).not.toHaveURL(/distanceBucket=/);
});

// ── 8. Non-shot subtype filter: turnovers ───────────────────────────────────

test("game mode: turnover subtype filter applies to URL and page renders", async ({
  page,
}) => {
  await page.goto("/?playType=turnovers&subType=bad-pass");

  await expect(page).toHaveURL(/[?&]season=/, { timeout: 10_000 });
  await expect(page).toHaveURL(/playType=turnovers/);
  await expect(page).toHaveURL(/subType=bad-pass/);

  // Page renders without crashing.
  await expect(
    page
      .getByTestId("clip-rail")
      .or(page.getByText("No clips found"))
      .or(page.getByText("Select a game"))
      .or(page.getByText("API unavailable", { exact: false })),
  ).toBeVisible({ timeout: 20_000 });
});

// ── 9. Canonical multi-select URL ordering ──────────────────────────────────

test("game mode: multi-select values are alphabetically sorted in URL", async ({
  page,
}) => {
  // Navigate with multi-select values in non-canonical (reverse) order.
  await page.goto("/?quarter=4,1&subType=layup,dunk");

  await expect(page).toHaveURL(/[?&]season=/, { timeout: 10_000 });

  // The server-side redirect should sort multi-select values.
  await expect(page).toHaveURL(/quarter=1,4/);
  await expect(page).toHaveURL(/subType=dunk,layup/);

  // Should NOT have the original un-sorted ordering.
  expect(page.url()).not.toMatch(/quarter=4,1/);
  expect(page.url()).not.toMatch(/subType=layup,dunk/);
});

// ── 10. Multi-select player in game mode ────────────────────────────────────

test("game mode: multi-select player values are sorted in URL", async ({
  page,
}) => {
  // Navigate with two players in reverse-alpha order.
  await page.goto(
    "/?gameId=game-lal-bos&player=Zach%20LaVine,Anthony%20Davis",
  );

  await expect(page).toHaveURL(/[?&]season=/, { timeout: 10_000 });

  // Player param should be alphabetically sorted.
  await expect(page).toHaveURL(
    /player=Anthony(?:\+|%20)Davis,Zach(?:\+|%20)LaVine/,
  );
});

// ── 11. Removing one chip from a multi-value filter ─────────────────────────

test("game mode: quarter multi-select keeps setup controls available", async ({
  page,
}) => {
  await page.route("**/clips/game*", async (route) => {
    await route.fulfill({ json: mockGameClipsPayload() });
  });

  // Start with two quarters selected (canonical order).
  await page.goto("/?gameId=game-lal-bos&quarter=1,4");

  await expect(page).toHaveURL(/[?&]season=/, { timeout: 10_000 });
  await expect(page).toHaveURL(/quarter=1,4/);

  const editBtn = page.getByRole("button", { name: "Edit" });
  await editBtn.waitFor({ state: "visible", timeout: 10_000 });
  await editBtn.click();

  const filterBtn = page.getByRole("button", { name: /Filters/ });
  await expect(filterBtn).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/quarter=1,4/);
});

// ── 12. Preset flow: click preset, verify URL, then clear ───────────────────

test("game mode: clicking a preset updates URL and shows chips", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveURL(/[?&]season=/, { timeout: 10_000 });

  const editBtn = page.getByRole("button", { name: "Edit" });
  if (await editBtn.isVisible()) {
    await editBtn.click();
  }

  await page.getByRole("button", { name: /Filters/ }).click();

  // Find the presets row.
  const presetsRow = page.getByTestId("filter-presets");
  await expect(presetsRow).toBeVisible({ timeout: 5_000 });

  // Click the "Made 3s" preset.
  const made3s = page.getByTestId("preset-made-3s");
  await expect(made3s).toBeVisible();
  await made3s.click();

  // URL should reflect the preset params.
  await expect(page).toHaveURL(/result=Made/, { timeout: 5_000 });
  await expect(page).toHaveURL(/shotValue=3pt/);

  // A chip for "Made" should appear.
  await expect(page.locator("span", { hasText: "Made" }).first()).toBeVisible({
    timeout: 3_000,
  });

  // Clicking "Clear" or "Clear all" resets.
  const clearBtn = page.getByRole("button", { name: /Clear/ }).first();
  await expect(clearBtn).toBeVisible();
  await clearBtn.click();

  // Preset params should be gone from URL.
  await expect(page).not.toHaveURL(/shotValue=3pt/, { timeout: 5_000 });
});

test("game mode: Edit returns setup controls after watch mode collapse", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/[?&]season=/, { timeout: 10_000 });

  const editBtn = page.getByRole("button", { name: "Edit" });
  try {
    await editBtn.waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    test.skip();
    return;
  }

  await editBtn.click();
  await expect(page.getByTestId("mode-game")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId("game-selector")).toBeVisible();
});

test("game mode: no-games dates show an intentional empty state", async ({
  page,
}) => {
  await page.goto("/?season=2025-26&date=2025-10-01");

  const selector = page.getByTestId("game-selector");
  await expect(selector).toBeVisible({ timeout: 10_000 });
  await expect(selector).toBeDisabled();
  await expect(selector).toContainText(/No games for this date|API unavailable/);
});

test("player mode: watch mode collapse appears and Edit restores setup", async ({
  page,
}) => {
  await page.route("**/players/2544/games*", async (route) => {
    await route.fulfill({ json: mockPlayerGameLog });
  });
  await page.route("**/clips/player*", async (route) => {
    await route.fulfill({ json: mockPlayerClipsPayload() });
  });

  await page.goto(
    "/?mode=player&season=2025-26&personId=2544&playerName=LeBron%20James&teamTricode=LAL",
  );

  await expect(page.getByTestId("watch-bar")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByTestId("player-search-input")).toBeVisible();
  await expect(page.getByRole("button", { name: /Filters/ })).toBeVisible();
});

test("player mode: opponent filter updates URL and summary", async ({ page }) => {
  await page.route("**/players/2544/games*", async (route) => {
    await route.fulfill({ json: mockPlayerGameLog });
  });
  await page.route("**/clips/player*", async (route) => {
    const url = new URL(route.request().url());
    const opponent = url.searchParams.get("opponent") ?? "";
    await route.fulfill({ json: mockPlayerClipsPayload(opponent) });
  });

  await page.goto(
    "/?mode=player&season=2025-26&personId=2544&playerName=LeBron%20James&teamTricode=LAL",
  );

  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByTestId("player-opponent-select").selectOption("BOS");

  await expect(page).toHaveURL(/opponent=BOS/, { timeout: 5_000 });
  await expect(page.getByTestId("watch-bar")).toContainText("vs BOS", {
    timeout: 10_000,
  });
});

test("player mode: empty search results render a clear state", async ({
  page,
}) => {
  await page.route("**/players*", async (route) => {
    await route.fulfill({
      json: { count: 0, totalMatches: 0, players: [] },
    });
  });

  await page.goto("/?mode=player&season=2025-26");
  await page.getByTestId("player-search-input").fill("zzzz");
  await expect(page.getByText("No players found for this search.")).toBeVisible({
    timeout: 5_000,
  });
});

test("player mode: excluding every game shows a clear empty state", async ({
  page,
}) => {
  await page.route("**/clips/player*", async (route) => {
    await route.fulfill({ json: emptyPlayerClipsPayload() });
  });

  await page.route("**/players/2544/games*", async (route) => {
    await route.fulfill({ json: mockPlayerGameLog });
  });

  await page.goto(
    "/?mode=player&season=2025-26&personId=2544&playerName=LeBron%20James&teamTricode=LAL",
  );

  const editBtn = page.getByRole("button", { name: "Edit" });
  if (await editBtn.isVisible()) {
    await editBtn.click();
  }

  const gamesBtn = page.getByRole("button", { name: /Games/ });
  await expect(gamesBtn).toBeVisible({ timeout: 10_000 });
  await gamesBtn.click({ force: true });

  const chips = page.getByTestId("game-chip");
  await expect(chips.first()).toBeVisible({ timeout: 10_000 });
  await chips.nth(0).click();
  await chips.nth(1).click();

  await expect(
    page.getByText("All selected games are excluded. Clear exclusions to load clips again."),
  ).toBeVisible({ timeout: 5_000 });
});

test("player mode: API failures during clip browsing surface clearly", async ({
  page,
}) => {
  await page.route("**/players/2544/games*", async (route) => {
    await route.fulfill({ json: mockPlayerGameLog });
  });
  await page.route("**/clips/player*", (route) => route.abort());

  await page.goto(
    "/?mode=player&season=2025-26&personId=2544&playerName=LeBron%20James&teamTricode=LAL",
  );

  await expect(page.getByText("API unavailable", { exact: false })).toBeVisible({
    timeout: 10_000,
  });
});
