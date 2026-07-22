import { formatFeePercent } from "./fees";

/** Verbatim contingent fee body with merge placeholders (C2). Typo "seize" retained. */

export type ContractMergeFields = {
  clientNames: string;
  causePhrase: string;
  location: string;
  incidentDateDisplay: string;
  feePreSuitWords: string;
  feePreSuitNum: string;
  feePostFilingWords: string;
  feePostFilingNum: string;
  feeAppealWords: string;
  feeAppealNum: string;
};

const ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];

export function percentToWords(n: number): string {
  // One-third contingent fee floor (33.333%)
  if (Math.abs(n - 100 / 3) < 0.01 || Math.abs(n - 33.333) < 0.01) {
    return "thirty-three and one-third";
  }
  const v = Math.round(n);
  if (v < 20) return ONES[v];
  const t = Math.floor(v / 10);
  const o = v % 10;
  return o === 0 ? TENS[t] : `${TENS[t]}-${ONES[o]}`;
}

export function buildContractBody(f: ContractMergeFields): string {
  return `TUTTLE LAW FIRM

CONTINGENT FEE CONTRACT

In consideration for the legal services to be rendered by THE TUTTLE LAW FIRM ("LAW OFFICE") for any claims that I, ${f.clientNames}, may have against the parties responsible for the damages sustained by me for the following cause of action: ${f.causePhrase} in ${f.location}, Texas that occurred on or about ${f.incidentDateDisplay}. For this reason, I employ said LAW OFFICE to commence and legally prosecute such claims and convey, assign and agree to a ${f.feePreSuitWords} percent (${f.feePreSuitNum}%) attorney fee assignment of the total proceeds, if resolved before filing a lawsuit, which will increase to ${f.feePostFilingWords} percent (${f.feePostFilingNum}%) if a lawsuit is filed. Such amounts are secured by a lien on the claim, lawsuit and all proceeds therefrom.

Should my case be appealed from the trial Court for any reason, whether on interlocutory appeal, mandamus or after trial; the contingent fee will increase to ${f.feeAppealWords} percent (${f.feeAppealNum}%) of all sums, which may be recovered to cover the expenses and work of the appeal. It shall be determined by LAW OFFICE whether or not to appeal and how far to appeal same.

All necessary costs and expenses incurred in prosecuting said claim/litigation shall be borne and paid by client, including, but not limited to postage, expert fees, printing, copying fees, court costs, depositions, artificial intelligence (AI) summaries, travel expenses, meals, telephone, and other reasonable and related expenses. Although LAW OFFICE will, at its discretion, initially pay for all expenses, I contractually agree to reimburse or indemnify the LAW OFFICE all sums expended arising from my claims. If there is a disagreement between the parties as to direction or value of my case, LAW OFFICE can seize to pay expenses at its sole discretion. I agree to pay a $50.00 one-time administration fee if the case is settled for the preparation of all disbursement documents and lien releases. I understand that all expended sums shall be deducted after the attorney fee is calculated. I UNDERSTAND THAT COSTS & EXPENSES ARE NOT ATTORNEY'S FEES.

Furthermore, in personal injury cases, all medical expenses and charges of any nature made by doctors in conjunction with the above mentioned claim are not litigation costs and will be paid by me. In the event of recovery, I agree that said attorney may pay any of these unpaid bills from my share of the recovery. Should I recover nothing, I understand that the LAW OFFICE is not bound to pay any of these medical bills even if the attorney referred me to the medical provider.

Client further acknowledges that LAW OFFICE, at its sole discretion, has the right to finance all or a portion of the costs through a lending facility and that the interest expense and other associated charges of the financing will be passed on to Client as a case litigation cost. The combined interest and financing expenses, if such occurs, will be equal to or less than the highest lawful rate allowed by applicable law.

I hereby fully authorize and empower said LAW OFFICE in my name, and legally authorize it to bring suits on my claims, if necessary, and to prosecute the same to final judgment or conclusion in any way or manner that LAW OFFICE may deem best or advisable. I hereby give and grant unto said LAW OFFICE full power to substitute one or more attorneys at law in my representation or in the performance of any or all of the professional services required, whether in pre-trial matters, trial or appellate procedures and practice. I also grant said LAW OFFICE the authority to communicate with me electronically and through text message.

I agree not to compromise my suit without the consent of the LAW OFFICE and it is not authorized to do so without my consent either.

I agree to keep THE TUTTLE LAW FIRM advised of my whereabouts at all times and to cooperate in the preparation of trial of my case, to appear on reasonable notice for depositions and court appearance, and to comply with all reasonable requests made of me in connection with the preparation and presentation of my case. Failure to cooperate on my part or failure to notify the LAW OFFICE of my whereabouts will be valid reason for said attorneys to withdraw from my case. I agree that if LAW OFFICE has sent three letters to my last known address without any response from me, I authorize them to dismiss my case and/or withdraw from my representation.

I hereby authorize said attorney to turn over all information, including doctor's reports, hospital records, etc., and any and all pictures, to the insurance company or the Defendant's attorneys, if they feel it is necessary to do so.

I attest that no person or attorney has solicited me to bring this case. I voluntarily sought out the services of an attorney to help me for this matter of my own accord.

NOTICE: The State Bar of Texas investigates and prosecutes professional misconduct committed by Texas attorneys. Although not every complaint against or dispute with a lawyer involves professional misconduct, the State Bar's Office of Chief Disciplinary Counsel will provide you with information about how to file a complaint. Please call 1-800-932-1900 toll-free for more information.`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escape then wrap filled-in fields so they stand out (not colored / highlighted). */
function field(s: string) {
  return `<strong class="contract-field">${escapeHtml(s)}</strong>`;
}

/** HTML version of the contract for on-screen reading (staff preview + public sign). */
export function buildContractBodyHtml(f: ContractMergeFields): string {
  const names = field(f.clientNames);
  const cause = field(f.causePhrase);
  const loc = field(f.location);
  const doi = field(f.incidentDateDisplay);
  const pre = field(`${f.feePreSuitWords} percent (${f.feePreSuitNum}%)`);
  const post = field(`${f.feePostFilingWords} percent (${f.feePostFilingNum}%)`);
  const appeal = field(`${f.feeAppealWords} percent (${f.feeAppealNum}%)`);
  const adminFee = field("$50.00");

  const paras = [
    `<p class="contract-title"><strong>TUTTLE LAW FIRM</strong></p>
<p class="contract-title"><strong>CONTINGENT FEE CONTRACT</strong></p>`,
    `<p>In consideration for the legal services to be rendered by THE TUTTLE LAW FIRM ("LAW OFFICE") for any claims that I, ${names}, may have against the parties responsible for the damages sustained by me for the following cause of action: ${cause} in ${loc}, Texas that occurred on or about ${doi}. For this reason, I employ said LAW OFFICE to commence and legally prosecute such claims and convey, assign and agree to a ${pre} attorney fee assignment of the total proceeds, if resolved before filing a lawsuit, which will increase to ${post} if a lawsuit is filed. Such amounts are secured by a lien on the claim, lawsuit and all proceeds therefrom.</p>`,
    `<p>Should my case be appealed from the trial Court for any reason, whether on interlocutory appeal, mandamus or after trial; the contingent fee will increase to ${appeal} of all sums, which may be recovered to cover the expenses and work of the appeal. It shall be determined by LAW OFFICE whether or not to appeal and how far to appeal same.</p>`,
    `<p>All necessary costs and expenses incurred in prosecuting said claim/litigation shall be borne and paid by client, including, but not limited to postage, expert fees, printing, copying fees, court costs, depositions, artificial intelligence (AI) summaries, travel expenses, meals, telephone, and other reasonable and related expenses. Although LAW OFFICE will, at its discretion, initially pay for all expenses, I contractually agree to reimburse or indemnify the LAW OFFICE all sums expended arising from my claims. If there is a disagreement between the parties as to direction or value of my case, LAW OFFICE can seize to pay expenses at its sole discretion. I agree to pay a ${adminFee} one-time administration fee if the case is settled for the preparation of all disbursement documents and lien releases. I understand that all expended sums shall be deducted after the attorney fee is calculated. <strong>I UNDERSTAND THAT COSTS &amp; EXPENSES ARE NOT ATTORNEY'S FEES.</strong></p>`,
    `<p>Furthermore, in personal injury cases, all medical expenses and charges of any nature made by doctors in conjunction with the above mentioned claim are not litigation costs and will be paid by me. In the event of recovery, I agree that said attorney may pay any of these unpaid bills from my share of the recovery. Should I recover nothing, I understand that the LAW OFFICE is not bound to pay any of these medical bills even if the attorney referred me to the medical provider.</p>`,
    `<p>Client further acknowledges that LAW OFFICE, at its sole discretion, has the right to finance all or a portion of the costs through a lending facility and that the interest expense and other associated charges of the financing will be passed on to Client as a case litigation cost. The combined interest and financing expenses, if such occurs, will be equal to or less than the highest lawful rate allowed by applicable law.</p>`,
    `<p>I hereby fully authorize and empower said LAW OFFICE in my name, and legally authorize it to bring suits on my claims, if necessary, and to prosecute the same to final judgment or conclusion in any way or manner that LAW OFFICE may deem best or advisable. I hereby give and grant unto said LAW OFFICE full power to substitute one or more attorneys at law in my representation or in the performance of any or all of the professional services required, whether in pre-trial matters, trial or appellate procedures and practice. I also grant said LAW OFFICE the authority to communicate with me electronically and through text message.</p>`,
    `<p>I agree not to compromise my suit without the consent of the LAW OFFICE and it is not authorized to do so without my consent either.</p>`,
    `<p>I agree to keep THE TUTTLE LAW FIRM advised of my whereabouts at all times and to cooperate in the preparation of trial of my case, to appear on reasonable notice for depositions and court appearance, and to comply with all reasonable requests made of me in connection with the preparation and presentation of my case. Failure to cooperate on my part or failure to notify the LAW OFFICE of my whereabouts will be valid reason for said attorneys to withdraw from my case. I agree that if LAW OFFICE has sent three letters to my last known address without any response from me, I authorize them to dismiss my case and/or withdraw from my representation.</p>`,
    `<p>I hereby authorize said attorney to turn over all information, including doctor's reports, hospital records, etc., and any and all pictures, to the insurance company or the Defendant's attorneys, if they feel it is necessary to do so.</p>`,
    `<p><strong>I attest that no person or attorney has solicited me to bring this case. I voluntarily sought out the services of an attorney to help me for this matter of my own accord.</strong></p>`,
    `<p><strong>NOTICE:</strong> The State Bar of Texas investigates and prosecutes professional misconduct committed by Texas attorneys. Although not every complaint against or dispute with a lawyer involves professional misconduct, the State Bar's Office of Chief Disciplinary Counsel will provide you with information about how to file a complaint. Please call 1-800-932-1900 toll-free for more information.</p>`,
  ];

  return paras.join("\n");
}

export function buildMergeFields(input: {
  clientNames: string;
  location: string;
  incidentDateDisplay: string;
  causePhrase?: string;
  feePreSuit: number;
  feePostFiling: number;
  feeAppeal: number;
}): ContractMergeFields {
  return {
    clientNames: input.clientNames.trim(),
    causePhrase: (input.causePhrase ?? "car accident").trim(),
    location: input.location.trim(),
    incidentDateDisplay: input.incidentDateDisplay,
    feePreSuitWords: percentToWords(input.feePreSuit),
    feePreSuitNum: formatFeePercent(input.feePreSuit),
    feePostFilingWords: percentToWords(input.feePostFiling),
    feePostFilingNum: formatFeePercent(input.feePostFiling),
    feeAppealWords: percentToWords(input.feeAppeal),
    feeAppealNum: formatFeePercent(input.feeAppeal),
  };
}
