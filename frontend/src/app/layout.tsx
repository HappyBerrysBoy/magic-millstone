import type { Metadata } from "next";
import "./globals.css";
import { Bootstrap } from "@/components/Bootstrap";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/app/hooks/QueryClient.hooks";
import BottomNavbar from "@/components/BottomNavbar";
import BottomToast from "@/components/Common/BottomToast";

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
          <Bootstrap className="">
            <div className="relative mx-auto min-h-screen max-w-sm overflow-x-hidden  px-[24px] pt-[24px] pb-[100px]">
              {children}
            </div>
            <BottomNavbar />
            <BottomToast />
          </Bootstrap>
        </QueryClientProvider>
      </body>
    </html>
  );
}
