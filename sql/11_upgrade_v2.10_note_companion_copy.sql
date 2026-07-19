-- v2.10 — Companion note copy: SECURITY DEFINER helpers so staff can share
-- notes when representation_link allows it (RLS on representation_link is
-- restricted to can_clear_conflicts; the trigger must bypass that for the
-- pairwise clearance check only).
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION app.can_copy_notes_between(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM core.representation_link rl
    WHERE rl.deleted_at IS NULL
      AND ((rl.matter_a = p_a AND rl.matter_b = p_b)
        OR (rl.matter_b = p_a AND rl.matter_a = p_b))
      AND rl.copy_sharing_allowed
      AND rl.conflict_status IN ('cleared', 'waived_in_writing')
  );
$$;

REVOKE ALL ON FUNCTION app.can_copy_notes_between(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.can_copy_notes_between(uuid, uuid) TO app_staff;
GRANT EXECUTE ON FUNCTION app.can_copy_notes_between(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app.can_copy_notes_between(uuid, uuid) TO service_role;

-- PostgREST RPC surface (public schema) for the web app
CREATE OR REPLACE FUNCTION public.can_copy_notes_between(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.can_copy_notes_between(p_a, p_b);
$$;

REVOKE ALL ON FUNCTION public.can_copy_notes_between(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_copy_notes_between(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_copy_notes_between(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_copy_notes_between(uuid, uuid) TO anon;

CREATE OR REPLACE FUNCTION workflow.enforce_note_copy_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_src uuid;
BEGIN
  SELECT n.entity_id INTO v_src
  FROM workflow.note n
  WHERE n.note_id = NEW.note_id;

  IF EXISTS (
    SELECT 1 FROM core.entity e
    WHERE e.entity_id = v_src AND e.entity_type = 'client_matter'
  ) AND v_src IS DISTINCT FROM NEW.client_matter_id THEN
    IF NOT app.can_copy_notes_between(v_src, NEW.client_matter_id) THEN
      RAISE EXCEPTION
        'copy blocked: conflict clearance incomplete between matters % and %',
        v_src, NEW.client_matter_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
