import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TripSync AI | Fair group travel planning",
  description: "Combine each traveler’s preferences into one transparent, balanced group itinerary.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="antialiased">{children}</body></html>;
}
