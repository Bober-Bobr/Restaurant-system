-- Commercial tier and price per built-in invitation template, set by a
-- SYSTEM_ADMIN on the v-invite Settings tab.
--
-- Both columns are nullable and added to the existing per-template settings row
-- rather than to a new table: the key is the same (templateId) and the same
-- person edits both halves on the same screen. Nullable also keeps "never
-- priced" distinct from "priced at zero", which matters for what the
-- promotional site should show.
ALTER TABLE "InviteTemplateOverride" ADD COLUMN "tier" TEXT;
ALTER TABLE "InviteTemplateOverride" ADD COLUMN "priceCents" INTEGER;
