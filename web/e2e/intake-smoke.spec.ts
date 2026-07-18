import { test, expect, type Page } from "@playwright/test";

const email = process.env.E2E_EMAIL ?? process.env.PLAYWRIGHT_EMAIL;
const password = process.env.E2E_PASSWORD ?? process.env.PLAYWRIGHT_PASSWORD;
const hasCreds = Boolean(email && password);

async function login(page: Page) {
  await page.goto("/login?next=/intake");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/intake/, { timeout: 30_000 });
}

test.describe("Intake workspace smoke", () => {
  test.skip(!hasCreds, "Set E2E_EMAIL and E2E_PASSWORD to run UI smoke");

  test("login → Lead Queue loads with tiles", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: "Lead Queue" })).toBeVisible();
    await expect(page.getByText("Non-engagement letters due")).toBeVisible();
    await expect(page.getByRole("link", { name: /New Lead/i })).toBeVisible();
  });

  test("new lead gate: missing email blocks save; jump-to-field works", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/intake/new");
    await expect(
      page.getByRole("heading", { name: /New Lead/i }),
    ).toBeVisible();

    await page.locator("#f-first").fill("Rosa");
    await page.locator("#f-last").fill("Delgado");
    await page.locator("#f-type").selectOption("auto");
    await page.locator("#f-doi").fill("2025-07-02");
    await page.locator("#f-loc").fill("San Antonio");
    await page.locator("#f-phone").fill("2105550187");
    // leave email empty

    await expect(page.getByText(/outstanding/i)).toBeVisible();
    const saveBtn = page.getByRole("button", { name: "Save lead" });
    await expect(saveBtn).toBeDisabled();

    await page.getByRole("button", { name: "Email" }).click();
    await expect(page.locator("#f-email")).toBeFocused();

    await page.locator("#f-inperson").check();
    await expect(page.getByText(/Gate satisfied/i)).toBeVisible();
    await expect(saveBtn).toBeEnabled();

    await page.getByRole("button", { name: "Save lead" }).click();
    await expect(page).toHaveURL(/\/intake\/leads\//, { timeout: 30_000 });
  });

  test("reject → NEL tile; send NEL; signed convert path", async ({ page }) => {
    await login(page);
    await page.goto("/intake/new");

    const stamp = Date.now().toString().slice(-6);
    await page.locator("#f-first").fill(`Test${stamp}`);
    await page.locator("#f-last").fill("Lead");
    await page.locator("#f-type").selectOption("auto");
    await page.locator("#f-doi").fill("2025-08-01");
    await page.locator("#f-loc").fill("Bexar County");
    await page.locator("#f-phone").fill("2105559999");
    await page.locator("#f-email").fill(`test${stamp}@example.com`);
    await page.getByRole("button", { name: "Save lead" }).click();
    await expect(page).toHaveURL(/\/intake\/leads\//, { timeout: 30_000 });

    await page.getByRole("button", { name: "Reject lead" }).click();
    await expect(page.getByText(/Rejected/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText(/Non-engagement letter not yet sent/i),
    ).toBeVisible();

    await page.getByRole("button", { name: /non-engagement letter sent/i }).click();
    await expect(
      page.getByText(/Non-engagement letter not yet sent/i),
    ).toHaveCount(0, { timeout: 15_000 });

    // Fresh lead for convert path
    await page.goto("/intake/new");
    await page.locator("#f-first").fill(`Signed${stamp}`);
    await page.locator("#f-last").fill("Client");
    await page.locator("#f-type").selectOption("auto");
    await page.locator("#f-doi").fill("2025-08-15");
    await page.locator("#f-loc").fill("San Antonio downtown");
    await page.locator("#f-phone").fill("2105558888");
    await page.locator("#f-email").fill(`signed${stamp}@example.com`);
    await page.getByRole("button", { name: "Save lead" }).click();
    await expect(page).toHaveURL(/\/intake\/leads\//, { timeout: 30_000 });

    await page.getByRole("button", { name: "Mark contract sent" }).click();
    await page.getByRole("button", { name: "Mark contract signed" }).click();
    await expect(page.getByRole("button", { name: "Open matter" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Open matter" }).click();
    await expect(page.getByText(/Matter/i).first()).toBeVisible({
      timeout: 20_000,
    });

    // No year-less dates in visible intake chrome
    const body = await page.locator("main, body").innerText();
    expect(body).not.toMatch(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?!,?\s*\d{4})\b/);
  });

  test("My Activity route loads", async ({ page }) => {
    await login(page);
    await page.goto("/intake/activity");
    await expect(page.getByRole("heading", { name: "My Activity" })).toBeVisible();
  });

  test("RLS check API — intake cannot read medical when intake-only", async ({
    page,
    request,
  }) => {
    await login(page);
    const res = await request.get("/api/intake/rls-check");
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.ok).toBe(true);
    if (json.intake_only) {
      expect(json.medical_select_allowed).toBe(false);
    }
  });
});
