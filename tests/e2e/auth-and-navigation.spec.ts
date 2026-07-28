import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

test.describe("authentication boundary", () => {
  test("redirects the root to the login page when unauthenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "わたしのタスク管理" })).toBeVisible();
  });

  test("logs in and completes a task through the main flow", async ({ page }) => {
    const title = `E2E task ${test.info().project.name} ${randomUUID()}`;
    await page.goto("/login");
    await page.getByLabel("パスフレーズ").fill("test-passphrase-long");
    await page.getByRole("button", { name: "ロックを解除" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByRole("button", { name: /タスクを追加/ }).first().click();
    await page.getByLabel("タスク名").fill(title);
    await page.getByLabel("コメント").fill("E2Eで追加した補足");
    await page.getByLabel("期日").fill("2026-07-27");
    await page.getByLabel("緊急").check();
    await page.getByLabel("重要").check();
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByText(title)).toBeVisible();
    await expect(
      page.locator(".task-comment").filter({ hasText: "E2Eで追加した補足" }).first(),
    ).toBeVisible();
    await page.getByRole("link", { name: "今日まで" }).first().click();
    await expect(page.getByText(title)).toBeVisible();
    await page.getByRole("button", { name: `${title}を完了にする` }).click();
    await expect(page.getByRole("status").filter({ hasText: "タスクを完了しました。" })).toBeVisible();
    await expect(page.getByText(title)).toHaveCount(0);
    await page.getByRole("link", { name: "TODO ALL" }).first().click();
    await page.getByLabel("完了済みを表示").check();
    await expect(page.getByText(title)).toBeVisible();
    await page.getByRole("button", { name: /ログアウト/ }).first().click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("opens task details and completes from the edit modal", async ({ page }) => {
    const title = `Modal task ${test.info().project.name} ${randomUUID()}`;
    await page.goto("/login");
    await page.getByLabel("パスフレーズ").fill("test-passphrase-long");
    await page.getByRole("button", { name: "ロックを解除" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByRole("button", { name: /タスクを追加/ }).first().click();
    await page.getByLabel("タスク名").fill(title);
    await page.getByLabel("期日").fill("2026-07-31");
    await page.getByRole("button", { name: "保存する" }).click();

    await page.getByRole("button", { name: `${title}の詳細を開く` }).click();
    await expect(page.getByRole("heading", { name: "タスクを編集" })).toBeVisible();
    await expect(page.getByLabel("タスク名")).toHaveValue(title);
    await page.getByLabel("コメント").fill("ショートカットで保存したコメント");
    await page.getByLabel("コメント").press("ControlOrMeta+Enter");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".task-comment").filter({ hasText: "ショートカットで保存したコメント" })).toBeVisible();
    await page.getByRole("button", { name: `${title}の詳細を開く` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "完了にする", exact: true }).click();
    await expect(page.getByText(title)).toHaveCount(0);
    await page.getByRole("link", { name: "マトリクス" }).first().click();
    await expect(page.getByRole("heading", { name: "優先度マトリクス" })).toBeVisible();
    await page.getByRole("button", { name: "＋ タスクを追加" }).click();
    await expect(page.getByRole("heading", { name: "新しいタスク" })).toBeVisible();
    await page.getByRole("button", { name: "キャンセル" }).click();
  });

  test("collapses and expands the desktop sidebar", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "サイドバーはPC幅のみ表示する");
    await page.goto("/login");
    await page.getByLabel("パスフレーズ").fill("test-passphrase-long");
    await page.getByRole("button", { name: "ロックを解除" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    const sidebar = page.locator(".sidebar");
    const mainContent = page.locator(".main-content");
    await expect(page.getByRole("button", { name: "サイドバーを格納" })).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("button", { name: "サイドバーを格納" }).click();
    await expect(page.getByRole("button", { name: "サイドバーを展開" })).toHaveAttribute("aria-expanded", "false");
    await expect(sidebar).toHaveCSS("width", "76px");
    await expect(mainContent).toHaveCSS("margin-left", "76px");

    await page.reload();
    await expect(page.getByRole("button", { name: "サイドバーを展開" })).toBeVisible();
  });
});
