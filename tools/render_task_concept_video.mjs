import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const width = 1280;
const height = 900;
const fps = 24;
const duration = 24;
const frameCount = fps * duration;
const outputDir =
  process.argv[2] ?? "/private/tmp/personal-task-concept-frames";

const palette = {
  bg: "#F1F0EA",
  paper: "#FCFDFB",
  ink: "#19322F",
  muted: "#71807A",
  line: "#DCE2DE",
  green: "#0D6B57",
  green2: "#3E8A73",
  greenLight: "#E4F0EB",
  red: "#D75D4C",
  redLight: "#FCE9E5",
  amber: "#C88A27",
  amberLight: "#FFF2D9",
  blue: "#397996",
  blueLight: "#E7F1F5",
  grayLight: "#F1F3F1",
};

const ease = (value) => {
  const x = Math.max(0, Math.min(1, value));
  return 1 - Math.pow(1 - x, 3);
};

const lerp = (a, b, value) => a + (b - a) * value;

const escapeXml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function text(
  value,
  x,
  y,
  size,
  weight = 500,
  color = palette.ink,
  anchor = "start",
  spacing = 0,
) {
  return `<text x="${x}" y="${y}" fill="${color}" font-family="Hiragino Sans, Noto Sans JP, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${spacing}">${escapeXml(value)}</text>`;
}

function multiline(lines, x, y, size, lineHeight, weight, color) {
  return lines
    .map((line, index) =>
      text(line, x, y + lineHeight * index, size, weight, color),
    )
    .join("");
}

function rect(x, y, w, h, radius, fill, stroke = "none", strokeWidth = 0) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
}

function line(x1, y1, x2, y2, color, strokeWidth = 1, dash = "") {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${strokeWidth}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
}

function badge(label, x, y, bg, color, widthOverride) {
  const w = widthOverride ?? Math.max(42, label.length * 9 + 18);
  return `${rect(x, y, w, 24, 12, bg)}${text(label, x + w / 2, y + 16.5, 10, 700, color, "middle", 0.3)}`;
}

function iconCheck(x, y, color, size = 16) {
  return `<path d="M ${x} ${y + size * 0.52} L ${x + size * 0.37} ${y + size * 0.88} L ${x + size} ${y}" fill="none" stroke="${color}" stroke-width="${Math.max(2, size * 0.14)}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function bottomNav(active) {
  const items = [
    ["home", "⌂", "ホーム"],
    ["all", "≡", "ALL"],
    ["due", "!", "今日まで"],
    ["matrix", "⊞", "整理"],
  ];
  const centers = [52, 145, 239, 332];
  return `
    ${rect(0, 724, 384, 66, 0, "#FFFFFF")}
    ${line(0, 724, 384, 724, "#E8ECE9", 1)}
    ${items
      .map(([key, glyph, label], index) => {
        const isActive = key === active;
        return `
          ${isActive ? rect(centers[index] - 24, 733, 48, 27, 14, palette.greenLight) : ""}
          ${text(glyph, centers[index], 753, 20, 700, isActive ? palette.green : "#91A099", "middle")}
          ${text(label, centers[index], 776, 9, 600, isActive ? palette.green : "#91A099", "middle")}
        `;
      })
      .join("")}
  `;
}

function appHeader(titleValue, subtitle = "") {
  return `
    ${rect(16, 61, 32, 32, 10, palette.green)}
    ${text("✓", 32, 84, 19, 800, "#FFFFFF", "middle")}
    ${text(titleValue, 58, 78, 15, 750, palette.ink)}
    ${subtitle ? text(subtitle, 58, 94, 9, 500, palette.muted) : ""}
    ${rect(326, 65, 40, 24, 12, palette.grayLight)}
    ${text("•••", 346, 81, 12, 700, palette.muted, "middle", 1)}
  `;
}

function phoneChrome(content, activeNav = "", contentOpacity = 1) {
  return `
    <defs>
      <clipPath id="phone-screen">
        <rect x="448" y="44" width="384" height="812" rx="48"/>
      </clipPath>
      <filter id="phone-shadow" x="-40%" y="-30%" width="180%" height="200%">
        <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#17342E" flood-opacity=".18"/>
      </filter>
    </defs>
    <ellipse cx="640" cy="858" rx="198" ry="20" fill="#17342E" opacity=".09"/>
    ${rect(436, 31, 408, 838, 62, "#172421")}
    ${rect(442, 37, 396, 826, 56, "#101916", "#33413D", 1)}
    ${rect(448, 44, 384, 812, 49, "#FFFFFF")}
    <g clip-path="url(#phone-screen)">
      ${rect(448, 44, 384, 812, 49, "#FFFFFF")}
      <g transform="translate(448 44)" opacity="${contentOpacity}">
        ${rect(0, 0, 384, 812, 0, "#FFFFFF")}
        ${text("9:41", 23, 27, 11, 750, "#1B2623")}
        ${rect(296, 16, 14, 9, 2, "none", "#1B2623", 1.3)}
        ${rect(314, 16, 14, 9, 2, "none", "#1B2623", 1.3)}
        ${rect(333, 16, 21, 9, 2, "none", "#1B2623", 1.3)}
        ${rect(355, 18.5, 2, 4, 1, "#1B2623")}
        ${rect(336, 18.5, 14, 4, 1, "#1B2623")}
        ${content}
        ${activeNav ? bottomNav(activeNav) : ""}
        ${rect(142, 798, 100, 4, 2, "#172421")}
      </g>
    </g>
    ${rect(587, 48, 106, 27, 14, "#101916")}
    <circle cx="674" cy="61.5" r="3.2" fill="#243B36"/>
  `;
}

function loginScreen(local) {
  const intro = ease(local / 0.55);
  const click = Math.max(0, Math.min(1, (local - 1.55) / 0.35));
  const unlocked = ease(Math.max(0, (local - 1.9) / 0.55));
  const buttonFill = click > 0.1 ? palette.green2 : palette.green;
  return `
    <g opacity="${intro}" transform="translate(0 ${14 * (1 - intro)})">
      ${rect(143, 105, 98, 98, 30, palette.greenLight)}
      ${rect(164, 132, 56, 46, 14, palette.green)}
      ${rect(177, 113, 30, 37, 18, "none", palette.green, 6)}
      ${text("おかえりなさい", 192, 248, 25, 750, palette.ink, "middle")}
      ${text("個人用タスクボード", 192, 274, 12, 500, palette.muted, "middle")}
      ${text("パスフレーズ", 42, 338, 11, 650, palette.ink)}
      ${rect(42, 353, 300, 54, 15, "#FFFFFF", palette.line, 1.5)}
      ${text("••••••••••", 63, 387, 18, 700, palette.ink, "start", 2.5)}
      ${rect(42, 428, 300, 54, 16, buttonFill)}
      ${text(unlocked > 0.5 ? "解除しました" : "ロックを解除", 192, 462, 13, 700, "#FFFFFF", "middle")}
      ${unlocked > 0.5 ? iconCheck(294, 448, "#FFFFFF", 15) : ""}
      ${text("この端末では90日間、入力不要です", 192, 517, 10, 500, palette.muted, "middle")}
      ${badge("PERSONAL", 147, 558, palette.grayLight, palette.muted, 90)}
    </g>
  `;
}

function metricCard(x, y, label, value, tint, color, delay, local) {
  const p = ease((local - delay) / 0.45);
  return `
    <g opacity="${p}" transform="translate(0 ${12 * (1 - p)})">
      ${rect(x, y, 98, 86, 18, tint)}
      ${text(label, x + 14, y + 24, 10, 650, color)}
      ${text(value, x + 14, y + 61, 27, 760, palette.ink)}
      ${text("件", x + 44, y + 60, 10, 650, palette.muted)}
    </g>
  `;
}

function taskRow({
  x = 20,
  y,
  title: titleValue,
  due,
  priority,
  tint,
  color,
  checked = false,
  opacity = 1,
  strike = 0,
}) {
  return `
    <g opacity="${opacity}">
      ${rect(x, y, 344, 66, 15, "#FFFFFF", palette.line, 1)}
      <circle cx="${x + 24}" cy="${y + 25}" r="9" fill="${checked ? palette.green : "#FFFFFF"}" stroke="${checked ? palette.green : "#B8C4BF"}" stroke-width="1.5"/>
      ${checked ? iconCheck(x + 18.5, y + 21, "#FFFFFF", 11) : ""}
      ${text(titleValue, x + 43, y + 26, 12, 650, palette.ink)}
      ${strike > 0 ? line(x + 43, y + 21, x + 43 + strike * 170, y + 21, palette.muted, 1.4) : ""}
      ${text(due, x + 43, y + 48, 9.5, 550, color)}
      ${badge(priority, x + 285, y + 20, tint, color, 42)}
    </g>
  `;
}

function dashboardScreen(local, finalMode = false) {
  const intro = ease(local / 0.55);
  return `
    ${appHeader("ダッシュボード", "7月27日 月曜日")}
    <g opacity="${intro}" transform="translate(0 ${10 * (1 - intro)})">
      ${text(finalMode ? "今日も一歩、進みました" : "おはようございます", 20, 132, 22, 760, palette.ink)}
      ${text(finalMode ? "残りのタスクを無理なく進めましょう。" : "今日やるべきことを、すっきり把握。", 20, 155, 10, 500, palette.muted)}
      ${metricCard(20, 178, "期限切れ", finalMode ? "1" : "2", palette.redLight, palette.red, 0.08, local)}
      ${metricCard(128, 178, "今日", finalMode ? "2" : "3", palette.amberLight, palette.amber, 0.16, local)}
      ${metricCard(236, 178, "P1", finalMode ? "1" : "2", palette.greenLight, palette.green, 0.24, local)}
      ${text("次にやること", 20, 303, 14, 720, palette.ink)}
      ${text("すべて見る", 364, 303, 10, 600, palette.green, "end")}
      ${taskRow({ y: 319, title: finalMode ? "月次レポートを仕上げる" : "請求書を送る", due: finalMode ? "期限：7月28日" : "今日が期限", priority: "P1", tint: palette.redLight, color: palette.red })}
      ${taskRow({ y: 395, title: "歯医者を予約する", due: "1日超過", priority: "P1", tint: palette.redLight, color: palette.red })}
      ${rect(20, 489, 344, 52, 16, palette.green)}
      ${text("＋", 44, 522, 22, 450, "#FFFFFF", "middle")}
      ${text("タスクを追加", 68, 520, 12, 700, "#FFFFFF")}
      ${finalMode ? `${rect(84, 570, 216, 42, 21, palette.greenLight)}${iconCheck(105, 584, palette.green, 13)}${text("1件、完了しました", 202, 596, 11, 700, palette.green, "middle")}` : ""}
    </g>
  `;
}

function addTaskScreen(local) {
  const modal = ease(local / 0.45);
  const clickProgress = Math.max(0, Math.min(1, (local - 2.2) / 0.22));
  const toast = ease(Math.max(0, (local - 2.48) / 0.35));
  return `
    ${dashboardScreen(1)}
    <rect x="0" y="42" width="384" height="682" fill="#0E211D" opacity="${0.26 * modal}"/>
    <g transform="translate(0 ${lerp(265, 0, modal)})">
      ${rect(0, 282, 384, 508, 30, "#FFFFFF")}
      ${rect(164, 295, 56, 5, 3, "#D8DEDA")}
      ${text("新しいタスク", 24, 342, 20, 760, palette.ink)}
      ${text("タスク名", 24, 380, 10, 650, palette.muted)}
      ${rect(24, 393, 336, 50, 14, "#FFFFFF", palette.line, 1.4)}
      ${text("月次レポートを仕上げる", 42, 424, 12, 600, palette.ink)}
      ${text("期日", 24, 474, 10, 650, palette.muted)}
      ${rect(24, 487, 336, 50, 14, "#FFFFFF", palette.line, 1.4)}
      ${text("2026年7月28日", 42, 518, 12, 600, palette.ink)}
      ${text("優先度", 24, 568, 10, 650, palette.muted)}
      ${rect(24, 581, 160, 52, 14, palette.redLight)}
      ${text("緊急", 44, 613, 12, 650, palette.red)}
      ${rect(140, 596, 29, 17, 9, palette.red)}
      ${rect(153, 598, 13, 13, 7, "#FFFFFF")}
      ${rect(200, 581, 160, 52, 14, palette.greenLight)}
      ${text("重要", 220, 613, 12, 650, palette.green)}
      ${rect(316, 596, 29, 17, 9, palette.green)}
      ${rect(329, 598, 13, 13, 7, "#FFFFFF")}
      ${rect(24, 660, 336, 54, 16, clickProgress > 0.1 ? palette.green2 : palette.green)}
      ${text("追加する", 192, 694, 13, 750, "#FFFFFF", "middle")}
    </g>
    ${
      toast > 0
        ? `<g opacity="${toast}" transform="translate(0 ${12 * (1 - toast)})">
            ${rect(76, 230, 232, 44, 22, palette.ink)}
            ${iconCheck(96, 245, "#FFFFFF", 13)}
            ${text("タスクを追加しました", 205, 257, 11, 700, "#FFFFFF", "middle")}
          </g>`
        : ""
    }
  `;
}

function allScreen(local) {
  const intro = ease(local / 0.5);
  const rows = [
    ["歯医者を予約する", "1日超過", "P1", palette.redLight, palette.red],
    ["請求書を送る", "今日が期限", "P1", palette.redLight, palette.red],
    ["月次レポートを仕上げる", "明日が期限", "P1", palette.amberLight, palette.amber],
    ["資料を読み込む", "7月30日", "P2", palette.greenLight, palette.green],
    ["本棚を整理する", "8月2日", "P4", palette.grayLight, palette.muted],
  ];
  return `
    ${appHeader("TODO ALL", "未完了のタスク")}
    <g opacity="${intro}" transform="translate(${12 * (1 - intro)} 0)">
      ${text("すべてのタスク", 20, 136, 22, 760, palette.ink)}
      ${badge("6件", 303, 113, palette.greenLight, palette.green, 55)}
      ${rect(20, 157, 344, 42, 13, palette.grayLight)}
      ${text("期限が近い順", 40, 183, 10, 650, palette.ink)}
      ${text("↕", 338, 183, 15, 650, palette.muted, "middle")}
      ${rows
        .map(([titleValue, due, priority, tint, color], index) =>
          taskRow({
            y: 214 + index * 78,
            title: titleValue,
            due,
            priority,
            tint,
            color,
          }),
        )
        .join("")}
      ${text("完了済みを表示", 192, 625, 10, 650, palette.green, "middle")}
    </g>
  `;
}

function dueScreen(local, completing = false) {
  const intro = ease(local / 0.5);
  const completion = completing
    ? ease(Math.max(0, (local - 1.0) / 0.65))
    : 0;
  const strike = completing
    ? ease(Math.max(0, (local - 0.65) / 0.45))
    : 0;
  return `
    ${appHeader("今日まで", "期限切れ・本日期限")}
    <g opacity="${intro}" transform="translate(${12 * (1 - intro)} 0)">
      ${text("今日までに終える", 20, 136, 22, 760, palette.ink)}
      ${text("期限を過ぎたものから確認します。", 20, 159, 10, 500, palette.muted)}
      ${rect(20, 183, 344, 42, 13, palette.grayLight)}
      ${rect(24, 187, 164, 34, 10, "#FFFFFF")}
      ${text(completing && completion > 0.5 ? "期限切れ  1" : "期限切れ  2", 106, 209, 10, 700, palette.red, "middle")}
      ${text(completing && completion > 0.5 ? "今日  2" : "今日  3", 276, 209, 10, 650, palette.muted, "middle")}
      ${text("期限切れ", 20, 261, 11, 700, palette.red)}
      ${taskRow({ y: 276, title: "歯医者を予約する", due: "1日超過", priority: "P1", tint: palette.redLight, color: palette.red })}
      <g transform="translate(0 ${completion * -16})">
        ${taskRow({
          y: 352,
          title: "請求書を送る",
          due: "今日が期限",
          priority: "P1",
          tint: palette.redLight,
          color: palette.red,
          checked: strike > 0.5,
          opacity: 1 - completion,
          strike: strike,
        })}
      </g>
      <g transform="translate(0 ${completion * -76})">
        ${text("今日", 20, 455, 11, 700, palette.amber)}
        ${taskRow({ y: 470, title: "部屋の植物に水をやる", due: "今日が期限", priority: "P3", tint: palette.amberLight, color: palette.amber })}
      </g>
      ${
        completing && completion > 0.05
          ? `<g opacity="${completion}">
              ${rect(88, 610, 208, 43, 22, palette.greenLight)}
              ${iconCheck(108, 624, palette.green, 13)}
              ${text("完了しました", 198, 637, 11, 700, palette.green, "middle")}
            </g>`
          : ""
      }
    </g>
  `;
}

function quadrant(x, y, w, h, titleValue, subtitle, fill, color) {
  return `
    ${rect(x, y, w, h, 15, fill)}
    ${text(titleValue, x + 12, y + 21, 10.5, 750, color)}
    ${text(subtitle, x + 12, y + 37, 8.5, 550, palette.muted)}
  `;
}

function matrixTask(x, y, titleValue, color = palette.ink, opacity = 1) {
  return `
    <g opacity="${opacity}">
      ${rect(x, y, 148, 40, 11, "#FFFFFF", "#E2E7E4", 1)}
      ${rect(x + 9, y + 10, 5, 20, 3, color)}
      ${text(titleValue, x + 22, y + 25, 9.2, 650, palette.ink)}
    </g>
  `;
}

function matrixScreen(local) {
  const intro = ease(local / 0.5);
  const drag = ease(Math.max(0, (local - 1.25) / 1.35));
  const sourceX = 202;
  const sourceY = 458;
  const targetX = 31;
  const targetY = 283;
  const movingX = lerp(sourceX, targetX, drag);
  const movingY = lerp(sourceY, targetY, drag);
  return `
    ${appHeader("優先度マトリクス", "緊急度 × 重要度")}
    <g opacity="${intro}" transform="translate(0 ${10 * (1 - intro)})">
      ${text("4象限で迷いを減らす", 20, 133, 20, 760, palette.ink)}
      ${text("カードを移動すると優先度が変わります。", 20, 156, 10, 500, palette.muted)}
      ${text("緊急 →", 339, 180, 9, 700, palette.muted, "end")}
      ${text("重要", 11, 332, 9, 700, palette.muted, "middle")}
      ${quadrant(20, 192, 166, 192, "P1  今すぐやる", "緊急・重要", palette.redLight, palette.red)}
      ${quadrant(198, 192, 166, 192, "P3  手早くやる", "緊急", palette.amberLight, palette.amber)}
      ${quadrant(20, 396, 166, 192, "P2  予定する", "重要", palette.greenLight, palette.green)}
      ${quadrant(198, 396, 166, 192, "P4  あとで", "低優先", palette.grayLight, palette.muted)}
      ${matrixTask(29, 240, "請求書を送る", palette.red)}
      ${drag > 0.82 ? matrixTask(29, 288, "本棚を整理", palette.red, ease((drag - 0.82) / 0.18)) : ""}
      ${matrixTask(207, 240, "植物に水をやる", palette.amber)}
      ${matrixTask(29, 444, "資料を読み込む", palette.green)}
      ${drag < 0.98 ? matrixTask(movingX, movingY, "本棚を整理", drag > 0 ? palette.green : palette.muted, 0.92) : ""}
    </g>
  `;
}

function pointer(x, y, click = 0) {
  return `
    ${click > 0 ? `<circle cx="${x + 3}" cy="${y + 3}" r="${12 + click * 17}" fill="none" stroke="${palette.green}" stroke-width="2" opacity="${1 - click}"/>` : ""}
    <g transform="translate(${x} ${y})">
      <path d="M 0 0 L 0 24 L 6.5 18 L 11.5 29 L 16 27 L 11 16 L 20 16 Z" fill="#152722" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
    </g>
  `;
}

function cursorForTime(t) {
  if (t >= 0.8 && t < 2.7) {
    const p = ease((t - 0.8) / 0.9);
    const x = lerp(740, 665, p);
    const y = lerp(470, 502, p);
    const click = Math.max(0, Math.min(1, (t - 1.75) / 0.45));
    return pointer(x, y, click);
  }
  if (t >= 6.1 && t < 8.9) {
    const p = ease((t - 6.1) / 1.45);
    const x = lerp(780, 700, p);
    const y = lerp(705, 738, p);
    const click = Math.max(0, Math.min(1, (t - 7.7) / 0.45));
    return pointer(x, y, click);
  }
  if (t >= 16.0 && t < 18.7) {
    const p = ease((t - 16.0) / 1.35);
    const x = lerp(692, 522, p);
    const y = lerp(546, 371, p);
    const click = Math.max(0, Math.min(1, (t - 17.5) / 0.45));
    return pointer(x, y, click);
  }
  if (t >= 19.4 && t < 21.4) {
    const p = ease((t - 19.4) / 0.65);
    const x = lerp(590, 485, p);
    const y = lerp(550, 423, p);
    const click = Math.max(0, Math.min(1, (t - 20.15) / 0.45));
    return pointer(x, y, click);
  }
  return "";
}

const stages = [
  { start: 0, end: 2.8, flow: 0, nav: "", render: loginScreen },
  { start: 2.8, end: 5.5, flow: 1, nav: "home", render: dashboardScreen },
  { start: 5.5, end: 9.0, flow: 2, nav: "", render: addTaskScreen },
  { start: 9.0, end: 12.0, flow: 3, nav: "all", render: allScreen },
  { start: 12.0, end: 15.0, flow: 3, nav: "due", render: dueScreen },
  { start: 15.0, end: 19.0, flow: 4, nav: "matrix", render: matrixScreen },
  {
    start: 19.0,
    end: 22.0,
    flow: 5,
    nav: "due",
    render: (local) => dueScreen(local, true),
  },
  {
    start: 22.0,
    end: 24.0,
    flow: 5,
    nav: "home",
    render: (local) => dashboardScreen(local, true),
  },
];

function activeStage(t) {
  return stages.find((stage) => t >= stage.start && t < stage.end) ?? stages.at(-1);
}

function flowPanel(activeIndex) {
  const items = [
    "ロックを解除",
    "今日を把握",
    "タスクを追加",
    "期限順に確認",
    "マトリクスで整理",
    "完了して片付ける",
  ];
  return `
    ${text("FLOW", 935, 276, 10, 750, palette.muted, "start", 2.4)}
    ${line(949, 314, 949, 562, "#CBD5D0", 2)}
    ${items
      .map((label, index) => {
        const done = index < activeIndex;
        const active = index === activeIndex;
        const fill = done || active ? palette.green : palette.bg;
        const stroke = done || active ? palette.green : "#BFC9C4";
        const color = done || active ? palette.green : "#9BA7A2";
        return `
          <circle cx="949" cy="${320 + index * 48}" r="${active ? 14 : 12}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
          ${done ? iconCheck(943, 316 + index * 48, "#FFFFFF", 11) : text(String(index + 1).padStart(2, "0"), 949, 324 + index * 48, 8, 750, active ? "#FFFFFF" : color, "middle")}
          ${text(label, 979, 325 + index * 48, 12, active ? 750 : 600, color)}
        `;
      })
      .join("")}
  `;
}

function sceneSvg(t) {
  const stage = activeStage(t);
  const local = t - stage.start;
  const intro = ease(local / 0.35);
  const phoneContent = stage.render(local);
  const fineGrid = Array.from({ length: 18 }, (_, index) => {
    const x = 42 + index * 72;
    return line(x, 0, x, 900, "#DDE1DC", 1);
  }).join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="${palette.bg}"/>
      <g opacity=".22">${fineGrid}</g>
      <circle cx="640" cy="420" r="335" fill="#E6ECE7" opacity=".42"/>
      <circle cx="640" cy="420" r="276" fill="#EDF2ED" opacity=".55"/>
      <g>
        ${text("PRODUCT CONCEPT", 82, 310, 10, 750, palette.green, "start", 2.6)}
        ${multiline(["わたしの", "タスク管理"], 82, 367, 38, 47, 730, palette.ink)}
        ${text("期限と優先度に集中する。", 82, 478, 13, 550, palette.muted)}
        ${line(82, 510, 276, 510, "#C9D1CC", 1)}
        ${badge("GOOGLE SHEETS", 82, 535, palette.paper, palette.green, 124)}
        ${badge("VERCEL", 214, 535, palette.paper, palette.green, 66)}
        ${text("自分だけの、迷わない4画面。", 82, 593, 11, 600, palette.ink)}
      </g>
      <g opacity="${intro}" transform="translate(0 ${8 * (1 - intro)})">
        ${phoneChrome(phoneContent, stage.nav)}
      </g>
      ${flowPanel(stage.flow)}
      ${cursorForTime(t)}
      ${text("CONCEPT MOCK · 2026", 1198, 852, 8, 650, "#9BA7A2", "end", 1.6)}
    </svg>
  `;
}

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

const concurrency = 8;
let nextFrame = 0;

async function worker() {
  while (true) {
    const frameIndex = nextFrame++;
    if (frameIndex >= frameCount) return;
    const t = frameIndex / fps;
    const svg = sceneSvg(t);
    const filename = path.join(
      outputDir,
      `frame-${String(frameIndex + 1).padStart(4, "0")}.png`,
    );
    await sharp(Buffer.from(svg))
      .png({ compressionLevel: 3, adaptiveFiltering: true })
      .toFile(filename);
    if ((frameIndex + 1) % 96 === 0) {
      process.stdout.write(`rendered ${frameIndex + 1}/${frameCount}\n`);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
process.stdout.write(`rendered ${frameCount} frames in ${outputDir}\n`);
