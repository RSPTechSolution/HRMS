import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Password@123";

export async function signIn(page: Page, email: string, path = "/login"): Promise<void> {
  await page.goto(path);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Signs in and waits for the dashboard. */
export async function signInHome(page: Page, email: string): Promise<void> {
  await signIn(page, email);
  await expect(page).toHaveURL(/\/home$/);
}

/** Signs out through the UI, which also ends the session on the server. */
export async function signOut(page: Page): Promise<void> {
  await page.goto("/profile");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
}

/** Submits the login form and waits until React has finished handling the response (and reset the form). */
export async function submitLogin(page: Page): Promise<void> {
  const button = page.getByRole("button", { name: "Sign in" });
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/login")), button.click()]);
  await expect(button).toBeEnabled();
}
