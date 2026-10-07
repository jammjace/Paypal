"use client";
import { useState, useTransition } from "react";
import { Send, Sparkles } from "lucide-react";
import { askPalAction } from "@/server/actions";

export function AskPal() {
  const [question, setQuestion] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Awaited<ReturnType<typeof askPalAction>> | null>(null);
  const [error, setError] = useState("");
  function ask(value: string) {
    setQuestion(value); setError(""); setResult(null);
    start(async () => {
      try { setResult(await askPalAction(value)); }
      catch { setError("Could not answer. Refresh your session and try again."); }
    });
  }
  return <div className="ask-pal">
    <form className="ask-input" onSubmit={e => { e.preventDefault(); ask(question); }}>
      <Sparkles size={20} /><label className="sr-only" htmlFor="ask-pal">Ask Pal about your money</label>
      <input id="ask-pal" value={question} onChange={e => setQuestion(e.target.value)} required maxLength={500} disabled={pending} placeholder="How much have I saved for Travel?" />
      <button disabled={pending || !question.trim()} aria-label="Send question"><Send size={18} /></button>
    </form>
    <div className="ask-bottom"><div className="prompt-chips">{["Compare this month", "Where did I spend most?", "How much is left in my Coffee budget?", "How much have I saved for Travel?"].map(q => <button key={q} disabled={pending} onClick={() => ask(q)}>{q}</button>)}</div></div>
    <p className="micro">Questions explain your saved money picture. Changes require a separate confirmation.</p>
    <div role="status" aria-live="polite" className="ask-result">
      {pending && <p>Checking your money picture…</p>}{error && <p>{error}</p>}
      {result && <><strong>{result.mode}</strong><p>{result.answer}</p><p className="micro">{result.notice} Snapshot: {result.asOf.slice(0, 10)} (UTC). Based on stored transactions; spending excludes transfers/refunds and includes provisional categories.</p></>}
    </div>
  </div>;
}
