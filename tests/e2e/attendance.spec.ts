import { expect, test } from "@playwright/test";
import { signInHome, signOut } from "./helpers";

test("an employee runs their day from the clock card", async ({ page }) => {
  await signInHome(page, "employee@lnwebworks.test");
  const card = page.getByRole("region", { name: "Attendance clock" });
  await expect(card.getByText("Not checked in", { exact: true })).toBeVisible();

  await card.getByRole("button", { name: "Check in", exact: true }).click();
  await expect(card.getByText("Working", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Take a break" }).click();
  await expect(card.getByText("On a break", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Resume" }).click();
  await expect(card.getByText("Working", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Check out" }).click();
  await expect(card.getByText("Checked out", { exact: true })).toBeVisible();

  await page.goto("/attendance");
  await expect(page.locator(".tl").getByText("Checked in", { exact: true })).toBeVisible();
  await expect(page.locator(".tl").getByText("Break started", { exact: true })).toBeVisible();
});

test("past days in the calendar are links that start a correction", async ({ page }) => {
  await signInHome(page, "employee@lnwebworks.test");
  await page.goto("/attendance");
  const fixLinks = page.getByRole("link", { name: /Ask for a correction/ });
  expect(await fixLinks.count()).toBeGreaterThan(0);
  await fixLinks.first().click();
  await expect(page).toHaveURL(/fix=\d{4}-\d{2}-\d{2}#fix$/);
});

test("a correction goes to the manager, who approves it from the inbox", async ({ page }) => {
  await signInHome(page, "employee@lnwebworks.test");
  await page.goto("/attendance");
  const form = page.locator("#fix");
  await form.getByLabel("What happened?").fill("Forgot to check in after a site visit");
  await form.getByRole("button", { name: "Send for approval" }).click();
  await expect(page.getByText("Correction sent to your manager")).toBeVisible();
  await signOut(page);

  await signInHome(page, "manager@lnwebworks.test");
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Approvals/ }).locator(".count")).toHaveText("2");
  await page.goto("/approvals");
  await page.getByRole("button", { name: "Approve Arjun Mehta's attendance fix" }).click();
  await expect(page.getByText("Approved Arjun Mehta's attendance fix")).toBeVisible();
  await signOut(page);

  await signInHome(page, "employee@lnwebworks.test");
  await page.goto("/attendance");
  await expect(page.locator(".card", { hasText: "Your corrections" }).getByText("Approved", { exact: true })).toBeVisible();
});
