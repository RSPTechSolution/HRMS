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

test("a form keeps what was typed when the server finds a mistake", async ({ page }) => {
  await signInHome(page, "hr@lnwebworks.test");
  await page.goto("/people/new");
  await page.getByLabel("Full name").fill("Keep Me");
  await page.getByLabel("Work email (their login)").fill("keep.me@lnwebworks.test");
  await page.getByLabel("Designation").selectOption({ label: "Software Engineer" });
  await page.getByLabel("Department").selectOption({ label: "Engineering" });
  await page.getByLabel("PAN").fill("not-a-pan");
  await page.getByRole("button", { name: "Add employee and send invite" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "PAN looks like ABCDE1234F." })).toBeVisible();
  await expect(page.getByLabel("Full name")).toHaveValue("Keep Me");
  await expect(page.getByLabel("PAN")).toHaveValue("not-a-pan");
});

test("people can hide their birthday", async ({ page }) => {
  await signInHome(page, "employee@lnwebworks.test");
  await page.goto("/profile");
  await page.getByRole("link", { name: "Edit my details" }).click();
  await page.getByLabel("Show my birthday to colleagues").uncheck();
  await page.getByRole("button", { name: "Save my details" }).click();
  await expect(page.locator(".dl")).toContainText("Birthday visibleNo");
});

test("HR can still find people who have left", async ({ page }) => {
  await signInHome(page, "hr@lnwebworks.test");
  await page.goto("/people?q=mohit");
  await page.getByRole("link", { name: /Mohit Khurana/ }).first().click();
  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByLabel("Status").selectOption("EXITED");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.goto("/people?q=mohit");
  await expect(page.getByText("Nobody matches")).toBeVisible();
  await page.getByRole("link", { name: "Include former employees" }).click();
  await expect(page.getByRole("link", { name: /Mohit Khurana/ })).toBeVisible();
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
