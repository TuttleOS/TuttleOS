-- v2.20 — negotiation directionality CHECK
-- Offers/counters = defense (insurer); counter-demands = plaintiff (firm);
-- client authority = client. Other event types unrestricted by side.

BEGIN;

-- Soft-flag any historical rows that would violate the new rule (do not delete).
-- They remain queryable; new writes are blocked by the CHECK below.
COMMENT ON TABLE resolution.negotiation_event IS
  'Negotiation ledger. Directionality: offer/counter_offer(/mediation/rule_167) → defense; counter_demand → plaintiff; client_authority_obtained → client.';

ALTER TABLE resolution.negotiation_event
  DROP CONSTRAINT IF EXISTS negotiation_event_directionality_chk;

ALTER TABLE resolution.negotiation_event
  ADD CONSTRAINT negotiation_event_directionality_chk CHECK (
    (
      event_type IN (
        'offer',
        'counter_offer',
        'mediation_offer',
        'rule_167_offer'
      )
      AND by_side = 'defense'
    )
    OR (event_type = 'counter_demand' AND by_side = 'plaintiff')
    OR (event_type = 'client_authority_obtained' AND by_side = 'client')
    OR (
      event_type NOT IN (
        'offer',
        'counter_offer',
        'mediation_offer',
        'rule_167_offer',
        'counter_demand',
        'client_authority_obtained'
      )
    )
  );

COMMIT;
