import { Suspense } from "react";
import MasterdataClient from "./MasterdataClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-600">Lade…</div>}>
      <MasterdataClient />
    </Suspense>
  );
}
