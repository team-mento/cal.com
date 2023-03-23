import { useRouter } from "next/router";

export default function usePublicPage() {
  const router = useRouter();
  const isPublicPage = [
    "/[user]",
    "/booking",
    "/cancel",
    "/reschedule",
    "/cancellation",
    "/cancellation-all",
  ].find((route) => router.pathname.startsWith(route));
  return isPublicPage;
}
