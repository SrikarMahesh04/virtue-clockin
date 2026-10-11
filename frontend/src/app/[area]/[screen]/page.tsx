import { notFound } from "next/navigation";
import { Shell } from "@/features/shell";
import { adminPages, employeePages } from "@/services/navigation";
import { Screen } from "@/features/screens";
export default async function Page({
  params,
}: {
  params: Promise<{ area: string; screen: string }>;
}) {
  const { area, screen } = await params;
  if (
    (area !== "admin" && area !== "employee") ||
    !(area === "admin" ? adminPages : employeePages).includes(screen)
  )
    notFound();
  return (
    <Shell area={area} screen={screen}>
      <Screen area={area} screen={screen} />
    </Shell>
  );
}
