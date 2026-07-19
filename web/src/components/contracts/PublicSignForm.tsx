"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { formatDate } from "@/lib/dates";
import { signContractAsPartyAction } from "@/lib/contracts/actions";
import { SignaturePad } from "@/components/contracts/SignaturePad";

type Signer = {
  contract_signer_id: string;
  full_name: string;
  email: string | null;
  status: string;
  signed_at: string | null;
  signature_typed_name: string | null;
};

export function PublicSignForm({
  token,
  bodyHtml,
  status,
  signers,
  fees,
  meta,
}: {
  token: string;
  bodyHtml: string;
  status: string;
  signers: Signer[];
  fees: { pre: number; post: number; appeal: number };
  meta: { location: string; incidentDate: string; names: string };
}) {
  const router = useRouter();
  const pendingSigners = signers.filter((s) => s.status !== "signed");
  const [signerId, setSignerId] = useState(pendingSigners[0]?.contract_signer_id ?? "");
  const [typedName, setTypedName] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [padKey, setPadKey] = useState(0);
  const [agree, setAgree] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // After refresh, selected id may still be someone who already signed (dropdown
  // shows the first pending name, but React keeps the stale value).
  useEffect(() => {
    if (pendingSigners.length === 0) {
      setSignerId("");
      return;
    }
    if (!pendingSigners.some((s) => s.contract_signer_id === signerId)) {
      setSignerId(pendingSigners[0].contract_signer_id);
    }
  }, [pendingSigners, signerId]);

  const activeSignerId =
    pendingSigners.find((s) => s.contract_signer_id === signerId)
      ?.contract_signer_id ??
    pendingSigners[0]?.contract_signer_id ??
    "";

  const done = status === "executed" || pendingSigners.length === 0;
  const canSubmit =
    agree &&
    !!typedName.trim() &&
    !!activeSignerId &&
    !!signatureData &&
    signatureData.startsWith("data:image/");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 border-b border-neutral-300 pb-4">
        <div className="text-sm tracking-[0.2em] text-neutral-500">
          TUTTLE LAW FIRM
        </div>
        <h1 className="mt-1 text-2xl font-bold">Contingent Fee Contract</h1>
        <p className="mt-2 text-sm text-neutral-600">
          <strong>{meta.names}</strong> · <strong>{meta.location}</strong>, Texas ·
          DOI <strong>{formatDate(meta.incidentDate)}</strong>
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Fees in this agreement: <strong>{fees.pre}%</strong> /{" "}
          <strong>{fees.post}%</strong> / <strong>{fees.appeal}%</strong> (pre-suit /
          lawsuit / appeal).
        </p>
      </header>

      <article
        className="contract-body mb-8 rounded-lg border border-neutral-200 bg-white p-5 text-[13px] leading-relaxed text-neutral-900 shadow-sm [&_.contract-field]:font-bold [&_.contract-title]:mb-2 [&_p]:mb-3"
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />

      <section className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-600">
          Parties
        </h2>
        <ul className="mt-2 space-y-1 text-sm">
          {signers.map((s) => (
            <li key={s.contract_signer_id}>
              {s.status === "signed" ? "✔" : "○"}{" "}
              <strong>{s.full_name}</strong>
              {s.status === "signed"
                ? ` — signed ${s.signed_at ? formatDate(s.signed_at) : ""}`
                : " — awaiting signature"}
            </li>
          ))}
        </ul>
      </section>

      {done ? (
        <div className="rounded-lg border border-green-700/30 bg-green-50 px-4 py-3 text-sm font-semibold text-green-900">
          All required parties have signed. The executed contract has been filed with
          the firm.
        </div>
      ) : (
        <section className="rounded-lg border border-neutral-300 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Sign this agreement</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Select your name, draw your signature, type your legal name, and confirm.
          </p>

          <label className="mt-4 block text-sm">
            <span className="font-semibold">I am signing as</span>
            <select
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
              value={activeSignerId}
              onChange={(e) => setSignerId(e.target.value)}
            >
              {pendingSigners.map((s) => (
                <option key={s.contract_signer_id} value={s.contract_signer_id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4">
            <div className="mb-1 text-sm font-semibold">Draw your signature</div>
            <SignaturePad
              key={padKey}
              disabled={pending}
              onChange={setSignatureData}
            />
          </div>

          <label className="mt-4 block text-sm">
            <span className="font-semibold">Type your full legal name</span>
            <input
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="e.g. Joe Blow"
            />
          </label>

          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
            />
            <span>
              I have read this Contingent Fee Contract and agree to its terms. I
              intend my drawn signature and typed name to be my electronic
              signature.
            </span>
          </label>

          <button
            type="button"
            disabled={pending || !canSubmit}
            onClick={() => {
              setErr(null);
              setMsg(null);
              start(async () => {
                const res = await signContractAsPartyAction({
                  token,
                  signerId: activeSignerId,
                  typedName,
                  signatureData,
                  agree,
                });
                if (!res.ok) setErr(res.error);
                else {
                  setMsg(res.message ?? "Signed");
                  setTypedName("");
                  setSignatureData(null);
                  setPadKey((k) => k + 1);
                  setAgree(false);
                  router.refresh();
                }
              });
            }}
            className="mt-4 w-full rounded-lg bg-neutral-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            Sign contract
          </button>

          {err ? (
            <p className="mt-2 text-sm font-semibold text-red-700">{err}</p>
          ) : null}
          {msg ? (
            <p className="mt-2 text-sm font-semibold text-green-800">{msg}</p>
          ) : null}
        </section>
      )}
    </div>
  );
}
