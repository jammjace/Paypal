import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pal · Your money, a little clearer",
  description: "One balance. Clear priorities. A financial co-pilot prototype with virtual money buckets.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
