import { ArrowDown, ArrowUp, ChevronDown, Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { DashboardData } from "@/services/dashboard";
import { money, periodLabel } from "@/lib/format";

function percentage(tenths: number | null) {
  return tenths === null ? "No prior baseline" : `${tenths > 0 ? "+" : ""}${(tenths / 10).toFixed(1)}%`;
}

export function SpendingAnalytics({ data }: { data: DashboardData }) {
  const { spending, income, currency } = data;
  const down = spending.differenceCents < 0, unchanged = spending.differenceCents === 0;
  const TrendIcon = unchanged ? Minus : down ? TrendingDown : TrendingUp;
  const changes = spending.categoryChanges.filter(item => item.differenceCents !== 0);
  const merchants = spending.merchants.filter(merchant => merchant.count > 0);
  return <>
    <div className="analytics-grid">
      <section className="card pulse-card" id="pulse" aria-labelledby="pulse-title">
        <div className="section-heading"><h2 id="pulse-title">Spending Pulse</h2><span className="icon-tile mini mint"><TrendIcon size={19} /></span></div>
        <p className="muted">A fair comparison. Same days, each month.</p>
        <div className="pulse-figures">
          <div><span className="micro">{periodLabel(spending.periods.current)}</span><strong>{money(spending.currentCents, currency)}</strong></div>
          <span className="versus">vs.</span>
          <div><span className="micro">{periodLabel(spending.periods.previous)}</span><strong className="muted-number">{money(spending.previousCents, currency)}</strong></div>
        </div>
        <div className="comparison-bars" aria-hidden="true">
          <div style={{ width: `${spending.currentCents / Math.max(spending.currentCents, spending.previousCents, 1) * 100}%` }} />
          <div style={{ width: `${spending.previousCents / Math.max(spending.currentCents, spending.previousCents, 1) * 100}%` }} />
        </div>
        <div className={`trend-result ${down ? "positive" : ""}`}>
          {unchanged ? <Minus size={16} /> : down ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
          <strong>{unchanged ? "No change" : `${money(Math.abs(spending.differenceCents), currency)} ${down ? "less" : "more"}`}</strong>
          <span>{spending.percentChangeTenths === null ? "No prior baseline" : `${percentage(spending.percentChangeTenths)} from last month`}</span>
        </div>
        <p className="micro">Completed outgoing spending, excluding transfers and refunds.</p>
        <details className="analytics-details" open>
          <summary>Changes by category <ChevronDown size={15} aria-hidden="true" /></summary>
          {changes.length === 0 ? <p className="muted">No category changes in these periods.</p> : <ul className="category-changes">
            {changes.map(item => <li key={item.category}>
              <div><strong>{item.category}</strong><span className="micro">{money(item.previousCents, currency)} → {money(item.currentCents, currency)}</span></div>
              <div className="merchant-value"><strong>{item.differenceCents > 0 ? "+" : "−"}{money(Math.abs(item.differenceCents), currency)}</strong><span className="micro">{percentage(item.percentChangeTenths)}</span></div>
            </li>)}
          </ul>}
          <p className="micro">Category changes can also reflect categorization. Unreviewed purchases remain included in total spending.</p>
        </details>
        <details className="analytics-details">
          <summary>Category shares <ChevronDown size={15} aria-hidden="true" /></summary>
          <ul className="category-changes">{spending.categories.map(item => <li key={item.category}><strong>{item.category}</strong><span>{money(item.totalCents, currency)} · {item.shareTenths === null ? "—" : `${item.shareTenths / 10}%`}</span></li>)}</ul>
          {spending.categories.length === 0 && <p className="muted">No spending in this period.</p>}
        </details>
      </section>
      <section className="card merchants-card" aria-labelledby="merchants-title">
        <div className="section-heading"><h2 id="merchants-title">Top merchants</h2><span className="micro">This month to date</span></div>
        <p className="muted">Select a merchant to see the details.</p>
        <div className="merchant-list">{merchants.slice(0, 4).map((merchant, index) => <details className="merchant-detail" key={merchant.name}>
          <summary className="merchant-row" aria-label={`Details for ${merchant.name}`}>
            <span className={`merchant-logo merchant-${index}`} aria-hidden="true">{merchant.name.slice(0, 1)}</span>
            <span><strong>{merchant.name}</strong><span className="micro">{merchant.count} {merchant.count === 1 ? "transaction" : "transactions"} · {merchant.category}</span></span>
            <span className="merchant-value"><strong>{money(merchant.totalCents, currency)}</strong><span className="micro">{(merchant.shareTenths ?? 0) / 10}% of spending</span></span>
            <ChevronDown className="disclosure-chevron" size={14} aria-hidden="true" />
          </summary>
          <div className="merchant-breakdown" role="region" aria-label={`${merchant.name} analytics`}>
            <dl className="merchant-metrics">
              <div><dt>Average transaction</dt><dd>{merchant.averageCents === null ? "—" : money(merchant.averageCents, currency)}</dd></div>
              <div><dt>Previous equivalent days</dt><dd>{money(merchant.previousCents, currency)}</dd></div>
              <div><dt>Change</dt><dd>{percentage(merchant.percentChangeTenths)}</dd></div>
              <div><dt>Share of total spending</dt><dd>{merchant.shareTenths === null ? "—" : `${merchant.shareTenths / 10}%`}</dd></div>
            </dl>
            {merchant.categoryShares.map(part => <p className="merchant-share" key={part.category}>{part.shareOfCategoryTenths === null ? "No spending" : `${part.shareOfCategoryTenths / 10}%`} of {part.category} spending · {money(part.totalCents, currency)}</p>)}
            <p className="micro">{periodLabel(spending.periods.current)} compared with {periodLabel(spending.periods.previous)}.</p>
          </div>
        </details>)}</div>
        {merchants.length === 0 && <p className="muted">No merchant spending in this period.</p>}
        <details className="analytics-details income-details">
          <summary>Income and money received <ChevronDown size={15} aria-hidden="true" /></summary>
          <div role="region" aria-label="Income breakdown">
            <dl className="income-metrics">
              <div><dt>Income</dt><dd>{money(income.incomeCents, currency)}</dd></div>
              <div><dt>Salary</dt><dd>{money(income.salaryCents, currency)}</dd></div>
              <div><dt>Other income</dt><dd>{money(income.otherIncomeCents, currency)}</dd></div>
              <div><dt>Reimbursements</dt><dd>{money(income.reimbursementCents, currency)}</dd></div>
              <div><dt>Internal transfers</dt><dd>{money(income.transferCents, currency)}</dd></div>
              <div><dt>Refunds</dt><dd>{money(income.refundCents, currency)}</dd></div>
              <div><dt>Gifts</dt><dd>{money(income.giftCents, currency)}</dd></div>
              <div><dt>Other received money</dt><dd>{money(income.otherReceivedCents, currency)}</dd></div>
              <div><dt>Awaiting classification</dt><dd>{money(income.unresolvedCents, currency)}</dd></div>
              <div><dt>Total received</dt><dd>{money(income.totalReceivedCents, currency)}</dd></div>
            </dl>
            <p className="micro">Income includes salary and other classified income. Other received money is counted separately; incoming transfers are never assumed to be income.</p>
          </div>
        </details>
      </section>
    </div>
  </>;
}
