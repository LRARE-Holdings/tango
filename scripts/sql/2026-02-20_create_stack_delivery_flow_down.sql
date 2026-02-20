-- Rollback for stack delivery flow.

drop table if exists public.stack_acknowledgement_receipts;
drop table if exists public.stack_document_acknowledgements;
drop table if exists public.stack_delivery_recipients;
drop table if exists public.stack_delivery_documents;
drop table if exists public.stack_deliveries;
