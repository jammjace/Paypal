import type { Bucket } from "@/domain/models";
import type { bucketProgress } from "@/finance/buckets";
import { money, shortDate } from "@/lib/format";

export function BucketProgress({ bucket, progress }: { bucket: Bucket; progress: ReturnType<typeof bucketProgress> }) {
  if (progress.kind === "SPENDING") return <>
    <p className="bucket-amount">{money(Math.abs(progress.remainingCents))} <span>{progress.remainingCents < 0 ? "over budget" : "left to spend"}</span></p>
    <p className="micro">{money(progress.spentCents)} spent of {money(progress.limitCents)}</p>
    {progress.limitCents !== bucket.targetAmountCents && <p className="micro">This period only; usual limit {money(bucket.targetAmountCents)}.</p>}
    <p className="bucket-status">{bucket.budgetPeriod === "WEEKLY" ? "Weekly" : "Monthly"} spending budget</p>
    <p className="micro">{shortDate(progress.from)}–{shortDate(new Date(new Date(progress.to).getTime() - 1).toISOString())} · UTC</p>
  </>;
  return <>
    <p className="bucket-amount">{money(progress.savedCents)} <span>saved</span></p>
    <p className="micro">{bucket.targetAmountCents ? `${money(bucket.targetAmountCents)} goal · ${money(progress.remainingCents)} to go` : "Open-ended savings"}</p>
    <p className={`bucket-status ${progress.reached ? "positive" : ""}`}>{progress.reached ? "Savings goal reached" : "Savings carry forward"}</p>
    <p className="micro">{money(progress.monthlyContributionCents)} planned per month</p>
  </>;
}
