"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SignaturePad } from "@/components/contracts/SignaturePad";
import { firmCountersignContractAction } from "@/lib/contracts/actions";
import { formatDate } from "@/lib/dates";

type Signer = {
  contract_signer_id: string;
  full_name: string;
  status: string;
  signed_at: string | null;
  signature_typed_name: string | null;
  signature_data: string | null;
};

type FirmSig = {
  signature_data: string | null;
  typed_name: string | null;
  signed_at: string | null;
};

export function ContractStaffView({
  leadId,
  packageId,
  bodyHtml,
  status,
  hasPdf,
  signers,
  fees,
  meta,
  firm,
  canFirmSign,
}: {
  leadId: string;
  packageId: string;
  bodyHtml: string;
  status: string;
  hasPdf: boolean;
  signers: Signer[];
  fees: { pre: number; post: number; appeal: number };
  meta: { names: string; location: string; incidentDate: string };
  firm: FirmSig | null;
  canFirmSign: boolean;
}) {
  const router = useRouter();
  const allClientsSigned =
    signers.length > 0 && signers.every((s) => s.status === "signed");
  const firmDone = Boolean(firm?.signed_at && firm.typed_name);
  const [typedName, setTypedName] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [padKey, setPadKey] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const canSubmit =
    canFirmSign &&
    allClientsSigned &&
    !firmDone &&
    !!typedName.trim() &&
    !!signatureData?.startsWith("data:image/");

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link
            href={`/intake/leads/${leadId}`}
            className="text-xs font-semibold text-neutral-600 hover:underline"
          >
            ← Back to lead
          </Link>
          <h1 className="mt-1 text-lg font-bold text-neutral-900">
            Contingent fee contract
          </h1>
          <p className="text-xs capitalize text-neutral-500">
            Status: {status.replaceAll("_", " ")}
            {firmDone ? " · firm countersigned" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-xs font-bold text-white"
          >
            Print
          </button>
          {hasPdf ? (
            <a
              href={`/api/contracts/${packageId}/pdf`}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-900"
            >
              Download PDF
            </a>
          ) : null}
        </div>
      </div>

      <article className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm print:border-0 print:shadow-none">
        <header className="mb-6 border-b border-neutral-200 pb-4">
          <div className="text-sm tracking-[0.2em] text-neutral-500">
            TUTTLE LAW FIRM
          </div>
          <h2 className="mt-1 text-2xl font-bold">Contingent Fee Contract</h2>
          <p className="mt-2 text-sm text-neutral-600">
            <strong>{meta.names}</strong> · <strong>{meta.location}</strong>,
            Texas · DOI <strong>{formatDate(meta.incidentDate)}</strong>
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Fees: <strong>{fees.pre}%</strong> / <strong>{fees.post}%</strong> /{" "}
            <strong>{fees.appeal}%</strong>
          </p>
        </header>

        <div
          className="contract-body text-[13px] leading-relaxed text-neutral-900 [&_.contract-field]:font-bold [&_.contract-title]:mb-2 [&_p]:mb-3"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />

        <section className="mt-8 border-t border-neutral-200 pt-6">
          <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-600">
            Client signatures
          </h3>
          <ul className="mt-4 space-y-6">
            {signers.map((s) => (
              <li key={s.contract_signer_id} className="break-inside-avoid">
                <div className="text-sm font-semibold">{s.full_name}</div>
                {s.signature_data?.startsWith("data:image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.signature_data}
                    alt={`Signature of ${s.full_name}`}
                    className="mt-2 h-16 w-auto max-w-xs border-b border-neutral-300 bg-white object-contain"
                  />
                ) : (
                  <div className="mt-2 h-16 border-b border-neutral-300" />
                )}
                <p className="mt-1 text-xs text-neutral-600">
                  {s.status === "signed"
                    ? `Signed: ${s.signature_typed_name ?? s.full_name}${
                        s.signed_at ? ` · ${formatDate(s.signed_at)}` : ""
                      }`
                    : "Awaiting signature"}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-10 break-inside-avoid border-t border-neutral-200 pt-6">
            <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-600">
              For: Tuttle Law Firm
            </h3>

            {firmDone ? (
              <div className="mt-3">
                {firm?.signature_data?.startsWith("data:image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={firm.signature_data}
                    alt="Firm signature"
                    className="mt-2 h-16 w-auto max-w-xs border-b border-neutral-300 bg-white object-contain"
                  />
                ) : null}
                <p className="mt-1 text-xs text-neutral-600">
                  By: {firm?.typed_name}
                  {firm?.signed_at ? ` · ${formatDate(firm.signed_at)}` : ""}
                </p>
              </div>
            ) : (
              <div className="mt-3 print:hidden">
                {!allClientsSigned ? (
                  <p className="text-sm text-amber-800">
                    Wait until all clients have signed, then countersign here.
                  </p>
                ) : !canFirmSign ? (
                  <p className="text-sm text-neutral-600">
                    Attorney or admin must countersign for the firm.
                  </p>
                ) : (
                  <div className="rounded-lg border border-neutral-300 bg-neutral-50 p-4">
                    <p className="text-sm text-neutral-700">
                      Draw your signature and type your name to sign for Tuttle
                      Law Firm.
                    </p>
                    <div className="mt-3">
                      <SignaturePad
                        key={padKey}
                        disabled={pending}
                        onChange={setSignatureData}
                      />
                    </div>
                    <label className="mt-3 block text-sm">
                      <span className="font-semibold">Type your name</span>
                      <input
                        className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
                        value={typedName}
                        onChange={(e) => setTypedName(e.target.value)}
                        placeholder="e.g. Michael Tuttle"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={pending || !canSubmit}
                      className="mt-3 rounded-lg bg-neutral-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                      onClick={() => {
                        setErr(null);
                        setMsg(null);
                        start(async () => {
                          const res = await firmCountersignContractAction({
                            packageId,
                            typedName,
                            signatureData: signatureData!,
                          });
                          if (!res.ok) setErr(res.error);
                          else {
                            setMsg(res.message ?? "Signed");
                            setTypedName("");
                            setSignatureData(null);
                            setPadKey((k) => k + 1);
                            router.refresh();
                          }
                        });
                      }}
                    >
                      Sign for Tuttle Law Firm
                    </button>
                    {err ? (
                      <p className="mt-2 text-sm font-semibold text-red-700">
                        {err}
                      </p>
                    ) : null}
                    {msg ? (
                      <p className="mt-2 text-sm font-semibold text-green-800">
                        {msg}
                      </p>
                    ) : null}
                  </div>
                )}
                <p className="mt-4 text-sm text-neutral-500 print:block">
                  By: ________________________________
                </p>
              </div>
            )}
          </div>
        </section>
      </article>
    </div>
  );
}
