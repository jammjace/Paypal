import { ArrowUpRight, CalendarDays, Check, Coffee, Gift, House, Info, Layers3, Plane, Plus, Send, Sparkles, Wallet } from "lucide-react";
import type { DashboardData } from "@/services/dashboard";
import type { Bucket } from "@/domain/models";
import { money, shortDate } from "@/lib/format";
import { percentageTenths } from "@/finance/dashboard";
import { PalMascot } from "./PalMascot";
import { QuickCheck } from "./QuickCheck";
import { SpendingAnalytics } from "./SpendingAnalytics";

function bucketAppearance(bucket: Bucket) {
  if (bucket.type === "BILL") return { icon: House, color: "blue" };
  if (bucket.category === "Gifts") return { icon: Gift, color: "pink" };
  if (bucket.category === "Travel") return { icon: Plane, color: "lavender" };
  if (bucket.category === "Coffee") return { icon: Coffee, color: "peach" };
  return { icon: Layers3, color: "mint" };
}

export function PalDashboard({ data, preview }: { data: DashboardData; preview: boolean }) {
  const { balance, spending } = data;
  const down = spending.differenceCents < 0;
  const trend = spending.percentChangeTenths === null ? null : (Math.abs(spending.percentChangeTenths) / 10).toFixed(1);

  const milestones = data.buckets.filter(bucket => bucket.targetDate).sort((a, b) => a.targetDate!.localeCompare(b.targetDate!)).slice(0, 3);
  return <>
    <a className="skip-link" href="#main">Skip to dashboard</a>
    <header className="app-header"><div className="nav-inner">
      <a className="shell-brand" href="/pal" aria-label="Pal dashboard"><span className="brand-monogram">P</span><span>PayPal<span className="concept-label">concept</span></span></a>
      <nav className="main-nav" aria-label="Main navigation"><span className="unavailable-nav" title="Outside this prototype">Home</span><span className="unavailable-nav" title="Outside this prototype">Wallet</span><span className="unavailable-nav" title="Outside this prototype">Payments</span><a href="#activity">Activity</a><a className="active" href="/pal" aria-current="page">Pal <Sparkles size={14} /></a></nav>
      <div className="profile-avatar" aria-label={`Profile for ${data.user.name}`}>{data.user.name.slice(0, 1)}</div>
    </div></header>
    <main id="main" className="dashboard">
      <div className="page-heading"><div><div className="heading-line"><h1 className="wordmark">pal<span>✦</span></h1><span className="small-label">Your money, a little clearer.</span></div><p className="muted">A little clarity for today. A little room for tomorrow.</p></div><div className="snapshot-label"><span className="demo-tag">{preview ? "Sample data · read-only" : "Account snapshot"}</span><span className="micro"><CalendarDays size={14} /> As of {shortDate(data.asOf)}, {new Date(data.asOf).getUTCFullYear()} · UTC</span></div></div>

      <section className="balance-grid" aria-label="Your money overview">
        <div className="card balance-card"><span className="metric-label"><Wallet size={18} /> Total balance</span><p className="balance-number">{money(balance.balanceCents, data.currency)}</p><div className="balance-bottom"><span className="account-indicator" />One balance. Many possibilities.</div></div>
        <div className="safe-card"><div className="safe-top"><span className="metric-label">Safe to Spend</span><span title="Total balance minus money earmarked in your buckets"><Info size={18} aria-label="Total balance minus earmarked amounts" /></span></div><p className="balance-number">{money(balance.safeToSpendCents, data.currency)}</p><p>The part you haven’t earmarked.</p><div className="safe-decoration" aria-hidden="true">✦</div></div>
        <div className="card earmarked-card"><span className="metric-label"><Layers3 size={18} /> Earmarked</span><p className="balance-number">{money(balance.earmarkedCents, data.currency)}</p><a className="text-link" href="#buckets">Across {data.buckets.length} buckets <ArrowUpRight size={15} /></a></div>
      </section>

      <section className="pal-insight card" aria-labelledby="insight-title"><div className="insight-intro"><PalMascot /><div><div className="pal-caption"><Sparkles size={14} /> A LITTLE PERSPECTIVE FROM PAL</div><h2 id="insight-title">{trend === null ? "Your money picture starts here." : spending.differenceCents === 0 ? "Your spending is level with last month." : `You’re spending ${trend}% ${down ? "less" : "more"} than last month.`}</h2><p>Comparing the same days in each month. Your buckets keep your plans in view.</p></div></div>
        <div className="ask-input"><Sparkles size={20} /><label className="sr-only" htmlFor="ask-pal">Ask Pal about your money</label><input id="ask-pal" placeholder="Ask anything about your money…" disabled aria-describedby="ask-note" /><button aria-label="Send question — coming later" disabled><Send size={18} /></button></div>
        <div className="ask-bottom"><div className="prompt-chips"><button disabled>Compare this month</button><button disabled>Where did I spend most?</button><button disabled>Add to Travel</button></div><span id="ask-note" className="micro">Ask Pal is coming next</span></div>
      </section>

      <QuickCheck transactions={data.reviewTransactions} />

      <section className="buckets-section" id="buckets" aria-labelledby="buckets-title"><div className="section-heading"><div><h2 id="buckets-title">Your buckets</h2><p className="muted">Same money. A purpose for every plan.</p></div><button className="subtle-button" disabled title="Bucket editing is coming in a later milestone"><Plus size={16} /> Create bucket</button></div>
        <div className="bucket-grid">{data.buckets.map(bucket => {
          const appearance = bucketAppearance(bucket), Icon = appearance.icon;
          const percent = percentageTenths(bucket.allocatedAmountCents, bucket.targetAmountCents);
          const funded = bucket.allocatedAmountCents >= bucket.targetAmountCents;
          return <article className="card bucket-card" key={bucket.id}><div className="bucket-top"><span className={`icon-tile ${appearance.color}`}><Icon size={22} /></span><span className="micro">{bucket.type === "BILL" ? "Monthly bill" : bucket.type === "SPENDING" ? "Monthly spending" : "Savings goal"}</span></div><h3>{bucket.name}</h3><p className="bucket-amount">{money(bucket.allocatedAmountCents, data.currency)} <span>/ {money(bucket.targetAmountCents, data.currency)}</span></p><div className={`progress-track ${appearance.color}`} role="progressbar" aria-label={`${bucket.name} funding`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, (percent ?? 0) / 10))}><span style={{ width: `${Math.min(100, Math.max(0, (percent ?? 0) / 10))}%` }} /></div><p className={`bucket-status ${funded ? "positive" : ""}`}>{funded ? <><Check size={14} /> Fully funded</> : bucket.type === "SPENDING" ? "Earmarked for this month" : `${percent === null ? "No target" : `${percent / 10}% of your goal`}`}</p></article>;
        })}</div>
      </section>

      <SpendingAnalytics data={data} />

      <section className="future-card card" aria-labelledby="future-title"><div className="section-heading"><div><div className="title-with-icon"><Sparkles size={19} /><h2 id="future-title">Future You</h2><span className="soft-tag">A look ahead</span></div><p className="muted">A few dates your future self has in mind.</p></div><button className="subtle-button" disabled title="Projections will be implemented in milestone 6">View timeline</button></div><div className="timeline"><div className="timeline-stop today"><span className="timeline-dot" /><span className="micro">{shortDate(data.asOf)}</span><strong>Today</strong><span>{money(balance.safeToSpendCents, data.currency)} Safe to Spend</span></div>{milestones.map(bucket => <div className="timeline-stop" key={bucket.id}><span className="timeline-dot" /><span className="micro">{shortDate(bucket.targetDate!)}</span><strong>{bucket.name}{bucket.type === "BILL" ? " due" : " goal"}</strong><span>{money(bucket.targetAmountCents, data.currency)} target</span></div>)}</div><p className="preview-note">Scheduled bucket dates only. Balance projections and what-if scenarios are coming later.</p></section>

      <section className="card activity-card" id="activity" aria-labelledby="activity-title"><div className="section-heading"><h2 id="activity-title">Recent Pal activity</h2><span className="micro">Your plans, taking shape</span></div>{data.activity.length === 0 ? <p className="muted">Your bucket activity will appear here.</p> : data.activity.map(event => <div className="activity-row" key={event.id}><span className="activity-icon"><Plus size={17} /></span><div><strong>{event.reason}</strong><span className="micro">{shortDate(event.createdAt)} · Bucket allocation</span></div><strong className="activity-amount">{event.deltaCents >= 0 ? "+" : "−"}{money(Math.abs(event.deltaCents), data.currency)}</strong></div>)}</section>
      <footer className="page-footer"><span className="footer-pal">pal ✦</span><p>AI interprets. Code calculates. You decide.</p><span>Independent hackathon prototype</span></footer>
    </main>
  </>;
}
