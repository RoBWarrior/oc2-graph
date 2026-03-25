// index.js - Express backend
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ─────────────────────────────────────────────
// DATABASE SCHEMA (for LLM context)
// ─────────────────────────────────────────────
const SCHEMA_DESCRIPTION = `
You are a data analyst for a SAP Order-to-Cash (O2C) system. 
You have access to the following Supabase/PostgreSQL tables:

1. sales_order_headers (sales_order PK, sold_to_party, total_net_amount, overall_delivery_status, overall_ord_reltd_billg_status, creation_date, transaction_currency, requested_delivery_date, delivery_block_reason, header_billing_block_reason)

2. sales_order_items (sales_order, sales_order_item, material, net_amount, requested_quantity, production_plant, item_billing_block_reason)

3. sales_order_schedule_lines (sales_order, sales_order_item, schedule_line, confirmed_delivery_date, confd_order_qty_by_matl_avail_check)

4. outbound_delivery_headers (delivery_document PK, actual_goods_movement_date, overall_goods_movement_status, overall_picking_status, shipping_point, creation_date)

5. outbound_delivery_items (delivery_document, delivery_document_item, reference_sd_document [= sales_order], reference_sd_document_item, plant, actual_delivery_quantity)

6. billing_document_headers (billing_document PK, billing_document_type, billing_document_date, total_net_amount, accounting_document, sold_to_party, billing_document_is_cancelled, cancelled_billing_document, fiscal_year, company_code)

7. billing_document_items (billing_document, billing_document_item, material, net_amount, reference_sd_document [= sales_order], reference_sd_document_item)

8. billing_document_cancellations (billing_document PK, cancelled_billing_document, billing_document_date, total_net_amount, sold_to_party)

9. journal_entry_items (accounting_document, accounting_document_item, reference_document [= billing_document], customer, amount_in_transaction_currency, posting_date, clearing_date, clearing_accounting_document, gl_account, financial_account_type)

10. payments (accounting_document, accounting_document_item, customer, invoice_reference [= billing accounting_document], sales_document [= sales_order], amount_in_transaction_currency, clearing_date, posting_date)

11. business_partners (business_partner PK, customer, business_partner_full_name, business_partner_name, industry, first_name, last_name, organization_bp_name1)

12. business_partner_addresses (business_partner, address_id, city_name, country, region, street_name)

13. products (product PK, product_type, product_group, gross_weight, net_weight, base_unit, division)

14. product_descriptions (product, language, product_description)

15. plants (plant PK, plant_name, sales_organization, plant_category, distribution_channel)

16. customer_company_assignments (customer, company_code, payment_terms, reconciliation_account)

17. customer_sales_area_assignments (customer, sales_organization, distribution_channel, division, customer_payment_terms, delivery_priority)

KEY RELATIONSHIPS:
- sales_order_headers.sold_to_party → business_partners.customer
- sales_order_items.sales_order → sales_order_headers.sales_order
- sales_order_items.material → products.product
- outbound_delivery_items.reference_sd_document → sales_order_headers.sales_order
- outbound_delivery_items.delivery_document → outbound_delivery_headers.delivery_document
- billing_document_items.reference_sd_document → sales_order_headers.sales_order
- billing_document_headers.accounting_document → journal_entry_items.accounting_document
- journal_entry_items.reference_document → billing_document_headers.billing_document
- payments.invoice_reference → billing_document_headers.accounting_document
- product_descriptions.product → products.product

FULL O2C FLOW:
Sales Order → Delivery (outbound_delivery_items.reference_sd_document) → Billing Document → Journal Entry → Payment

STATUS CODES:
- overall_delivery_status: A=Not delivered, B=Partially delivered, C=Fully delivered
- overall_ord_reltd_billg_status: A=Not billed, B=Partially billed, C=Fully billed
- billing_document_is_cancelled: X=cancelled, empty=active
`;

const SYSTEM_PROMPT = `${SCHEMA_DESCRIPTION}

INSTRUCTIONS:
You are a query assistant. When the user asks a question:

1. First check if the question is related to this O2C dataset. If NOT related (e.g. general knowledge, coding help, weather, creative writing), respond EXACTLY with:
{"type": "off_topic", "message": "This system is designed to answer questions related to the Order-to-Cash dataset only. Please ask questions about sales orders, deliveries, billing documents, payments, customers, or products."}

2. If it IS related, respond with a JSON object:
{"type": "query", "sql": "<valid PostgreSQL SQL query>", "explanation": "<brief explanation of what the query does>"}

RULES for SQL:
- Use exact table and column names as defined above
- Always use lowercase snake_case for table/column names
- For text comparisons use ILIKE for case-insensitive search
- Limit results to 50 rows unless the user asks for more
- For "trace" or "flow" queries, use multiple JOINs across the O2C chain
- For "broken flow" queries: sales orders with delivery but no billing, or billing but no payment
- Never use DROP, DELETE, INSERT, UPDATE, CREATE — read-only queries only
- When joining billing_document_headers to journal_entry_items, join on billing_document_headers.accounting_document = journal_entry_items.accounting_document

Respond ONLY with valid JSON. No markdown, no explanation outside the JSON.`;

// ─────────────────────────────────────────────
// GRAPH ENDPOINT
// ─────────────────────────────────────────────
app.get('/api/graph', async (req, res) => {
  try {
    const [
      { data: soHeaders },
      { data: soItems },
      { data: odItems },
      { data: bdHeaders },
      { data: bdItems },
      { data: jeItems },
      { data: payments },
      { data: bps },
      { data: products },
    ] = await Promise.all([
      supabase.from('sales_order_headers').select('sales_order,sold_to_party,total_net_amount,overall_delivery_status,overall_ord_reltd_billg_status,transaction_currency').limit(100),
      supabase.from('sales_order_items').select('sales_order,sales_order_item,material').limit(200),
      supabase.from('outbound_delivery_items').select('delivery_document,reference_sd_document,plant').limit(200),
      supabase.from('billing_document_headers').select('billing_document,accounting_document,sold_to_party,total_net_amount,billing_document_is_cancelled').limit(200),
      supabase.from('billing_document_items').select('billing_document,reference_sd_document,material').limit(200),
      supabase.from('journal_entry_items').select('accounting_document,reference_document,customer,amount_in_transaction_currency').limit(200),
      supabase.from('payments').select('accounting_document,invoice_reference,customer,amount_in_transaction_currency').limit(200),
      supabase.from('business_partners').select('business_partner,customer,business_partner_full_name,business_partner_name,organization_bp_name1').limit(50),
      supabase.from('products').select('product,product_type,product_group').limit(100),
    ]);

    const nodes = [];
    const edges = [];
    const nodeSet = new Set();

    const addNode = (id, type, label, data = {}) => {
      if (!nodeSet.has(id)) {
        nodeSet.add(id);
        nodes.push({ id, type, label, ...data });
      }
    };
    const addEdge = (source, target, label) => {
      edges.push({ id: `${source}->${target}`, source, target, label });
    };

    // Sales Orders
    (soHeaders || []).forEach(so => {
      addNode(`SO:${so.sales_order}`, 'SalesOrder', `SO ${so.sales_order}`, {
        amount: so.total_net_amount,
        currency: so.transaction_currency,
        deliveryStatus: so.overall_delivery_status,
        billingStatus: so.overall_ord_reltd_billg_status,
      });
    });

    // Business Partners → Sales Orders
    (bps || []).forEach(bp => {
      addNode(`BP:${bp.customer}`, 'Customer', bp.organization_bp_name1 || bp.business_partner_full_name || bp.customer, {
        customer: bp.customer,
      });
    });
    (soHeaders || []).forEach(so => {
      if (so.sold_to_party) {
        const bpId = `BP:${so.sold_to_party}`;
        if (!nodeSet.has(bpId)) {
          addNode(bpId, 'Customer', `Customer ${so.sold_to_party}`, { customer: so.sold_to_party });
        }
        addEdge(bpId, `SO:${so.sales_order}`, 'placed');
      }
    });

    // Sales Order Items → Products
    const seenProducts = new Set();
    (soItems || []).forEach(item => {
      if (item.material && !seenProducts.has(item.material)) {
        seenProducts.add(item.material);
        addNode(`P:${item.material}`, 'Product', `Product ${item.material}`, { material: item.material });
      }
      addEdge(`SO:${item.sales_order}`, `P:${item.material}`, 'contains');
    });

    // Deliveries
    const deliveryToSO = {};
    (odItems || []).forEach(item => {
      if (item.reference_sd_document) {
        deliveryToSO[item.delivery_document] = item.reference_sd_document;
      }
    });
    Object.entries(deliveryToSO).forEach(([delivDoc, salesOrder]) => {
      addNode(`DEL:${delivDoc}`, 'Delivery', `Delivery ${delivDoc}`, {});
      addEdge(`SO:${salesOrder}`, `DEL:${delivDoc}`, 'delivered via');
    });

    // Plant nodes + Delivery → Plant edges
    (odItems || []).forEach(item => {
      if (item.plant) {
        const plantId = `PLANT:${item.plant}`;
        if (!nodeSet.has(plantId)) {
          addNode(plantId, 'Plant', `Plant ${item.plant}`, { plant: item.plant });
        }
        if (item.delivery_document) {
          addEdge(`DEL:${item.delivery_document}`, plantId, 'ships from');
        }
      }
    });

    // Billing Documents
    (bdHeaders || []).forEach(bd => {
      addNode(`BD:${bd.billing_document}`, 'BillingDocument', `Billing ${bd.billing_document}`, {
        amount: bd.total_net_amount,
        cancelled: bd.billing_document_is_cancelled === 'X',
        accountingDocument: bd.accounting_document,
      });
    });
    (bdItems || []).forEach(item => {
      if (item.reference_sd_document) {
        addEdge(`SO:${item.reference_sd_document}`, `BD:${item.billing_document}`, 'billed as');
      }
    });

    // Journal Entries
    const jeByAccDoc = {};
    (jeItems || []).forEach(je => {
      if (!jeByAccDoc[je.accounting_document]) {
        jeByAccDoc[je.accounting_document] = je;
        addNode(`JE:${je.accounting_document}`, 'JournalEntry', `JE ${je.accounting_document}`, {
          amount: je.amount_in_transaction_currency,
          customer: je.customer,
          billingDoc: je.reference_document,
        });
      }
    });
    (bdHeaders || []).forEach(bd => {
      if (bd.accounting_document && jeByAccDoc[bd.accounting_document]) {
        addEdge(`BD:${bd.billing_document}`, `JE:${bd.accounting_document}`, 'posted as');
      }
    });

    // Payments
    const seenPayments = new Set();
    (payments || []).forEach(p => {
      const pid = `PAY:${p.accounting_document}`;
      if (!seenPayments.has(pid)) {
        seenPayments.add(pid);
        addNode(pid, 'Payment', `Payment ${p.accounting_document}`, {
          amount: p.amount_in_transaction_currency,
          customer: p.customer,
        });
      }
      if (p.invoice_reference && jeByAccDoc[p.invoice_reference]) {
        addEdge(`JE:${p.invoice_reference}`, pid, 'cleared by');
      }
    });

    res.json({ nodes, edges });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// CHAT ENDPOINT
// ─────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
  const GROQ_MODEL = 'llama-3.3-70b-versatile';

  const callGroq = async (messages, temperature = 0.1, max_tokens = 1024) => {
    const r = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({ model: GROQ_MODEL, messages, temperature, max_tokens }),
    });
    const d = await r.json();
    console.log('GROQ RESPONSE:', JSON.stringify(d, null, 2));
    return d?.choices?.[0]?.message?.content || '';
  };

  try {
    // 1. Build message history for Groq
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map(h => ({
        role: h.role === 'assistant' || h.role === 'model' ? 'assistant' : 'user',
        content: h.content,
      })),
      { role: 'user', content: message },
    ];

    // 2. Ask Groq to generate SQL
    const rawText = await callGroq(messages, 0.1, 1024);

    if (!rawText) {
      return res.json({ answer: '⚠️ LLM returned empty response. Check your GROQ_API_KEY.', sql: null, results: null });
    }

    // 3. Parse JSON from response
    let parsed;
    try {
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return res.json({ answer: rawText, sql: null, results: null });
    }

    // 4. Off-topic guard
    if (parsed.type === 'off_topic') {
      return res.json({ answer: parsed.message, sql: null, results: null });
    }

    // 5. Execute SQL
    if (parsed.type === 'query' && parsed.sql) {
      const { data, error } = await supabase.rpc('execute_sql', { query: parsed.sql });

      if (error) {
        return res.json({
          answer: `❌ SQL execution failed: ${error.message}`,
          sql: parsed.sql,
          results: null,
        });
      }

      // 6. Summarize results
      const resultsStr = JSON.stringify(data?.slice(0, 20) || []);
      const summary = await callGroq([{
        role: 'user',
        content: `The user asked: "${message}"\n\nSQL: ${parsed.sql}\n\nResults: ${resultsStr}\n\nSummarize these results clearly and concisely. If empty, say so.`,
      }], 0.3, 512);

      return res.json({
        answer: summary || `Found ${data?.length || 0} result(s).`,
        sql: parsed.sql,
        results: data,
        explanation: parsed.explanation,
      });
    }

    return res.json({ answer: rawText, sql: null, results: null });

  } catch (err) {
    console.error('CHAT ERROR:', err);
    return res.json({ answer: '❌ Server error: ' + err.message, sql: null, results: null });
  }
});

// ─────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));