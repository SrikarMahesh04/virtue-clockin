import type { Metadata } from "next";
import { AppNavigation } from "@/components/app-navigation";
import "./globals.css";
export const metadata: Metadata = {
  title: "Virtue ClockIn",
  description: "Your workday, clearly recorded.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppNavigation>{children}</AppNavigation>
      </body>
    </html>
  );
}
