import type { Metadata } from "next";
import "./globals.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/app/hooks/QueryClient.hooks";
import BottomNavbar from "@/components/Common/BottomNavbar";
import BottomToast from "@/components/Common/BottomToast";
import { DappPortalProvider } from "@/_providers/DappPortalProvider";
import { Bootstrap } from "@/components/Bootstrap";

export const metadata: Metadata = {
  title: "Magic Millstone",
  description: "Magic Millstone",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <QueryClientProvider client={queryClient}>
          <DappPortalProvider>
            <Bootstrap>
              <div className="relative mx-auto min-h-screen max-w-sm overflow-x-hidden px-[24px] pt-[24px] pb-[100px]">
                {children}
              </div>
              <BottomNavbar />
              <BottomToast />
            </Bootstrap>
          </DappPortalProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
