-- v2.21 — PD aging ignores soft-deleted vehicles/claims
-- Matter PD card already filters deleted_at; the queue view did not, so a
-- removed "Camery" still appeared on PD pending.

BEGIN;

DROP VIEW IF EXISTS property.v_pd_aging;
CREATE VIEW property.v_pd_aging WITH (security_invoker=on) AS
 SELECT pd.pd_claim_id,
    v.incident_group_id,
    v.year,
    v.make,
    v.model,
    pd.status,
    pd.owner_staff_id,
    pd.opened_date,
    pd.last_touch_date,
    CURRENT_DATE - pd.last_touch_date AS days_since_touch,
    pd.repairable_or_total,
    pd.valuation_received,
    pd.valuation_reviewed,
    pd.lienholder_resolved,
    pd.loss_of_use_pursued,
    pd.diminished_value_evaluated,
    pd.demand_blocker,
    v.storage_accruing,
    (EXISTS ( SELECT 1
           FROM core.client_matter m
          WHERE m.incident_group_id = v.incident_group_id AND m.deleted_at IS NULL AND (m.current_stage_code = ANY (ARRAY['demand'::text, 'negotiation'::text])))) AS matter_at_demand_stage
   FROM property.pd_claim pd
     JOIN property.vehicle v ON v.vehicle_id = pd.vehicle_id
  WHERE pd.status <> ALL (ARRAY['resolved'::text, 'n_a'::text])
    AND pd.deleted_at IS NULL
    AND v.deleted_at IS NULL
  ORDER BY ((EXISTS ( SELECT 1
           FROM core.client_matter m
          WHERE m.incident_group_id = v.incident_group_id AND m.deleted_at IS NULL AND (m.current_stage_code = ANY (ARRAY['demand'::text, 'negotiation'::text]))))) DESC, (CURRENT_DATE - pd.last_touch_date) DESC NULLS LAST;

GRANT SELECT ON property.v_pd_aging TO app_staff;

COMMIT;
