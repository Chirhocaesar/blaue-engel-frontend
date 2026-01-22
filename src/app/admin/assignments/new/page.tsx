import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";
import AdminAssignmentNewClient from "./AdminAssignmentNewClient";

export const dynamic = "force-dynamic";

type Me = {
  id: string;
  email: string;
  role: "ADMIN" | "EMPLOYEE";
};

export default async function AdminAssignmentNewPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("be_access")?.value;

  if (!token) redirect("/login");

  let me: Me;
  try {
    me = await apiGet<Me>("/users/me", token);
  } catch (e: any) {
    const err = e as ApiError;
    if (err?.status === 401) redirect("/login");
    throw e;
  }

  if (me.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return <AdminAssignmentNewClient />;
}
