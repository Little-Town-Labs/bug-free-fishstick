ALTER TABLE "knowledge_entries" DROP CONSTRAINT "knowledge_entries_customer_id_customers_id_fk";
ALTER TABLE "knowledge_entries" ALTER COLUMN "customer_id" DROP NOT NULL;
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_customer_id_customers_id_fk"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE set null;
