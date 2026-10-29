import { expect, test } from "@playwright/test";
import { PEOPLE } from "../../prisma/seed/data";
import { profileFor } from "../../prisma/seed/generate";
import { signInHome } from "./helpers";

const nehaIndex = PEOPLE.findIndex((p) => p.name === "Neha Verma");
const nehaPan = profileFor(PEOPLE[nehaIndex], nehaIndex).pan;

test("HR adds an employee and an invite goes out", async ({ page }) => {
  await signInHome(page, "hr@lnwebworks.test");
  await page.goto("/people/new");
  await page.getByLabel("Full name").fill("Test Person");
  await page.getByLabel("Work email (their login)").fill("test.person@lnwebworks.test");
  await page.getByLabel("Designation").selectOption({ label: "Software Engineer" });
  await page.getByLabel("Department").selectOption({ label: "Engineering" });
  await page.getByRole("button", { name: "Add employee and send invite" }).click();
  await expect(page.getByText("Invite sent to test.person@lnwebworks.test")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName("Test Person");
});

test("colleagues see the public profile only, and sensitive data never reaches the page", async ({ page }) => {
  await signInHome(page, "employee@lnwebworks.test");
  await page.goto("/people?q=neha");
  await page.getByRole("link", { name: /Neha Verma/ }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName("Neha Verma");
  await expect(page.getByRole("link", { name: "Personal", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Bank and IDs", exact: true })).toHaveCount(0);
  expect(await page.content()).not.toContain(nehaPan);
});

test("the sidebar footer stays visible on a laptop screen", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await signInHome(page, "employee@lnwebworks.test");
  await expect(page.locator(".me")).toBeInViewport();
});

test("the org chart starts at the top of the company", async ({ page }) => {
  await signInHome(page, "employee@lnwebworks.test");
  await page.goto("/people/org");
  await expect(page.locator(".org summary").first()).toContainText("Vikas Malhotra");
});
