import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Astrea Timesheet Mobile",
  description: "One-tap attendance & punch-in application",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Timesheet",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 flex flex-col justify-between antialiased">
        {children}
      </body>
    </html>
  );
}
