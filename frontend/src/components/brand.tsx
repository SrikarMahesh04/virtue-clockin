import Image from "next/image";
import { RouteLink as Link } from "@/components/app-navigation";

export function Brand({ href = "/login" }: { href?: string }) {
  return (
    <Link href={href} className="brand" aria-label="Virtue ClockIn">
      <Image
        src="/branding/virtue-logo.png"
        alt="Virtue Software Solutions"
        width={679}
        height={270}
        preload
      />
      <span className="brand-product">ClockIn</span>
    </Link>
  );
}
