export type ContractPackageStatus =
  | "draft"
  | "sent"
  | "partially_signed"
  | "executed"
  | "void";

export type ContractSignerStatus = "pending" | "signed";

export type SignerCapacity =
  | "client"
  | "next_friend"
  | "parent_guardian"
  | "other";

export type ContractSigner = {
  contract_signer_id: string;
  contract_package_id: string;
  sort_order: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  intake_lead_id: string | null;
  person_id: string | null;
  status: ContractSignerStatus;
  signed_at: string | null;
  signature_typed_name: string | null;
  signer_capacity?: SignerCapacity | null;
};

export type ContractPackage = {
  contract_package_id: string;
  primary_intake_lead_id: string;
  public_token: string;
  status: ContractPackageStatus;
  client_display_names: string;
  incident_location: string;
  incident_date: string;
  cause_phrase: string;
  fee_pre_suit: number;
  fee_post_filing: number;
  fee_appeal: number;
  rendered_body: string | null;
  artifact_html: string | null;
  /** Present on package rows when loaded for staff UI — PDF bytes come from download route. */
  has_pdf?: boolean;
  artifact_pdf_base64?: string | null;
  primary_document_id: string | null;
  sent_at: string | null;
  executed_at: string | null;
  expires_at: string | null;
  created_at: string;
  firm_signature_data?: string | null;
  firm_signature_typed_name?: string | null;
  firm_signed_at?: string | null;
  firm_signed_by?: string | null;
  signers?: ContractSigner[];
};

export type SignerInput = {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  intake_lead_id?: string | null;
  person_id?: string | null;
  signer_capacity?: SignerCapacity | null;
};
