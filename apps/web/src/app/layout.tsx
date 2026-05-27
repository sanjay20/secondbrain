import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SecondBrain",
    template: "%s | SecondBrain",
  },
  description: "Your AI-powered personal life operating system — health, career, wealth, and knowledge in one place.",
  keywords: ["habits", "goals", "career", "productivity", "AI", "personal development"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body>
          {children}
          <Toaster
            position="bottom-right"
            theme="dark"
            toastOptions={{
              style: {
                background: "hsl(222 47% 8%)",
                border: "1px solid hsl(217 32% 17%)",
                color: "hsl(210 40% 96%)",
              },
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
