"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import LogoMark from "@/app/_components/logo-mark";

export default function LoginPage() {
  const router = useRouter();
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? "ロックを解除できませんでした。");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("通信に失敗しました。時間を置いて再試行してください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <LogoMark />
        <p className="eyebrow">PERSONAL TASK SYSTEM</p>
        <h1 id="login-title">わたしのタスク管理</h1>
        <p className="login-description">今日やることを、今日の自分にわかる形で。</p>
        <form onSubmit={submit} className="login-form">
          <label htmlFor="passphrase">パスフレーズ</label>
          <input
            id="passphrase"
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            autoComplete="current-password"
            required
            autoFocus
          />
          {error && <p className="field-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={loading || !passphrase}>
            {loading ? "確認中…" : "ロックを解除"}
          </button>
        </form>
        <p className="security-note">このアプリは所有者専用です。パスフレーズは誰にも共有しないでください。</p>
      </section>
    </main>
  );
}
