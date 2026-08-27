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
    await expect(page.getByLabel("開始")).toHaveValue("09:00");
    await expect(page.getByLabel("完了予定")).toHaveValue("19:00");
    await expect(page.getByLabel("大枠確認")).toBeVisible();
    await expect(page.getByLabel("半分目の進捗確認")).toBeVisible();
    await expect(page.getByLabel("8割確認")).toBeVisible();
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
    const taskTitle = `Sched ${test.info().project.name} ${randomUUID().slice(0, 8)}`;
    await page.goto("/login");
    await page.getByLabel("パスフレーズ").fill("test-passphrase-long");
    await page.getByRole("button", { name: "ロックを解除" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByRole("button", { name: /タスクを追加/ }).first().click();
    await page.getByLabel("タスク名").fill(taskTitle);
    await page.getByLabel("期日").fill("2026-08-20");
    await page.getByLabel("完了予定").fill("15:00");
    await page.getByRole("button", { name: "保存する" }).click();
    await page.getByRole("link", { name: "今日の段取り" }).first().click();
    await expect(page.getByRole("heading", { name: "今日のスケジュール" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "今日の実行順" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "未計画タスク" })).toBeVisible();
    await page.getByRole("button", { name: `${taskTitle}を時間割へ追加` }).click();
    await expect(page.getByRole("heading", { name: "タスクを時間割へ追加" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "予定を編集" })).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "予定を追加しました。" })).toBeVisible();
    const scheduledTask = page.locator(".schedule-block.task").filter({ hasText: taskTitle });
    await expect(scheduledTask).toBeVisible();
    await expect(scheduledTask).toContainText("09:00–10:00");
    await expect(page.getByRole("heading", { name: "予定を編集" })).toHaveCount(0);
    await page.getByRole("link", { name: "TODO ALL" }).first().click();
    await page.getByRole("button", { name: `${taskTitle}の詳細を開く` }).click();
    await expect(page.getByLabel("期日")).toHaveValue("2026-08-20");
    await expect(page.getByLabel("開始")).toHaveValue("09:00");
    await expect(page.getByLabel("完了予定")).toHaveValue("15:00");
    await page.getByRole("button", { name: "キャンセル" }).click();
    await page.getByRole("link", { name: "今日の段取り" }).first().click();
    await expect(page.getByRole("heading", { name: "今日のスケジュール" })).toBeVisible();

    await page.getByRole("button", { name: "＋ 予定を追加" }).first().click();
    await expect(page.getByRole("heading", { name: "自由予定を追加" })).toBeVisible();
    await page.getByLabel("予定名").fill("昼食");
    await page.getByRole("textbox", { name: "開始" }).fill("12:00");
    await page.getByRole("textbox", { name: "終了" }).fill("13:00");
    await page.getByLabel("メモ").fill("外で食べる");
    await page.getByRole("button", { name: "予定を保存" }).click();
    await expect(page.locator(".schedule-block.event").filter({ hasText: "昼食" }).first()).toBeVisible();
    await expect(page.locator(".schedule-block.event").filter({ hasText: "外で食べる" }).first()).toBeVisible();
  });

  test("shows the planning matrix without an execution-order queue", async ({ page }) => {
    const title = `Plan source ${test.info().project.name} ${randomUUID()}`;
    await page.goto("/login");
    await page.getByLabel("パスフレーズ").fill("test-passphrase-long");
    await page.getByRole("button", { name: "ロックを解除" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByRole("button", { name: /タスクを追加/ }).first().click();
    await page.getByLabel("タスク名").fill(title);
    await page.getByLabel("期日").fill("2026-08-15");
    await page.getByRole("button", { name: "保存する" }).click();
    await page.getByRole("link", { name: "今日の段取り" }).first().click();
    await expect(page).toHaveURL(/\/plan$/);
    await expect(page.getByRole("heading", { name: "今日の段取り" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "未計画タスク" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "今日の実行順" })).toHaveCount(0);
    for (const label of ["今すぐやる", "予定する", "手早くやる", "あとで"]) {
      await expect(page.locator(".planning-matrix-panel").getByRole("heading", { name: label })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: `${title}の詳細を開く` })).toBeVisible();
    await page.getByRole("button", { name: "＋ タスクを追加" }).click();
    await expect(page.getByRole("heading", { name: "新しいタスク" })).toBeVisible();
    await expect(page.getByLabel("緊急")).not.toBeChecked();
    await expect(page.getByLabel("重要")).not.toBeChecked();
    await page.getByRole("button", { name: "キャンセル" }).click();
  });

  test("shows tasks on a WBS timeline with review markers", async ({ page }) => {
    const title = `WBS ${test.info().project.name} ${randomUUID().slice(0, 8)}`;
    await page.goto("/login");
    await page.getByLabel("パスフレーズ").fill("test-passphrase-long");
    await page.getByRole("button", { name: "ロックを解除" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByRole("button", { name: /タスクを追加/ }).first().click();
    await page.getByLabel("タスク名").fill(title);
    await page.getByLabel("期日").fill("2026-09-10");
    await page.getByRole("button", { name: "保存する" }).click();
    await page.getByRole("link", { name: "WBS" }).first().click();
    await expect(page).toHaveURL(/\/wbs$/);
    await expect(page.getByRole("heading", { name: "時間軸WBS" })).toBeVisible();
    await expect(page.getByText("P4 あとで")).toBeVisible();
    await expect(page.getByRole("button", { name: title, exact: true })).toBeVisible();
    await expect(page.getByLabel(`${title}の大枠確認`)).toBeVisible();
    await expect(page.getByLabel(`${title}の半分目の進捗確認`)).toBeVisible();
    await expect(page.getByLabel(`${title}の8割確認`)).toBeVisible();
    const handle = page.getByRole("button", { name: `${title}のバーの長さを変える` });
    await handle.scrollIntoViewIfNeeded();
    const box = await handle.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2 + 112, box!.y + box!.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByRole("button", { name: title, exact: true })).toContainText("2026-09-12");
    await page.getByRole("button", { name: `${title}の詳細を開く` }).click();
    await expect(page.getByRole("heading", { name: "タスクを編集" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "期日 必須" })).toHaveValue("2026-09-12");
  });

  test("keeps WBS task names aligned with bars after scrolling", async ({ page }) => {
    const prefix = `WBS align ${test.info().project.name} ${randomUUID().slice(0, 6)}`;
    await page.goto("/login");
    await page.getByLabel("パスフレーズ").fill("test-passphrase-long");
    await page.getByRole("button", { name: "ロックを解除" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    for (let index = 0; index < 12; index += 1) {
      const response = await page.request.post("/api/tasks", {
        data: { title: `${prefix} ${String(index).padStart(2, "0")}`, dueDate: "2026-09-10", isUrgent: false, isImportant: false },
      });
      expect(response.ok(), await response.text()).toBeTruthy();
    }
    await page.goto("/wbs");
    const board = page.getByRole("region", { name: "WBSの時間軸。縦横にスクロールできます" });
    await expect(board).toBeVisible();
    const firstTitle = `${prefix} 00`;
    const laterTitle = `${prefix} 10`;
    async function rowDelta(title: string) {
      return page.evaluate((taskTitle) => {
        const name = document.querySelector(`button.wbs-name[aria-label="${taskTitle}"]`);
        const row = name?.closest(".wbs-row");
        const track = row?.querySelector(".wbs-track");
        if (!name || !row || !track) return 99;
        return Math.abs(name.getBoundingClientRect().top - track.getBoundingClientRect().top);
      }, title);
    }
    expect(await rowDelta(firstTitle)).toBeLessThan(2);
    await board.evaluate((element) => {
      element.scrollTop = 180;
      element.scrollLeft = 120;
    });
    expect(await rowDelta(laterTitle)).toBeLessThan(2);
    expect(await rowDelta(firstTitle)).toBeLessThan(2);
  });

  test("shows mobile planning navigation and fallback controls", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile", "モバイル表示のみ検証する");
    await page.goto("/login");
    await page.getByLabel("パスフレーズ").fill("test-passphrase-long");
    await page.getByRole("button", { name: "ロックを解除" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByRole("link", { name: "今日の段取り" }).last().click();
    await expect(page.getByRole("heading", { name: "今日の段取り" })).toBeVisible();
    await expect(page.locator(".mobile-nav-link")).toHaveCount(7);
    await expect(page.getByText("今日のスケジュールに60分で入ります。", { exact: false })).toBeVisible();
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
