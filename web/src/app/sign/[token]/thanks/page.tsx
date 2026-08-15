import { getPublicContractByToken } from "@/lib/contracts/actions";

export default async function PublicSignThanksPage({
  params,
}: {
  params: { token: string };
}) {
  const loaded = await getPublicContractByToken(params.token);

  if (!loaded.ok) {
    return (
      <main className="min-h-screen bg-neutral-100 px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-neutral-900">Contract unavailable</h1>
        <p className="mt-2 text-neutral-600">{loaded.error}</p>
      </main>
    );
  }

  const signers = (loaded.signers ?? []) as { status?: string }[];
  const allSigned =
    signers.length > 0 && signers.every((s) => s.status === "signed");

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-16 text-neutral-900">
      <div className="mx-auto max-w-lg rounded-lg border border-neutral-200 bg-white px-6 py-10 text-center shadow-sm">
        <div className="text-sm tracking-[0.2em] text-neutral-500">
          TUTTLE LAW FIRM
        </div>
        <h1 className="mt-4 text-2xl font-bold">Thank you</h1>
        <p className="mt-3 text-base text-neutral-700">
          Thank you for submitting your contract. We will be in touch soon.
        </p>
        {allSigned ? (
          <a
            href={`/sign/${params.token}/pdf`}
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-3 text-sm font-bold text-white hover:bg-neutral-800"
          >
            Download your contract (PDF)
          </a>
        ) : (
          <p className="mt-6 text-sm text-neutral-500">
            A PDF copy will be available here after all parties have signed.
          </p>
        )}
      </div>
    </main>
  );
}
