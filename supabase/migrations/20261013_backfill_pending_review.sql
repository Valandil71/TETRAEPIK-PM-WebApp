-- Run ONLY when the code that knows 'pending_review' is deployed: older builds only list
-- 'active' projects, so these would disappear from Manage Projects until then.
--
-- Moves current SAP projects that still have no volume and nobody assigned to "To Review".
-- Same rule as lib/projects/reviewStatus.ts → needsVolumeReview (hours don't count; XTM words
-- are a 0/1 presence flag). Projects that already have collaborators stay active.
update public.projects p
set status = 'pending_review'
where p.status = 'active'
  and p.api_source in ('TPM_sap_api', 'XTM_sap_api')
  and coalesce(p.lines, 0) <= 0
  and coalesce(p.words, 0) <= case when p.system = 'XTM' then 1 else 0 end
  and not exists (
    select 1 from public.projects_assignment a where a.project_id = p.id
  );
