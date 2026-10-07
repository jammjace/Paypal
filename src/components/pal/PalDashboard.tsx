import { AskPal } from "./AskPal";
import { BucketProgress } from "./BucketProgress";
import Link from "next/link";
import { ActivityFeed } from "./ActivityFeed";
import { resetDemoAction } from "@/server/actions";
import { ArrowUpRight, CalendarDays, Coffee, Gift, House, Info, Layers3, Plane, Plus, Sparkles, Wallet } from "lucide-react";
import type { DashboardData } from "@/services/dashboard";
import type { Bucket } from "@/domain/models";
import { money, shortDate } from "@/lib/format";

import { PalMascot } from "./PalMascot";
import { QuickCheck } from "./QuickCheck";
import { SpendingAnalytics } from "./SpendingAnalytics";

function bucketAppearance(bucket: Bucket) {
  if (bucket.category === "Housing") return { icon: House, color: "blue" };
  if (bucket.category === "Gifts") return { icon: Gift, color: "pink" };
  if (bucket.category === "Travel") return { icon: Plane, color: "lavender" };
  if (bucket.category === "Coffee") return { icon: Coffee, color: "peach" };
  return { icon: Layers3, color: "mint" };
}

export function PalDashboard({ data, preview }: { data: DashboardData; preview: boolean }) {
  const { balance, spending } = data;
  const down = spending.differenceCents < 0;
  const trend = spending.percentChangeTenths === null ? null : (Math.abs(spending.percentChangeTenths) / 10).toFixed(1);

  const milestones = data.buckets.filter(bucket => bucket.type === "GOAL" && bucket.targetDate).sort((a, b) => a.targetDate!.localeCompare(b.targetDate!)).slice(0, 3);
  return <>
    <a className="skip-link" href="#main">Skip to dashboard</a>
    <header className="app-header"><div className="nav-inner">
      <a className="shell-brand" href="/pal" aria-label="Pal dashboard"><span className="brand-monogram">P</span><span>PayPal<span className="concept-label">concept</span></span></a>
      <nav className="main-nav" aria-label="Main navigation"><span className="unavailable-nav" title="Outside this prototype">Home</span><span className="unavailable-nav" title="Outside this prototype">Wallet</span><span className="unavailable-nav" title="Outside this prototype">Payments</span><Link href="/pal/transactions">Transactions</Link><Link href="/pal/future">Future You</Link><Link href="/pal/actions">Review changes</Link><Link href="/pal/activity">Activity</Link><a className="active" href="/pal" aria-current="page">Pal <Sparkles size={14} /></a></nav>
      <div className="profile-avatar" aria-label={`Profile for ${data.user.name}`}>{data.user.name.slice(0, 1)}</div>
    </div></header>
    <main id="main" className="dashboard">
      <div className="page-heading"><div><div className="heading-line"><h1 className="wordmark">pal<span>✦</span></h1><span className="small-label">Your money, a little clearer.</span></div><p className="muted">A little clarity for today. A little room for tomorrow.</p></div><div className="snapshot-label"><span className="demo-tag">{preview ? "Sample data · saved locally" : "Account snapshot"}</span><span className="micro"><CalendarDays size={14} /> As of {shortDate(data.asOf)}, {new Date(data.asOf).getUTCFullYear()} · UTC</span></div></div>

      <section className="balance-grid" aria-label="Your money overview">
        <div className="card balance-card"><span className="metric-label"><Wallet size={18} /> Total balance</span><p className="balance-number">{money(balance.balanceCents, data.currency)}</p><div className="balance-bottom"><span className="account-indicator" />One balance. Many possibilities.</div></div>
        <div className="safe-card"><div className="safe-top"><span className="metric-label">Safe to Spend</span><span title="Total balance minus money earmarked in your buckets"><Info size={18} aria-label="Total balance minus earmarked amounts" /></span></div><p className="balance-number">{money(balance.safeToSpendCents, data.currency)}</p><p>The part you haven’t earmarked.</p><div className="safe-decoration" aria-hidden="true">✦</div></div>
        <div className="card earmarked-card"><span className="metric-label"><Layers3 size={18} /> Earmarked</span><p className="balance-number">{money(balance.earmarkedCents, data.currency)}</p><a className="text-link" href="#buckets">Across {data.buckets.length} buckets <ArrowUpRight size={15} /></a></div>
      </section>

      <section className="pal-insight card" aria-labelledby="insight-title"><div className="insight-intro"><PalMascot /><div><div className="pal-caption"><Sparkles size={14} /> A LITTLE PERSPECTIVE FROM PAL</div><h2 id="insight-title">{trend === null ? "Your money picture starts here." : spending.differenceCents === 0 ? "Your spending is level with last month." : `You’re spending ${trend}% ${down ? "less" : "more"} than last month.`}</h2><p>Comparing the same days in each month. Your buckets keep your plans in view.</p></div></div>
        <AskPal initialClarification={data.pendingClarification} key={JSON.stringify([data.user.id, data.asOf, data.balance, data.buckets, data.spending, data.income, data.reviewTransactions])} />
      </section>

      <QuickCheck transactions={data.reviewTransactions} revision={data.revision} />

      <section className="buckets-section" id="buckets" aria-labelledby="buckets-title"><div className="section-heading"><div><h2 id="buckets-title">Your buckets</h2><p className="muted">Set a spending limit, or save toward a goal.</p></div><Link className="subtle-button" href="/pal/buckets/new"><Plus size={16} /> Create bucket</Link></div>
        <div className="bucket-grid">{data.buckets.map(bucket => {
          const appearance = bucketAppearance(bucket), Icon = appearance.icon;
          return <article className="card bucket-card" key={bucket.id}><div className="bucket-top"><span className={`icon-tile ${appearance.color}`}><Icon size={22} /></span><span className="micro">{bucket.type === "SPENDING" ? "Spending budget" : "Savings goal"}</span></div><h3><Link href={`/pal/buckets/${bucket.id}`}>{bucket.name}</Link></h3><BucketProgress bucket={bucket} progress={data.bucketProgress[bucket.id]} /></article>;
        })}</div>
        <p className="micro">Budgets track completed category spending, including provisional categories. Savings hold money aside. Budget limits do not reserve cash; check Safe to Spend before spending. Unclassified purchases may still need Quick Check.</p>
      </section>

      <SpendingAnalytics data={data} />

      <section className="future-card card" aria-labelledby="future-title"><div className="section-heading"><div><div className="title-with-icon"><Sparkles size={19} /><h2 id="future-title">Future You</h2><span className="soft-tag">A look ahead</span></div><p className="muted">A few dates your future self has in mind.</p></div><Link className="subtle-button" href="/pal/future">View timeline</Link></div><div className="timeline"><div className="timeline-stop today"><span className="timeline-dot" /><span className="micro">{shortDate(data.asOf)}</span><strong>Today</strong><span>{money(balance.safeToSpendCents, data.currency)} Safe to Spend</span></div>{milestones.map(bucket => <div className="timeline-stop" key={bucket.id}><span className="timeline-dot" /><span className="micro">{shortDate(bucket.targetDate!)}</span><strong>{bucket.name}{" goal"}</strong><span>{money(bucket.targetAmountCents, data.currency)} target</span></div>)}</div><p className="preview-note">Goal dates shown here. Open Future You for conditional projections and what-if plans.</p></section>

      <section className="card activity-card" id="activity" aria-labelledby="activity-title"><div className="section-heading"><h2 id="activity-title">Recent Pal activity</h2><Link className="text-link" href="/pal/activity">View all activity</Link></div><ActivityFeed events={data.activity.slice(0, 6)} /></section>
      <details className="reset-demo"><summary>Demo controls</summary><p>Reset the buckets in this session, classifications and activity to the sample starting point.</p><form action={resetDemoAction}><button className="subtle-button">Confirm reset</button></form></details>
      <footer className="page-footer"><span className="footer-pal">pal ✦</span><p>AI interprets. Code calculates. You decide.</p><span>Independent hackathon prototype</span></footer>
    </main>
  </>;
}
