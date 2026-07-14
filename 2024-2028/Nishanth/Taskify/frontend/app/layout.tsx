import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Taskify - Smart Task Management",
  description: "Your intelligent assistant for managing tasks and schedules with AI-powered features",
  keywords: ["task management", "scheduling", "AI assistant", "productivity"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
