import type { Metadata } from "next";
import Nav from "@/app/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Website Generator",
  description: "Enter business info, get a 5-page website.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
