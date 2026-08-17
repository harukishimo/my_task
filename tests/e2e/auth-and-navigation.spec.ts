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
    for (const [priority, urgent, important] of [["P1", true, true], ["P2", false, true], ["P3", true, false], ["P4", false, false]] as const) {
      await page.getByRole("button", { name: `${priority}にタスクを追加` }).click();
      await expect(page.getByRole("heading", { name: "新しいタスク" })).toBeVisible();
      await expect(page.getByLabel("緊急")).toBeChecked({ checked: urgent });
      await expect(page.getByLabel("重要")).toBeChecked({ checked: important });
      await page.getByRole("button", { name: "キャンセル" }).click();
    }
  });

  test("creates a private task and filters it without hiding it from normal views", async ({ page }) => {
    const privateTitle = `Private task ${test.info().project.name} ${randomUUID()}`;
    const normalTitle = `Normal task ${test.info().project.name} ${randomUUID()}`;
    await page.goto("/login");
    await page.getByLabel("パスフレーズ").fill("test-passphrase-long");
    await page.getByRole("button", { name: "ロックを解除" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole("button", { name: /タスクを追加/ }).first().click();
    await page.getByLabel("タスク名").fill(privateTitle);
    await page.getByLabel("カテゴリ").selectOption("private");
    await page.getByLabel("期日").fill("2026-08-20");
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByRole("button", { name: `${privateTitle}の詳細を開く` })).toBeVisible();

    await page.getByRole("button", { name: /タスクを追加/ }).first().click();
    await page.getByLabel("タスク名").fill(normalTitle);
    await page.getByLabel("期日").fill("2026-08-21");
    await page.getByRole("button", { name: "保存する" }).click();
    await page.getByRole("link", { name: "TODO ALL" }).first().click();
    await expect(page).toHaveURL(/\/all$/);
    await expect(page.getByRole("button", { name: `${normalTitle}の詳細を開く` })).toBeVisible();
    await expect(page.getByRole("button", { name: `${privateTitle}の詳細を開く` })).toBeVisible();

    await page.getByRole("link", { name: "プライベート" }).first().click();
    await expect(page).toHaveURL(/\/private$/);
    await expect(page.getByRole("heading", { name: "プライベートタスク" })).toBeVisible();
    await expect(page.getByText(privateTitle)).toBeVisible();
    await expect(page.getByText(normalTitle)).toHaveCount(0);
  });

  test("combines planned tasks with free events in today's schedule", async ({ page }) => {
    const taskTitle = `Scheduled task ${test.info().project.name} ${randomUUID()}`;
    await page.goto("/login");
    await page.getByLabel("パスフレーズ").fill("test-passphrase-long");
    await page.getByRole("button", { name: "ロックを解除" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByRole("button", { name: /タスクを追加/ }).first().click();
    await page.getByLabel("タスク名").fill(taskTitle);
    await page.getByLabel("期日").fill("2026-08-20");
    await page.getByRole("button", { name: "保存する" }).click();
    await page.getByRole("link", { name: "今日の段取り" }).first().click();
    await expect(page.getByRole("heading", { name: "今日のスケジュール" })).toBeVisible();
    await page.getByRole("button", { name: `${taskTitle}を時間割へ追加` }).click();
    await expect(page.getByRole("heading", { name: "タスクを時間割へ追加" })).toBeVisible();
    await page.getByLabel("開始").fill("09:00");
    await page.getByLabel("終了").fill("10:00");
    await page.getByRole("button", { name: "予定を保存" }).click();
    await expect(page.locator(".schedule-block.task").filter({ hasText: "Scheduled task" })).toBeVisible();

    await page.getByRole("button", { name: "＋ 予定を追加" }).first().click();
    await expect(page.getByRole("heading", { name: "自由予定を追加" })).toBeVisible();
    await page.getByLabel("予定名").fill("昼食");
    await page.getByLabel("開始").fill("12:00");
    await page.getByLabel("終了").fill("13:00");
    await page.getByLabel("メモ").fill("外で食べる");
    await page.getByRole("button", { name: "予定を保存" }).click();
    await expect(page.locator(".schedule-block.event").filter({ hasText: "昼食" })).toBeVisible();
    await expect(page.locator(".schedule-block.event").filter({ hasText: "外で食べる" })).toBeVisible();
  });

  test("builds and persists today's execution order", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "ドラッグ操作はPC幅で検証する");
    const firstTitle = `Plan first ${randomUUID()}`;
    const secondTitle = `Plan second ${randomUUID()}`;
    await page.goto("/login");
    await page.getByLabel("パスフレーズ").fill("test-passphrase-long");
    await page.getByRole("button", { name: "ロックを解除" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    for (const title of [firstTitle, secondTitle]) {
      await page.getByRole("button", { name: /タスクを追加/ }).first().click();
      await page.getByLabel("タスク名").fill(title);
      await page.getByLabel("期日").fill("2026-08-15");
      await page.getByRole("button", { name: "保存する" }).click();
      await expect(page.getByRole("button", { name: `${title}の詳細を開く` })).toBeVisible();
    }

    await page.getByRole("link", { name: "今日の段取り" }).first().click();
    await expect(page).toHaveURL(/\/plan$/);
    await expect(page.getByRole("heading", { name: "今日の段取り" })).toBeVisible();
    await page.getByRole("button", { name: "＋ タスクを追加" }).click();
    await expect(page.getByRole("heading", { name: "新しいタスク" })).toBeVisible();
    await expect(page.getByLabel("緊急")).not.toBeChecked();
    await expect(page.getByLabel("重要")).not.toBeChecked();
    await page.getByRole("button", { name: "キャンセル" }).click();
    const planDropzone = page.locator("#today-plan-dropzone");

    for (const title of [firstTitle, secondTitle]) {
      const sourceHandle = page.locator(`[data-plan-task-title="${title}"] .plan-drag-handle`);
      const sourceBox = await sourceHandle.boundingBox();
      const targetBox = await planDropzone.boundingBox();
      if (!sourceBox || !targetBox) throw new Error("段取りドラッグ対象の座標を取得できませんでした。");
      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 16, sourceBox.y + sourceBox.height / 2, { steps: 4 });
      await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + Math.min(targetBox.height / 2, 90), { steps: 16 });
      await page.mouse.up();
      await expect(planDropzone.locator(`[data-plan-task-title="${title}"]`)).toBeVisible();
      await expect(page.getByRole("status").filter({ hasText: "段取り" })).toBeVisible();
    }

    await expect(page.getByRole("button", { name: `${secondTitle}を上へ移動` })).toBeEnabled();
    await page.getByRole("button", { name: `${secondTitle}を上へ移動` }).click();
    await expect(planDropzone.locator(`[data-plan-task-title="${secondTitle}"]`)).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "段取り" })).toBeVisible();
    const plannedTitles = () => planDropzone.locator("[data-plan-task-title]").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-plan-task-title")));
    const orderedTitles = await plannedTitles();
    expect(orderedTitles.indexOf(secondTitle)).toBeGreaterThanOrEqual(0);
    expect(orderedTitles.indexOf(secondTitle)).toBeLessThan(orderedTitles.indexOf(firstTitle));
    await page.reload();
    await expect(page.locator(`[data-plan-task-title="${secondTitle}"]`)).toBeVisible();
    const reloadedTitles = await plannedTitles();
    expect(reloadedTitles.indexOf(secondTitle)).toBeLessThan(reloadedTitles.indexOf(firstTitle));
  });

  test("shows mobile planning navigation and fallback controls", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile", "モバイル表示のみ検証する");
    await page.goto("/login");
    await page.getByLabel("パスフレーズ").fill("test-passphrase-long");
    await page.getByRole("button", { name: "ロックを解除" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByRole("link", { name: "今日の段取り" }).last().click();
    await expect(page.getByRole("heading", { name: "今日の段取り" })).toBeVisible();
    await expect(page.locator(".mobile-nav-link")).toHaveCount(6);
    await expect(page.getByText("スマホでは「時間割へ追加」ボタンも使えます。", { exact: false })).toBeVisible();
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
