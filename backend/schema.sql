-- ============================================================
-- SAP Order-to-Cash Schema for Supabase
-- Run this entire file in Supabase SQL Editor before seeding
-- ============================================================

-- Sales Order Headers
CREATE TABLE IF NOT EXISTS sales_order_headers (
  sales_order TEXT PRIMARY KEY,
  sales_order_type TEXT,
  sales_organization TEXT,
  distribution_channel TEXT,
  organization_division TEXT,
  sales_group TEXT,
  sales_office TEXT,
  sold_to_party TEXT,
  creation_date TIMESTAMPTZ,
  created_by_user TEXT,
  last_change_date_time TIMESTAMPTZ,
  total_net_amount NUMERIC,
  overall_delivery_status TEXT,
  overall_ord_reltd_billg_status TEXT,
  overall_sd_doc_reference_status TEXT,
  transaction_currency TEXT,
  pricing_date TIMESTAMPTZ,
  requested_delivery_date TIMESTAMPTZ,
  header_billing_block_reason TEXT,
  delivery_block_reason TEXT,
  incoterms_classification TEXT,
  incoterms_location1 TEXT,
  customer_payment_terms TEXT,
  total_credit_check_status TEXT
);

-- Sales Order Items
CREATE TABLE IF NOT EXISTS sales_order_items (
  sales_order TEXT,
  sales_order_item TEXT,
  sales_order_item_category TEXT,
  material TEXT,
  requested_quantity NUMERIC,
  requested_quantity_unit TEXT,
  transaction_currency TEXT,
  net_amount NUMERIC,
  material_group TEXT,
  production_plant TEXT,
  storage_location TEXT,
  sales_document_rjcn_reason TEXT,
  item_billing_block_reason TEXT,
  PRIMARY KEY (sales_order, sales_order_item)
);

-- Sales Order Schedule Lines
CREATE TABLE IF NOT EXISTS sales_order_schedule_lines (
  sales_order TEXT,
  sales_order_item TEXT,
  schedule_line TEXT,
  confirmed_delivery_date TIMESTAMPTZ,
  order_quantity_unit TEXT,
  confd_order_qty_by_matl_avail_check NUMERIC,
  PRIMARY KEY (sales_order, sales_order_item, schedule_line)
);

-- Outbound Delivery Headers
CREATE TABLE IF NOT EXISTS outbound_delivery_headers (
  delivery_document TEXT PRIMARY KEY,
  actual_goods_movement_date TIMESTAMPTZ,
  actual_goods_movement_time TEXT,
  creation_date TIMESTAMPTZ,
  creation_time TEXT,
  delivery_block_reason TEXT,
  hdr_general_incompletion_status TEXT,
  header_billing_block_reason TEXT,
  last_change_date TIMESTAMPTZ,
  overall_goods_movement_status TEXT,
  overall_picking_status TEXT,
  overall_proof_of_delivery_status TEXT,
  shipping_point TEXT
);

-- Outbound Delivery Items
CREATE TABLE IF NOT EXISTS outbound_delivery_items (
  delivery_document TEXT,
  delivery_document_item TEXT,
  actual_delivery_quantity NUMERIC,
  batch TEXT,
  delivery_quantity_unit TEXT,
  item_billing_block_reason TEXT,
  last_change_date TIMESTAMPTZ,
  plant TEXT,
  reference_sd_document TEXT,
  reference_sd_document_item TEXT,
  storage_location TEXT,
  PRIMARY KEY (delivery_document, delivery_document_item)
);

-- Billing Document Headers
CREATE TABLE IF NOT EXISTS billing_document_headers (
  billing_document TEXT PRIMARY KEY,
  billing_document_type TEXT,
  creation_date TIMESTAMPTZ,
  creation_time TEXT,
  last_change_date_time TIMESTAMPTZ,
  billing_document_date TIMESTAMPTZ,
  billing_document_is_cancelled TEXT,
  cancelled_billing_document TEXT,
  total_net_amount NUMERIC,
  transaction_currency TEXT,
  company_code TEXT,
  fiscal_year TEXT,
  accounting_document TEXT,
  sold_to_party TEXT
);

-- Billing Document Items
CREATE TABLE IF NOT EXISTS billing_document_items (
  billing_document TEXT,
  billing_document_item TEXT,
  material TEXT,
  billing_quantity NUMERIC,
  billing_quantity_unit TEXT,
  net_amount NUMERIC,
  transaction_currency TEXT,
  reference_sd_document TEXT,
  reference_sd_document_item TEXT,
  PRIMARY KEY (billing_document, billing_document_item)
);

-- Billing Document Cancellations
CREATE TABLE IF NOT EXISTS billing_document_cancellations (
  billing_document TEXT PRIMARY KEY,
  billing_document_type TEXT,
  creation_date TIMESTAMPTZ,
  creation_time TEXT,
  last_change_date_time TIMESTAMPTZ,
  billing_document_date TIMESTAMPTZ,
  billing_document_is_cancelled TEXT,
  cancelled_billing_document TEXT,
  total_net_amount NUMERIC,
  transaction_currency TEXT,
  company_code TEXT,
  fiscal_year TEXT,
  accounting_document TEXT,
  sold_to_party TEXT
);

-- Journal Entry Items (Accounts Receivable)
CREATE TABLE IF NOT EXISTS journal_entry_items (
  company_code TEXT,
  fiscal_year TEXT,
  accounting_document TEXT,
  accounting_document_item TEXT,
  gl_account TEXT,
  reference_document TEXT,
  cost_center TEXT,
  profit_center TEXT,
  transaction_currency TEXT,
  amount_in_transaction_currency NUMERIC,
  company_code_currency TEXT,
  amount_in_company_code_currency NUMERIC,
  posting_date TIMESTAMPTZ,
  document_date TIMESTAMPTZ,
  accounting_document_type TEXT,
  assignment_reference TEXT,
  last_change_date_time TIMESTAMPTZ,
  customer TEXT,
  financial_account_type TEXT,
  clearing_date TIMESTAMPTZ,
  clearing_accounting_document TEXT,
  clearing_doc_fiscal_year TEXT,
  PRIMARY KEY (accounting_document, accounting_document_item)
);

-- Payments (Accounts Receivable)
CREATE TABLE IF NOT EXISTS payments (
  company_code TEXT,
  fiscal_year TEXT,
  accounting_document TEXT,
  accounting_document_item TEXT,
  clearing_date TIMESTAMPTZ,
  clearing_accounting_document TEXT,
  clearing_doc_fiscal_year TEXT,
  amount_in_transaction_currency NUMERIC,
  transaction_currency TEXT,
  amount_in_company_code_currency NUMERIC,
  company_code_currency TEXT,
  customer TEXT,
  invoice_reference TEXT,
  invoice_reference_fiscal_year TEXT,
  sales_document TEXT,
  sales_document_item TEXT,
  posting_date TIMESTAMPTZ,
  document_date TIMESTAMPTZ,
  assignment_reference TEXT,
  gl_account TEXT,
  financial_account_type TEXT,
  profit_center TEXT,
  cost_center TEXT,
  PRIMARY KEY (accounting_document, accounting_document_item)
);

-- Business Partners
CREATE TABLE IF NOT EXISTS business_partners (
  business_partner TEXT PRIMARY KEY,
  customer TEXT,
  business_partner_category TEXT,
  business_partner_full_name TEXT,
  business_partner_grouping TEXT,
  business_partner_name TEXT,
  correspondence_language TEXT,
  created_by_user TEXT,
  creation_date TIMESTAMPTZ,
  creation_time TEXT,
  first_name TEXT,
  form_of_address TEXT,
  industry TEXT,
  last_change_date TIMESTAMPTZ,
  last_name TEXT,
  organization_bp_name1 TEXT,
  organization_bp_name2 TEXT,
  business_partner_is_blocked TEXT,
  is_marked_for_archiving TEXT
);

-- Business Partner Addresses
CREATE TABLE IF NOT EXISTS business_partner_addresses (
  business_partner TEXT,
  address_id TEXT,
  validity_start_date TIMESTAMPTZ,
  validity_end_date TIMESTAMPTZ,
  city_name TEXT,
  country TEXT,
  postal_code TEXT,
  region TEXT,
  street_name TEXT,
  transport_zone TEXT,
  PRIMARY KEY (business_partner, address_id)
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  product TEXT PRIMARY KEY,
  product_type TEXT,
  cross_plant_status TEXT,
  creation_date TIMESTAMPTZ,
  created_by_user TEXT,
  last_change_date TIMESTAMPTZ,
  is_marked_for_deletion TEXT,
  product_old_id TEXT,
  gross_weight NUMERIC,
  weight_unit TEXT,
  net_weight NUMERIC,
  product_group TEXT,
  base_unit TEXT,
  division TEXT,
  industry_sector TEXT
);

-- Product Descriptions
CREATE TABLE IF NOT EXISTS product_descriptions (
  product TEXT,
  language TEXT,
  product_description TEXT,
  PRIMARY KEY (product, language)
);

-- Plants
CREATE TABLE IF NOT EXISTS plants (
  plant TEXT PRIMARY KEY,
  plant_name TEXT,
  valuation_area TEXT,
  plant_customer TEXT,
  plant_supplier TEXT,
  sales_organization TEXT,
  address_id TEXT,
  plant_category TEXT,
  distribution_channel TEXT,
  division TEXT,
  language TEXT,
  is_marked_for_archiving TEXT
);

-- Customer Company Assignments
CREATE TABLE IF NOT EXISTS customer_company_assignments (
  customer TEXT,
  company_code TEXT,
  payment_terms TEXT,
  reconciliation_account TEXT,
  deletion_indicator TEXT,
  customer_account_group TEXT,
  PRIMARY KEY (customer, company_code)
);

-- Customer Sales Area Assignments
CREATE TABLE IF NOT EXISTS customer_sales_area_assignments (
  customer TEXT,
  sales_organization TEXT,
  distribution_channel TEXT,
  division TEXT,
  billing_is_blocked_for_customer TEXT,
  credit_control_area TEXT,
  currency TEXT,
  customer_payment_terms TEXT,
  delivery_priority TEXT,
  incoterms_classification TEXT,
  sales_district TEXT,
  PRIMARY KEY (customer, sales_organization, distribution_channel, division)
);