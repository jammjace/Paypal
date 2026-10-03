"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="loading-screen"><span className="wordmark">pal<span>✦</span></span><h1>Your money picture is unavailable</h1><p>We couldn’t load account data. No balances have been substituted.</p><button className="primary-button" onClick={reset}>Try again</button></main>;
}
