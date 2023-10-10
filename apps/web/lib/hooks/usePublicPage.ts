import { usePathname } from "next/navigation";

export default function usePublicPage() {
  const pathname = usePathname();
  const isPublicPage = [
    "/[user]",
    "/booking",
    "/cancel",
    "/reschedule",
    "/cancellation",
    "/cancellation-all",
  ].find((route) => pathname?.startsWith(route));
  return isPublicPage;
}
