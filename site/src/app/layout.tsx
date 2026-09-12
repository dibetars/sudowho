import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "sudowho — local-first multi-identity dev toolkit",
  description:
    "Switch git, GitHub, Vercel, and Supabase identities per project. Wake/pause compute, track heartbeats and git activity. Runs entirely on your machine.",
  metadataBase: new URL("https://sudowho.tarsusstudios.com"),
  icons: {
    icon: [{ url: "/sudowho_favicon.png", type: "image/png" }],
    apple: "/sudowho_icon.png",
  },
  openGraph: {
    title: "sudowho — local-first multi-identity dev toolkit",
    description:
      "Switch git, GitHub, Vercel, and Supabase identities per project. Runs entirely on your machine.",
    images: ["/sudowho_icon.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
