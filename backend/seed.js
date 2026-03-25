// seed.js - Run with: node seed.js
// Place this file next to your dataset folder OR update DATA_DIR below

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // service role key bypasses RLS
);

// ---- UPDATE THIS PATH to where you unzipped the dataset ----
const DATA_DIR = path.join(__dirname, 'sap-o2c-data');

function readJsonlDir(dirName) {
  const dirPath = path.join(DATA_DIR, dirName);
  if (!fs.existsSync(dirPath)) return [];
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.jsonl'));
  const records = [];
  for (const file of files) {
    const lines = fs.readFileSync(path.join(dirPath, file), 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        try { records.push(JSON.parse(trimmed)); } catch {}
      }
    }
  }
  return records;
}

async function upsertBatch(table, rows, chunkSize = 500) {
  if (!rows.length) { console.log(`  Skipping ${table} (no data)`); return; }
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) {
      console.error(`  ERROR in ${table}:`, error.message);
      return;
    }
    inserted += chunk.length;
  }
  console.log(`  ✓ ${table}: ${inserted} rows`);
}

async function seed() {
  console.log('🌱 Starting seed...\n');

  // --- Sales Order Headers ---
  const soHeaders = readJsonlDir('sales_order_headers').map(r => ({
    sales_order: r.salesOrder,
    sales_order_type: r.salesOrderType,
    sales_organization: r.salesOrganization,
    distribution_channel: r.distributionChannel,
    organization_division: r.organizationDivision,
    sales_group: r.salesGroup,
    sales_office: r.salesOffice,
    sold_to_party: r.soldToParty,
    creation_date: r.creationDate,
    created_by_user: r.createdByUser,
    last_change_date_time: r.lastChangeDateTime,
    total_net_amount: parseFloat(r.totalNetAmount) || null,
    overall_delivery_status: r.overallDeliveryStatus,
    overall_ord_reltd_billg_status: r.overallOrdReltdBillgStatus,
    overall_sd_doc_reference_status: r.overallSdDocReferenceStatus,
    transaction_currency: r.transactionCurrency,
    pricing_date: r.pricingDate,
    requested_delivery_date: r.requestedDeliveryDate,
    header_billing_block_reason: r.headerBillingBlockReason,
    delivery_block_reason: r.deliveryBlockReason,
    incoterms_classification: r.incotermsClassification,
    incoterms_location1: r.incotermsLocation1,
    customer_payment_terms: r.customerPaymentTerms,
    total_credit_check_status: r.totalCreditCheckStatus,
  }));
  await upsertBatch('sales_order_headers', soHeaders);

  // --- Sales Order Items ---
  const soItems = readJsonlDir('sales_order_items').map(r => ({
    sales_order: r.salesOrder,
    sales_order_item: r.salesOrderItem,
    sales_order_item_category: r.salesOrderItemCategory,
    material: r.material,
    requested_quantity: parseFloat(r.requestedQuantity) || null,
    requested_quantity_unit: r.requestedQuantityUnit,
    transaction_currency: r.transactionCurrency,
    net_amount: parseFloat(r.netAmount) || null,
    material_group: r.materialGroup,
    production_plant: r.productionPlant,
    storage_location: r.storageLocation,
    sales_document_rjcn_reason: r.salesDocumentRjcnReason,
    item_billing_block_reason: r.itemBillingBlockReason,
  }));
  await upsertBatch('sales_order_items', soItems);

  // --- Sales Order Schedule Lines ---
  const schedLines = readJsonlDir('sales_order_schedule_lines').map(r => ({
    sales_order: r.salesOrder,
    sales_order_item: r.salesOrderItem,
    schedule_line: r.scheduleLine,
    confirmed_delivery_date: r.confirmedDeliveryDate,
    order_quantity_unit: r.orderQuantityUnit,
    confd_order_qty_by_matl_avail_check: parseFloat(r.confdOrderQtyByMatlAvailCheck) || null,
  }));
  await upsertBatch('sales_order_schedule_lines', schedLines);

  // --- Outbound Delivery Headers ---
  const odHeaders = readJsonlDir('outbound_delivery_headers').map(r => ({
    delivery_document: r.deliveryDocument,
    actual_goods_movement_date: r.actualGoodsMovementDate,
    actual_goods_movement_time: r.actualGoodsMovementTime,
    creation_date: r.creationDate,
    creation_time: r.creationTime,
    delivery_block_reason: r.deliveryBlockReason,
    hdr_general_incompletion_status: r.hdrGeneralIncompletionStatus,
    header_billing_block_reason: r.headerBillingBlockReason,
    last_change_date: r.lastChangeDate,
    overall_goods_movement_status: r.overallGoodsMovementStatus,
    overall_picking_status: r.overallPickingStatus,
    overall_proof_of_delivery_status: r.overallProofOfDeliveryStatus,
    shipping_point: r.shippingPoint,
  }));
  await upsertBatch('outbound_delivery_headers', odHeaders);

  // --- Outbound Delivery Items ---
  const odItems = readJsonlDir('outbound_delivery_items').map(r => ({
    delivery_document: r.deliveryDocument,
    delivery_document_item: r.deliveryDocumentItem,
    actual_delivery_quantity: parseFloat(r.actualDeliveryQuantity) || null,
    batch: r.batch,
    delivery_quantity_unit: r.deliveryQuantityUnit,
    item_billing_block_reason: r.itemBillingBlockReason,
    last_change_date: r.lastChangeDate,
    plant: r.plant,
    reference_sd_document: r.referenceSdDocument,
    reference_sd_document_item: r.referenceSdDocumentItem,
    storage_location: r.storageLocation,
  }));
  await upsertBatch('outbound_delivery_items', odItems);

  // --- Billing Document Headers ---
  const bdHeaders = readJsonlDir('billing_document_headers').map(r => ({
    billing_document: r.billingDocument,
    billing_document_type: r.billingDocumentType,
    creation_date: r.creationDate,
    creation_time: r.creationTime,
    last_change_date_time: r.lastChangeDateTime,
    billing_document_date: r.billingDocumentDate,
    billing_document_is_cancelled: r.billingDocumentIsCancelled,
    cancelled_billing_document: r.cancelledBillingDocument,
    total_net_amount: parseFloat(r.totalNetAmount) || null,
    transaction_currency: r.transactionCurrency,
    company_code: r.companyCode,
    fiscal_year: r.fiscalYear,
    accounting_document: r.accountingDocument,
    sold_to_party: r.soldToParty,
  }));
  await upsertBatch('billing_document_headers', bdHeaders);

  // --- Billing Document Items ---
  const bdItems = readJsonlDir('billing_document_items').map(r => ({
    billing_document: r.billingDocument,
    billing_document_item: r.billingDocumentItem,
    material: r.material,
    billing_quantity: parseFloat(r.billingQuantity) || null,
    billing_quantity_unit: r.billingQuantityUnit,
    net_amount: parseFloat(r.netAmount) || null,
    transaction_currency: r.transactionCurrency,
    reference_sd_document: r.referenceSdDocument,
    reference_sd_document_item: r.referenceSdDocumentItem,
  }));
  await upsertBatch('billing_document_items', bdItems);

  // --- Billing Document Cancellations ---
  const bdCancels = readJsonlDir('billing_document_cancellations').map(r => ({
    billing_document: r.billingDocument,
    billing_document_type: r.billingDocumentType,
    creation_date: r.creationDate,
    creation_time: r.creationTime,
    last_change_date_time: r.lastChangeDateTime,
    billing_document_date: r.billingDocumentDate,
    billing_document_is_cancelled: r.billingDocumentIsCancelled,
    cancelled_billing_document: r.cancelledBillingDocument,
    total_net_amount: parseFloat(r.totalNetAmount) || null,
    transaction_currency: r.transactionCurrency,
    company_code: r.companyCode,
    fiscal_year: r.fiscalYear,
    accounting_document: r.accountingDocument,
    sold_to_party: r.soldToParty,
  }));
  await upsertBatch('billing_document_cancellations', bdCancels);

  // --- Journal Entry Items ---
  const jeItems = readJsonlDir('journal_entry_items_accounts_receivable').map(r => ({
    company_code: r.companyCode,
    fiscal_year: r.fiscalYear,
    accounting_document: r.accountingDocument,
    accounting_document_item: r.accountingDocumentItem,
    gl_account: r.glAccount,
    reference_document: r.referenceDocument,
    cost_center: r.costCenter,
    profit_center: r.profitCenter,
    transaction_currency: r.transactionCurrency,
    amount_in_transaction_currency: parseFloat(r.amountInTransactionCurrency) || null,
    company_code_currency: r.companyCodeCurrency,
    amount_in_company_code_currency: parseFloat(r.amountInCompanyCodeCurrency) || null,
    posting_date: r.postingDate,
    document_date: r.documentDate,
    accounting_document_type: r.accountingDocumentType,
    assignment_reference: r.assignmentReference,
    last_change_date_time: r.lastChangeDateTime,
    customer: r.customer,
    financial_account_type: r.financialAccountType,
    clearing_date: r.clearingDate,
    clearing_accounting_document: r.clearingAccountingDocument,
    clearing_doc_fiscal_year: r.clearingDocFiscalYear,
  }));
  await upsertBatch('journal_entry_items', jeItems);

  // --- Payments ---
  const payments = readJsonlDir('payments_accounts_receivable').map(r => ({
    company_code: r.companyCode,
    fiscal_year: r.fiscalYear,
    accounting_document: r.accountingDocument,
    accounting_document_item: r.accountingDocumentItem,
    clearing_date: r.clearingDate,
    clearing_accounting_document: r.clearingAccountingDocument,
    clearing_doc_fiscal_year: r.clearingDocFiscalYear,
    amount_in_transaction_currency: parseFloat(r.amountInTransactionCurrency) || null,
    transaction_currency: r.transactionCurrency,
    amount_in_company_code_currency: parseFloat(r.amountInCompanyCodeCurrency) || null,
    company_code_currency: r.companyCodeCurrency,
    customer: r.customer,
    invoice_reference: r.invoiceReference,
    invoice_reference_fiscal_year: r.invoiceReferenceFiscalYear,
    sales_document: r.salesDocument,
    sales_document_item: r.salesDocumentItem,
    posting_date: r.postingDate,
    document_date: r.documentDate,
    assignment_reference: r.assignmentReference,
    gl_account: r.glAccount,
    financial_account_type: r.financialAccountType,
    profit_center: r.profitCenter,
    cost_center: r.costCenter,
  }));
  await upsertBatch('payments', payments);

  // --- Business Partners ---
  const bps = readJsonlDir('business_partners').map(r => ({
    business_partner: r.businessPartner,
    customer: r.customer,
    business_partner_category: r.businessPartnerCategory,
    business_partner_full_name: r.businessPartnerFullName,
    business_partner_grouping: r.businessPartnerGrouping,
    business_partner_name: r.businessPartnerName,
    correspondence_language: r.correspondenceLanguage,
    created_by_user: r.createdByUser,
    creation_date: r.creationDate,
    creation_time: r.creationTime,
    first_name: r.firstName,
    form_of_address: r.formOfAddress,
    industry: r.industry,
    last_change_date: r.lastChangeDate,
    last_name: r.lastName,
    organization_bp_name1: r.organizationBpName1,
    organization_bp_name2: r.organizationBpName2,
    business_partner_is_blocked: r.businessPartnerIsBlocked,
    is_marked_for_archiving: r.isMarkedForArchiving,
  }));
  await upsertBatch('business_partners', bps);

  // --- Business Partner Addresses ---
  const bpAddrs = readJsonlDir('business_partner_addresses').map(r => ({
    business_partner: r.businessPartner,
    address_id: r.addressId,
    validity_start_date: r.validityStartDate,
    validity_end_date: r.validityEndDate,
    city_name: r.cityName,
    country: r.country,
    postal_code: r.postalCode,
    region: r.region,
    street_name: r.streetName,
    transport_zone: r.transportZone,
  }));
  await upsertBatch('business_partner_addresses', bpAddrs);

  // --- Products ---
  const prods = readJsonlDir('products').map(r => ({
    product: r.product,
    product_type: r.productType,
    cross_plant_status: r.crossPlantStatus,
    creation_date: r.creationDate,
    created_by_user: r.createdByUser,
    last_change_date: r.lastChangeDate,
    is_marked_for_deletion: r.isMarkedForDeletion,
    product_old_id: r.productOldId,
    gross_weight: parseFloat(r.grossWeight) || null,
    weight_unit: r.weightUnit,
    net_weight: parseFloat(r.netWeight) || null,
    product_group: r.productGroup,
    base_unit: r.baseUnit,
    division: r.division,
    industry_sector: r.industrySector,
  }));
  await upsertBatch('products', prods);

  // --- Product Descriptions ---
  const prodDescs = readJsonlDir('product_descriptions').map(r => ({
    product: r.product,
    language: r.language,
    product_description: r.productDescription,
  }));
  await upsertBatch('product_descriptions', prodDescs);

  // --- Plants ---
  const plantsData = readJsonlDir('plants').map(r => ({
    plant: r.plant,
    plant_name: r.plantName,
    valuation_area: r.valuationArea,
    plant_customer: r.plantCustomer,
    plant_supplier: r.plantSupplier,
    sales_organization: r.salesOrganization,
    address_id: r.addressId,
    plant_category: r.plantCategory,
    distribution_channel: r.distributionChannel,
    division: r.division,
    language: r.language,
    is_marked_for_archiving: r.isMarkedForArchiving,
  }));
  await upsertBatch('plants', plantsData);

  // --- Customer Company Assignments ---
  const ccAssigns = readJsonlDir('customer_company_assignments').map(r => ({
    customer: r.customer,
    company_code: r.companyCode,
    payment_terms: r.paymentTerms,
    reconciliation_account: r.reconciliationAccount,
    deletion_indicator: r.deletionIndicator,
    customer_account_group: r.customerAccountGroup,
  }));
  await upsertBatch('customer_company_assignments', ccAssigns);

  // --- Customer Sales Area Assignments ---
  const csaAssigns = readJsonlDir('customer_sales_area_assignments').map(r => ({
    customer: r.customer,
    sales_organization: r.salesOrganization,
    distribution_channel: r.distributionChannel,
    division: r.division,
    billing_is_blocked_for_customer: r.billingIsBlockedForCustomer,
    credit_control_area: r.creditControlArea,
    currency: r.currency,
    customer_payment_terms: r.customerPaymentTerms,
    delivery_priority: r.deliveryPriority,
    incoterms_classification: r.incotermsClassification,
    sales_district: r.salesDistrict,
  }));
  await upsertBatch('customer_sales_area_assignments', csaAssigns);

  console.log('\n✅ Seed complete!');
}

seed().catch(console.error);