import { Suspense } from "react";
import MasterdataClient from "./MasterdataClient";
import StateNotice from "@/components/StateNotice";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4"><StateNotice variant="loading" message="Lade…" /></div>}>
      <MasterdataClient />
    </Suspense>
  );
}
