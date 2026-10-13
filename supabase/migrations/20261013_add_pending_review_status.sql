-- New project status for SAP projects imported without lines/words.
-- They wait in Manage Projects → "To Review" until a PM marks them as reviewed (→ 'active').
-- Additive only: existing rows and code paths are unaffected.
alter type public.project_status add value if not exists 'pending_review';
