"use client";
import { useState, useTransition } from "react";
import { Send, Sparkles } from "lucide-react";
import { askPalAction } from "@/server/actions";
import Link from "next/link";
import type { CopilotReply } from "@/services/copilot";

export function AskPal({ initialClarification = null }: { initialClarification?: CopilotReply | null }) {
  const [question, setQuestion] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<CopilotReply | null>(initialClarification);
  const [error, setError] = useState("");
  function ask(value: string, followupId: string | null = null, displayValue = value, analysisId: string | null = null) {
    setQuestion(displayValue); setError(""); setResult(null);
    start(async () => {
      try { setResult(await askPalAction({ question: value, requestId: crypto.randomUUID(), clarificationId: followupId, analysisId })); }
      catch { setError("Could not answer. Refresh your session and try again."); }
    });
  }
  return <div className="ask-pal">
    <form className="ask-input" onSubmit={e => { e.preventDefault(); ask(question, result?.clarificationId ?? null, question, result?.analysisId ?? null); }}>
      <Sparkles size={20} /><label className="sr-only" htmlFor="ask-pal">Ask Pal about your money</label>
      <input id="ask-pal" value={question} onChange={e => setQuestion(e.target.value)} required maxLength={500} disabled={pending} placeholder="How much have I saved for Travel?" />
      <button disabled={pending || !question.trim()} aria-label="Send question"><Send size={18} /></button>
    </form>
    <div className="ask-bottom"><div className="prompt-chips">{["Compare this month", "Where did I spend most?", "How much is left in my Coffee budget?", "How much have I saved for Travel?"].map(q => <button key={q} disabled={pending} onClick={() => ask(q)}>{q}</button>)}</div></div>
    <p className="micro">Questions explain your saved money picture. Changes require a separate confirmation.</p>
    <div role="status" aria-live="polite" className="ask-result">
      {pending && <p>Checking your money picture…</p>}{error && <p>{error}</p>}
      {result && <><strong>{result.mode}{result.status === "CLARIFICATION" ? " · Clarification needed" : result.status === "UNSUPPORTED" ? " · Unsupported request" : result.status === "AI_FAILURE" ? " · Model unavailable or invalid response" : ""}</strong><p>{result.answer}</p>
        {result.choices && <div className="prompt-chips">{result.choices.map(choice => <button key={choice.value} disabled={pending} onClick={() => ask(choice.value, result.clarificationId, choice.label, result.analysisId)}>{choice.label}</button>)}</div>}
        {(result.clarificationId || result.analysisId) && <button className="text-link" onClick={() => ask("cancel", result.clarificationId, "", result.analysisId)}>Start a new question</button>}
        {result.scenarioId && <Link className="text-link" href={`/pal/future#scenario-${result.scenarioId}`}>Review proposed change</Link>}
        {result.proposalId && <Link className="text-link" href={`/pal/actions#proposal-${result.proposalId}`}>Review funding options</Link>}<p className="micro">{result.notice} Snapshot: {result.asOf.slice(0, 10)} (UTC). Based on stored transactions; spending excludes transfers/refunds and includes provisional categories.</p></>}
    </div>
  </div>;
}
