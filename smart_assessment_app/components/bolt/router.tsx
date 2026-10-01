"use client";

import Link from "next/link";
import { usePathname, useRouter as useNextRouter, useParams as useNextParams } from "next/navigation";
import type { ReactNode } from "react";

export function useNavigate() {
  const router = useNextRouter();
  return (href: string) => router.push(href);
}

export function useLocation() {
  return { pathname: usePathname() };
}

export function useParams<T extends Record<string, string | string[] | undefined> = Record<string, string | string[] | undefined>>() {
  return useNextParams<T>();
}

export function NavLink({
  to,
  end = false,
  onClick,
  className,
  children,
}: {
  to: string;
  end?: boolean;
  onClick?: () => void;
  className?: string | ((state: { isActive: boolean }) => string);
  children: ReactNode | ((state: { isActive: boolean }) => ReactNode);
}) {
  const pathname = usePathname();
  const isActive = end ? pathname === to : pathname.startsWith(to);
  const resolvedClassName = typeof className === "function" ? className({ isActive }) : className;
  const content = typeof children === "function" ? children({ isActive }) : children;

  return <Link href={to} onClick={onClick} className={resolvedClassName}>{content}</Link>;
}

export function Outlet() {
  return null;
}