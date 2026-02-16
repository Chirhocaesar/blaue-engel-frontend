import CustomerDetailClient from "./CustomerDetailClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { id: string };
};

export default function Page({ params }: PageProps) {
  return <CustomerDetailClient id={params.id} />;
}
