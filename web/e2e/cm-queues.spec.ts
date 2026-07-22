import { test, expect, type Page } from "@playwright/test";

const email = process.env.E2E_EMAIL ?? process.env.PLAYWRIGHT_EMAIL;
const password = process.env.E2E_PASSWORD ?? process.env.PLAYWRIGHT_PASSWORD;
const hasCreds = Boolean(email && password);

async function login(page: Page, next = "/cases") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(new RegExp(next.replace(/\//g, "\\/")), {
    timeout: 30_000,
  });
}

test.describe("CM work queues — New cases + LORs pending", () => {
  test.skip(!hasCreds, "Set E2E_EMAIL and E2E_PASSWORD to run UI smoke");

  test("New cases tab loads; count badge present; deep-link opens checklist", async ({
    page,
  }) => {
    await login(page, "/cases/new-cases");
    await expect(
      page.getByRole("heading", { name: "New cases" }),
    ).toBeVisible();

    const nav = page.getByRole("link", { name: /New cases/i }).first();
    await expect(nav).toBeVisible();

    const rows = page.getByTestId("new-case-row");
    const count = await rows.count();
    if (count === 0) {
      await expect(page.getByText(/No new cases waiting/i)).toBeVisible();
      return;
    }

    await rows.first().click();
    await expect(page).toHaveURL(/\/cases\/[^/]+\?focus=checklist/, {
      timeout: 30_000,
    });
    const card = page.locator("#card-checklist");
    await expect(card).toBeVisible();
    await expect(card).toHaveClass(/ring-2/);
  });

  test("LORs pending tab loads; deep-link opens insurance card", async ({
    page,
  }) => {
    await login(page, "/cases/lors");
    await expect(
      page.getByRole("heading", { name: "LORs pending" }),
    ).toBeVisible();

    const nav = page.getByRole("link", { name: /LORs pending/i }).first();
    await expect(nav).toBeVisible();

    const rows = page.getByTestId("lor-pending-row");
    const count = await rows.count();
    if (count === 0) {
      await expect(page.getByText(/No LOR tasks pending/i)).toBeVisible();
      return;
    }

    await rows.first().click();
    await expect(page).toHaveURL(/\/cases\/[^/]+\?focus=insurance/, {
      timeout: 30_000,
    });
    const card = page.locator("#card-insurance");
    await expect(card).toBeVisible();
    await expect(card).toHaveClass(/ring-2/);
  });
});

test.describe("CM work queues — Liability + PD + Records", () => {
  test.skip(!hasCreds, "Set E2E_EMAIL and E2E_PASSWORD to run UI smoke");

  test("Liability pending deep-links to insurance card", async ({ page }) => {
    await login(page, "/cases/liability");
    await expect(
      page.getByRole("heading", { name: "Liability pending" }),
    ).toBeVisible();

    const rows = page.getByTestId("liability-pending-row");
    if ((await rows.count()) === 0) {
      await expect(page.getByText(/No open liability decisions/i)).toBeVisible();
      return;
    }
    await rows.first().click();
    await expect(page).toHaveURL(/\/cases\/[^/]+\?focus=insurance/);
    await expect(page.locator("#card-insurance")).toHaveClass(/ring-2/);
  });

  test("PD pending deep-links to PD card", async ({ page }) => {
    await login(page, "/cases/pd");
    await expect(
      page.getByRole("heading", { name: "PD pending" }),
    ).toBeVisible();

    const rows = page.getByTestId("pd-pending-row");
    if ((await rows.count()) === 0) {
      await expect(page.getByText(/No open PD claims/i)).toBeVisible();
      return;
    }
    await rows.first().click();
    await expect(page).toHaveURL(/\/cases\/[^/]+\?focus=pd/);
    await expect(page.locator("#card-pd")).toHaveClass(/ring-2/);
  });

  test("Records pending deep-links to records card", async ({ page }) => {
    await login(page, "/cases/records");
    await expect(
      page.getByRole("heading", { name: "Records pending" }),
    ).toBeVisible();

    const rows = page.getByTestId("records-pending-row");
    if ((await rows.count()) === 0) {
      await expect(
        page.getByText(/No outstanding records requests/i),
      ).toBeVisible();
      return;
    }
    await rows.first().click();
    await expect(page).toHaveURL(/\/cases\/[^/]+\?focus=records/);
    await expect(page.locator("#card-records")).toHaveClass(/ring-2/);
  });
});
