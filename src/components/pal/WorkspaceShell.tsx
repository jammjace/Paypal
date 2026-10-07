import Link from "next/link";
export function WorkspaceShell({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="dashboard workspace-page"><nav className="workspace-nav" aria-label="Pal pages"><Link href="/pal">Pal dashboard</Link><Link href="/pal/transactions">Transactions</Link><Link href="/pal/future">Future You</Link><Link href="/pal/actions">Review changes</Link><Link href="/pal/activity">Pal activity</Link></nav><h1>{title}</h1>{children}</main>;
}
