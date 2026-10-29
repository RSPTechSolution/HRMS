import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "Password@123";

async function signIn(page: Page, email: string, path = "/login"): Promise<void> {
  await page.goto(path);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Signs out through the UI, which also ends the session on the server. */
async function signOut(page: Page): Promise<void> {
  await page.goto("/profile");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
}

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login\?next=%2Fprofile$/);
});

test("employee signs in, uses the command menu and signs out", async ({ page }) => {
  await signIn(page, "employee@lnwebworks.test");
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Arjun");
  await expect(page.getByRole("button", { name: /Notifications, 2 unread/ })).toBeVisible();

  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill("profile");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByText("Ananya Sharma")).toBeVisible();

  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/home");
  await expect(page).toHaveURL(/\/login/);
});

test("returns people to the page they asked for, but never off-site", async ({ page }) => {
  await signIn(page, "manager@lnwebworks.test", "/login?next=%2Fprofile");
  await expect(page).toHaveURL(/\/profile$/);
  await signOut(page);
  await signIn(page, "manager@lnwebworks.test", "/login?next=%2F%2Fevil.example");
  await expect(page).toHaveURL(/localhost:3100\/home$/);
});

/** Submits the login form and waits until React has finished handling the response (and reset the form). */
async function submitLogin(page: Page): Promise<void> {
  const button = page.getByRole("button", { name: "Sign in" });
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/login")), button.click()]);
  await expect(button).toBeEnabled();
}

test("wrong passwords show an error and five failures lock the account", async ({ page }) => {
  await page.goto("/login");
  for (let i = 0; i < 5; i++) {
    await page.getByLabel("Work email").fill("payroll@lnwebworks.test");
    await page.getByLabel("Password").fill("not-the-password");
    await submitLogin(page);
    await expect(page.locator(".form-error")).toHaveText("That email and password don't match.");
  }
  // The email stays filled after a failed attempt; only the password is typed again.
  await expect(page.getByLabel("Work email")).toHaveValue("payroll@lnwebworks.test");
  await page.getByLabel("Password").fill(PASSWORD);
  await submitLogin(page);
  await expect(page.locator(".form-error")).toHaveText("Too many attempts. Try again in 15 minutes.");
});

test("only admins can open settings, and changes save", async ({ page }) => {
  await signIn(page, "admin@lnwebworks.test");
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName("Settings");
  await page.getByLabel("Company name", { exact: true }).fill("LN Webworks Pvt Ltd");
  await page.getByRole("button", { name: "Save Company name" }).click();
  await expect(page.getByText("Company name saved")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Company name", { exact: true })).toHaveValue("LN Webworks Pvt Ltd");

  await signOut(page);
  await signIn(page, "employee@lnwebworks.test");
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
  await page.goto("/settings");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});

test("theme choice survives a reload", async ({ page }) => {
  await signIn(page, "hr@lnwebworks.test");
  await page.getByRole("button", { name: "Switch light or dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
