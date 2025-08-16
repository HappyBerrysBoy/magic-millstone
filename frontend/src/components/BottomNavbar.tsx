"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AccountIcon from "public/svgs/AccountIcon";
import DatabaseIcon from "public/svgs/DatabaseIcon";
import HomeIcon from "public/svgs/HomeIcon";
import TrendingUpIcon from "public/svgs/TrendingUpIcon";

export default function BottomNavbar() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "", icon: <HomeIcon /> },
    { href: "/holdings", label: "", icon: <DatabaseIcon /> },
    { href: "/dashboard", label: "", icon: <TrendingUpIcon /> },
    { href: "/profile", label: "", icon: <AccountIcon /> },
  ];

  return (
    <nav className="fixed right-0 bottom-0 left-0 z-50 mx-auto max-w-sm border-t border-gray-200 bg-black">
      <ul className="flex h-[100px] items-center justify-around">
        {navItems.map(({ href, label, icon }) => {
          const isActive = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center ${
                  isActive
                    ? "text-primary font-semibold"
                    : "hover:text-primary text-gray-500"
                }`}
              >
                {icon} <span className="text-xs">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
