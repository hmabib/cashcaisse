/* ============================================================
   PAK RDLA – Caisse d'Avance 2026
   app.js — Core: State, Budget Config, Dashboard, Navigation
   ============================================================ */

// ── BUDGET CONFIGURATION ────────────────────────────────────
// Montants ARRONDIS – Budget annuel net ÷ 4 = dotation trimestrielle
const BUDGET_CONFIG = {
  annual_total: 18_000_000,       // Total annuel net (FCFA)
  quarterly_total: 4_500_000,     // Par trimestre = annual_total ÷ 4
  quarters: ['Q1','Q2','Q3','Q4'],
  quarter_periods: {
    Q1: 'Jan – Mar 2026',
    Q2: 'Avr – Jun 2026',
    Q3: 'Jul – Sep 2026',
    Q4: 'Oct – Déc 2026',
  },
  quarter_dates: {
    Q1: { start: '2026-01-01', end: '2026-03-31' },
    Q2: { start: '2026-04-01', end: '2026-06-30' },
    Q3: { start: '2026-07-01', end: '2026-09-30' },
    Q4: { start: '2026-10-01', end: '2026-12-31' },
  },
  lines: [
    {
      code: '624800',
      label_fr: 'Autres entretiens et réparations',
      label_en: 'Other repairs and maintenance',
      pa: 'PA 2026-RPPAK-RepDLA-5241001-624800',
      annual: 11_000_000,           // Budget annuel arrondi
      quarterly: 2_750_000,         // = 11 000 000 ÷ 4
    },
    {
      code: '627700',
      label_fr: 'Frais de colloques, séminaires, conférences',
      label_en: 'Conference, seminar and forum fees',
      pa: 'PA 2026-RPPAK-RepDLA-1218002-627700',
      annual: 4_000_000,            // Budget annuel arrondi
      quarterly: 1_000_000,         // = 4 000 000 ÷ 4
    },
    {
      code: '627710',
      label_fr: 'Frais de réception et de relations publiques',
      label_en: 'Reception and public relations fees',
      pa: 'PA 2026-RPPAK-RepDLA-1218001-627710',
      annual: 3_000_000,            // Budget annuel arrondi
      quarterly: 750_000,           // = 3 000 000 ÷ 4
    },
  ],
};

// ── FISCAL RATES ────────────────────────────────────────────
const FISCAL = {
  tva: 0.1925,          // TVA 19.25%
  air_simplified: 0.055, // AIR régime simplifié 5.5%
  air_real: 0.022,       // AIR régime réel 2.2%
  stamp_threshold: 25_000,
};

// ── APP STATE ───────────────────────────────────────────────
let APP = {
  lang: 'fr',
  currentQuarter: 'Q1',
  currentPage: 'dashboard',
  editingInvoiceId: null,
  selectedVerifInvoiceId: null,
  selectedDisbInvoiceId: null,
  invoiceFilter: 'all',
  sessionToken: null,
  user: null,
};

// ── REMOTE STATE KEYS ───────────────────────────────────────
const KEYS = {
  invoices:      'pak_rdla_invoices',
  suppliers:     'pak_rdla_suppliers',
  disbursements: 'pak_rdla_disbursements',
  replenishments:'pak_rdla_replenishments',
  journal:       'pak_rdla_journal',
  verifications: 'pak_rdla_verifications',
};

const SESSION_KEY = 'pak_rdla_session';
const AUDIT_PREFIX = 'pak_audit_checklist_';
let DATA_STORE = {};
const syncTimers = new Map();

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${APP.sessionToken || ''}`
  };
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed');
  }
  return payload;
}

function queueSync(key) {
  if (!APP.sessionToken) return;
  clearTimeout(syncTimers.get(key));
  const timeout = setTimeout(async () => {
    try {
      await apiRequest('/api/state', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ key, value: DATA_STORE[key] })
      });
    } catch (error) {
      console.error(`Failed to sync state key ${key}:`, error);
      toast(`Sync error on ${key}`, 'warning');
    }
  }, 200);
  syncTimers.set(key, timeout);
}

function setStoredSession(token) {
  APP.sessionToken = token || null;
  if (token) {
    localStorage.setItem(SESSION_KEY, token);
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

function setAuthenticatedLayout(isAuthenticated) {
  document.body.classList.toggle('logged-out', !isAuthenticated);
  document.body.classList.toggle('logged-in', isAuthenticated);
  const authScreen = document.getElementById('auth-screen');
  if (authScreen) authScreen.hidden = isAuthenticated;
}

function setCurrentUserUI() {
  const nameEl = document.getElementById('current-user-name');
  const roleEl = document.getElementById('current-user-role');
  if (!nameEl || !roleEl) return;
  if (!APP.user) {
    nameEl.textContent = 'Guest';
    roleEl.textContent = 'No role';
    return;
  }
  nameEl.textContent = `${APP.user.firstName} ${APP.user.lastName}`;
  roleEl.textContent = `${APP.user.role} • ${APP.user.email}`;
}

async function bootstrapState() {
  const data = await apiRequest('/api/bootstrap', {
    method: 'GET',
    headers: authHeaders()
  });
  DATA_STORE = data.state || {};
  APP.user = data.user || null;
  setCurrentUserUI();
}

async function restoreSession() {
  const token = localStorage.getItem(SESSION_KEY);
  if (!token) return false;
  setStoredSession(token);
  try {
    const session = await apiRequest('/api/auth/session', {
      method: 'GET',
      headers: authHeaders()
    });
    APP.user = session.user;
    setCurrentUserUI();
    return true;
  } catch {
    setStoredSession(null);
    APP.user = null;
    return false;
  }
}

async function loginUser() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');

  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }

  try {
    const result = await apiRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    setStoredSession(result.token);
    APP.user = result.user;
    setAuthenticatedLayout(true);
    await bootstrapState();
    refreshSupplierSelects();
    refreshCurrentPage();
    updateBadges();
  } catch (error) {
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = error.message;
    }
  }
}

function logoutUser() {
  setStoredSession(null);
  APP.user = null;
  DATA_STORE = {};
  setCurrentUserUI();
  setAuthenticatedLayout(false);
}

function getAuditStateKey(quarter) {
  return `${AUDIT_PREFIX}${quarter}`;
}

function getAuditChecklistState(quarter) {
  return store.get(getAuditStateKey(quarter), {});
}

function setAuditChecklistState(quarter, value) {
  store.set(getAuditStateKey(quarter), value);
}

// ── STORAGE HELPERS ─────────────────────────────────────────
const store = {
  get: (k, fallback = []) => clone(Object.prototype.hasOwnProperty.call(DATA_STORE, k) ? DATA_STORE[k] : fallback),
  set: (k, v) => {
    DATA_STORE[k] = clone(v);
    queueSync(k);
  },
  push: (k, obj) => { const arr = store.get(k); arr.push(obj); store.set(k, arr); },
  update: (k, id, upd) => {
    const arr = store.get(k);
    const i = arr.findIndex(x => x.id === id);
    if (i > -1) { arr[i] = { ...arr[i], ...upd }; store.set(k, arr); }
  },
  remove: (k, id) => {
    const arr = store.get(k).filter(x => x.id !== id);
    store.set(k, arr);
  },
};

// ── ID GENERATOR ────────────────────────────────────────────
let _seq = Date.now();
function genId() { return 'ID' + (++_seq).toString(36).toUpperCase(); }

// ── I18N ────────────────────────────────────────────────────
const TRANSLATIONS = {
  fr: {
    nav_overview: 'Vue Générale', nav_dashboard: 'Tableau de Bord',
    nav_budget_mgmt: 'Gestion Budgétaire', nav_budget: 'Lignes Budgétaires',
    nav_replenishment: 'Réapprovisionnement', nav_ops: 'Opérations',
    nav_invoices: 'Factures', nav_verification: 'Vérification',
    nav_disbursement: 'Décaissements', nav_accounting: 'Comptabilité',
    nav_suppliers: 'Fournisseurs', nav_audit: 'Audit & Documents',
    nav_documents: 'Documents Officiels', nav_guide: 'Guide',
    dash_sub: 'Vue d\'ensemble de la caisse d\'avance – Budget annuel & trimestriel',
    budget_consumption: 'Consommation par ligne budgétaire',
    annual_quarters: 'Calendrier Trimestriel 2026',
    budget_sub: 'Budget annuel 2026 – Division automatique en 4 trimestres égaux',
    budget_info: 'Budget annuel net : 18 000 000 FCFA | Dotation par trimestre : 4 500 000 FCFA | Réapprovisionnement : 4 fois par an',
    budget_annual: 'Budget Annuel & Trimestriel par Ligne',
    budget_detail: 'Détail par Trimestre & Ligne',
    label_period: 'Trimestre :', label_quarter: 'Trimestre',
    label_amount: 'Montant (FCFA)', label_date: 'Date',
    label_ref: 'Référence', label_notes: 'Observations',
    label_regime: 'Régime fiscal', label_input_type: 'Saisir à partir de',
    label_amount_input: 'Montant (FCFA)', label_amount_paid: 'Montant payé (NAP)',
    label_mode: 'Mode de paiement', label_label: 'Libellé de la dépense',
    from_ht: 'Montant HT', from_ttc: 'Montant TTC', from_nap: 'Net à Payer',
    regime_simplified: 'Régime Simplifié (AIR 5.5%)',
    regime_real: 'Régime Réel (AIR 2.2%)',
    mode_cash: 'Espèces', mode_transfer: 'Virement', mode_check: 'Chèque',
    th_ref: 'Référence', th_supplier: 'Fournisseur', th_line: 'Ligne',
    th_nap: 'Net à Payer', th_status: 'Statut', th_date: 'Date',
    th_ht: 'HT', th_tva: 'TVA', th_air: 'AIR', th_code: 'Code',
    th_label: 'Libellé', th_pa: 'Ligne PA', th_annual: 'Budget Annuel Net',
    th_quarterly: 'Budget Trimest. (÷4)', th_consumed: 'Engagé T. Courant',
    th_available: 'Disponible', th_pct: '%', th_quarter: 'Trim.',
    th_amount: 'Montant', th_compliance: 'Conformité', th_checklist: '✓ Liste',
    th_actions: 'Actions', th_mode: 'Mode', th_name: 'Raison Sociale',
    th_niu: 'NIU', th_regime: 'Régime', th_phone: 'Téléphone', th_valid: 'Valide',
    th_debit: 'Débit', th_credit: 'Crédit', th_balance: 'Solde', th_account: 'Compte',
    recent_invoices: 'Dernières Factures', see_all: 'Voir tout',
    no_invoice: 'Aucune facture enregistrée', no_pending: 'Aucune facture en attente',
    no_disbursement: 'Aucun décaissement', no_supplier: 'Aucun fournisseur',
    no_entries: 'Aucune écriture', tab_all: 'Toutes', tab_draft: 'Brouillon',
    tab_pending: 'En attente', tab_approved: 'Approuvées',
    tab_paid: 'Payées', tab_rejected: 'Rejetées',
    btn_new_invoice: 'Nouvelle Facture', btn_new_supplier: 'Nouveau Fournisseur',
    btn_save: 'Enregistrer', btn_cancel: 'Annuler', btn_print: 'Imprimer',
    btn_save_invoice: 'Enregistrer Facture', btn_save_verif: 'Sauvegarder',
    btn_approve: 'Approuver', btn_reject: 'Rejeter',
    btn_disburse: 'Enregistrer Décaissement',
    new_invoice_title: 'Nouvelle Facture', new_supplier_title: 'Nouveau Fournisseur',
    select_invoice: 'Sélectionner une facture',
    select_invoice_first: 'Sélectionnez une facture pour démarrer.',
    select_replen_first: 'Sélectionnez un approvisionnement pour prévisualiser.',
    checklist_title: 'Check-list de Conformité Facture',
    compliance_score: 'Score de Conformité', checked_items: 'Éléments validés',
    total_items: 'Éléments requis', score_pct: 'Score global',
    nap_calc_title: 'Calcul Net à Payer (NAP)', nap_result: 'Résultat du Calcul',
    nap_warning: '⚠️ Payer toujours le NET À PAYER, jamais le TTC. (Note N°025/2019)',
    replen_sub: '4 réapprovisionnements annuels de 4 500 000 FCFA chacun',
    replen_hint: 'Plafond fixe : 4 500 000 FCFA par trimestre',
    new_replen: 'Nouvelle Demande d\'Approvisionnement',
    replen_history: 'Historique des Approvisionnements',
    replen_bordereau: 'Bordereau de Mise à Disposition',
    verif_sub: 'Contrôle de conformité des pièces justificatives avant ordonnancement',
    verif_queue: 'File d\'Attente de Vérification',
    disb_sub: 'Enregistrement des paiements effectifs depuis la caisse',
    disb_history: 'Historique des Décaissements',
    new_disbursement: 'Nouveau Décaissement',
    bon_depense: 'Bon de Dépense',
    accounting_sub: 'Écritures comptables automatiques — Plan comptable PAK',
    journal_title: 'Journal de Caisse', balance_title: 'Balance Comptable',
    acc_kpi_physique: 'Solde Physique Caisse', acc_kpi_theorique: 'Solde Théorique',
    acc_kpi_total_debit: 'Total Débit', acc_kpi_total_credit: 'Total Crédit',
    suppliers_sub: 'Répertoire des prestataires agréés avec vérification NIU',
    audit_sub: 'Préparation des éléments pour la mission d\'audit trimestriel',
    audit_checklist: 'Check-list Mission d\'Audit',
    audit_anomalies: 'Anomalies Détectées',
    cash_count: 'Arrêté de Caisse',
    docs_sub: 'Génération et impression des documents officiels de la caisse d\'avance',
    doc_arrest: 'Arrêté de Caisse', doc_ordonnancement: 'Ordonnancement',
    doc_reception: 'PV de Réception', doc_audit_report: 'Rapport d\'Audit',
    budget_detail_title: 'Détail par Trimestre & Ligne',
    status_draft: 'Brouillon', status_pending: 'En attente',
    status_verified: 'Vérifié', status_approved: 'Approuvé',
    status_rejected: 'Rejeté', status_paid: 'Payé',
    status_replen_pending: 'Demandé', status_replen_received: 'Reçu',
    alert_over_budget: 'DÉPASSEMENT BUDGET',
    alert_near_budget: 'BUDGET QUASI ÉPUISÉ (>80%)',
    kpi_solde: 'Solde Caisse', kpi_budget: 'Budget T. Courant',
    kpi_engaged: 'Engagé', kpi_disbursed: 'Décaissé',
    kpi_available: 'Disponible', kpi_replenishments: 'Approvisionnements T.',
    topbar_dash: 'Tableau de Bord — Caisse d\'Avance',
    topbar_budget: 'Lignes Budgétaires — PAK RDLA 2026',
    topbar_replenishment: 'Réapprovisionnement Trimestriel',
    topbar_invoices: 'Gestion des Factures',
    topbar_verification: 'Vérification & Contrôle',
    topbar_disbursement: 'Décaissements',
    topbar_accounting: 'Journal de Caisse',
    topbar_suppliers: 'Fournisseurs',
    topbar_audit: 'Audit & Contrôle',
    topbar_documents: 'Documents Officiels',
    topbar_guide: 'Guide Utilisateur',
  },
  en: {
    nav_overview: 'Overview', nav_dashboard: 'Dashboard',
    nav_budget_mgmt: 'Budget Management', nav_budget: 'Budget Lines',
    nav_replenishment: 'Replenishment', nav_ops: 'Operations',
    nav_invoices: 'Invoices', nav_verification: 'Verification',
    nav_disbursement: 'Disbursements', nav_accounting: 'Accounting',
    nav_suppliers: 'Suppliers', nav_audit: 'Audit & Control',
    nav_documents: 'Official Documents', nav_guide: 'Guide',
    dash_sub: 'Imprest Fund Overview – Annual & Quarterly Budget',
    budget_consumption: 'Budget consumption by line',
    annual_quarters: 'Quarterly Calendar 2026',
    budget_sub: 'Annual Budget 2026 – Automatic quarterly split (÷4)',
    budget_info: 'Annual net budget: 18,000,000 FCFA | Quarterly allocation: 4,500,000 FCFA | Replenishment: 4 times per year',
    budget_annual: 'Annual & Quarterly Budget by Line',
    budget_detail: 'Quarterly & Line Detail',
    label_period: 'Quarter:', label_quarter: 'Quarter',
    label_amount: 'Amount (FCFA)', label_date: 'Date',
    label_ref: 'Reference', label_notes: 'Notes',
    label_regime: 'Tax regime', label_input_type: 'Calculate from',
    label_amount_input: 'Amount (FCFA)', label_amount_paid: 'Amount paid (NAP)',
    label_mode: 'Payment method', label_label: 'Expense description',
    from_ht: 'Pre-tax amount (HT)', from_ttc: 'Total incl. tax (TTC)', from_nap: 'Net payable (NAP)',
    regime_simplified: 'Simplified regime (WHT 5.5%)',
    regime_real: 'Real regime (WHT 2.2%)',
    mode_cash: 'Cash', mode_transfer: 'Bank transfer', mode_check: 'Cheque',
    th_ref: 'Reference', th_supplier: 'Supplier', th_line: 'Line',
    th_nap: 'Net Payable', th_status: 'Status', th_date: 'Date',
    th_ht: 'Pre-tax', th_tva: 'VAT', th_air: 'WHT', th_code: 'Code',
    th_label: 'Description', th_pa: 'PA Line', th_annual: 'Annual Net Budget',
    th_quarterly: 'Quarterly Budget (÷4)', th_consumed: 'Current Q. Engaged',
    th_available: 'Available', th_pct: '%', th_quarter: 'Quarter',
    th_amount: 'Amount', th_compliance: 'Compliance', th_checklist: '✓ List',
    th_actions: 'Actions', th_mode: 'Mode', th_name: 'Company Name',
    th_niu: 'Tax ID (NIU)', th_regime: 'Regime', th_phone: 'Phone', th_valid: 'Valid',
    th_debit: 'Debit', th_credit: 'Credit', th_balance: 'Balance', th_account: 'Account',
    recent_invoices: 'Recent Invoices', see_all: 'View all',
    no_invoice: 'No invoices recorded', no_pending: 'No pending invoices',
    no_disbursement: 'No disbursements', no_supplier: 'No suppliers',
    no_entries: 'No entries', tab_all: 'All', tab_draft: 'Draft',
    tab_pending: 'Pending', tab_approved: 'Approved',
    tab_paid: 'Paid', tab_rejected: 'Rejected',
    btn_new_invoice: 'New Invoice', btn_new_supplier: 'New Supplier',
    btn_save: 'Save', btn_cancel: 'Cancel', btn_print: 'Print',
    btn_save_invoice: 'Save Invoice', btn_save_verif: 'Save',
    btn_approve: 'Approve', btn_reject: 'Reject',
    btn_disburse: 'Record Disbursement',
    new_invoice_title: 'New Invoice', new_supplier_title: 'New Supplier',
    select_invoice: 'Select an invoice',
    select_invoice_first: 'Select an invoice to start.',
    select_replen_first: 'Select a replenishment to preview.',
    checklist_title: 'Invoice Compliance Checklist',
    compliance_score: 'Compliance Score', checked_items: 'Validated items',
    total_items: 'Required items', score_pct: 'Overall score',
    nap_calc_title: 'Net Payable Calculator', nap_result: 'Calculation Result',
    nap_warning: '⚠️ Always pay the NET PAYABLE amount, never TTC. (Directive N°025/2019)',
    replen_sub: '4 annual replenishments of 4,500,000 FCFA each',
    replen_hint: 'Fixed cap: 4,500,000 FCFA per quarter',
    new_replen: 'New Replenishment Request',
    replen_history: 'Replenishment History',
    replen_bordereau: 'Allocation Voucher',
    verif_sub: 'Compliance check of supporting documents before ordination',
    verif_queue: 'Verification Queue',
    disb_sub: 'Recording actual payments from the imprest fund',
    disb_history: 'Disbursement History',
    new_disbursement: 'New Disbursement',
    bon_depense: 'Expense Voucher',
    accounting_sub: 'Automatic accounting entries — PAK Chart of Accounts',
    journal_title: 'Cash Journal', balance_title: 'Trial Balance',
    acc_kpi_physique: 'Physical Cash Balance', acc_kpi_theorique: 'Theoretical Balance',
    acc_kpi_total_debit: 'Total Debit', acc_kpi_total_credit: 'Total Credit',
    suppliers_sub: 'Approved supplier directory with NIU verification',
    audit_sub: 'Preparation of elements for quarterly audit mission',
    audit_checklist: 'Audit Mission Checklist',
    audit_anomalies: 'Detected Anomalies',
    cash_count: 'Cash Count',
    docs_sub: 'Generation and printing of official imprest fund documents',
    doc_arrest: 'Cash Count', doc_ordonnancement: 'Ordination Sheet',
    doc_reception: 'Reception Report', doc_audit_report: 'Audit Report',
    budget_detail_title: 'Quarterly & Line Detail',
    status_draft: 'Draft', status_pending: 'Pending',
    status_verified: 'Verified', status_approved: 'Approved',
    status_rejected: 'Rejected', status_paid: 'Paid',
    status_replen_pending: 'Requested', status_replen_received: 'Received',
    alert_over_budget: 'BUDGET EXCEEDED',
    alert_near_budget: 'BUDGET NEARLY DEPLETED (>80%)',
    kpi_solde: 'Cash Balance', kpi_budget: 'Current Q. Budget',
    kpi_engaged: 'Engaged', kpi_disbursed: 'Disbursed',
    kpi_available: 'Available', kpi_replenishments: 'Q. Replenishments',
    topbar_dash: 'Dashboard — Imprest Fund',
    topbar_budget: 'Budget Lines — PAK RDLA 2026',
    topbar_replenishment: 'Quarterly Replenishment',
    topbar_invoices: 'Invoice Management',
    topbar_verification: 'Verification & Control',
    topbar_disbursement: 'Disbursements',
    topbar_accounting: 'Cash Journal',
    topbar_suppliers: 'Suppliers',
    topbar_audit: 'Audit & Control',
    topbar_documents: 'Official Documents',
    topbar_guide: 'User Guide',
  }
};

function t(key) {
  return TRANSLATIONS[APP.lang][key] || TRANSLATIONS.fr[key] || key;
}

function setLang(lang) {
  APP.lang = lang;
  document.getElementById('btn-fr').classList.toggle('active', lang === 'fr');
  document.getElementById('btn-en').classList.toggle('active', lang === 'en');
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const tr = t(key);
    if (tr) el.textContent = tr;
  });
  refreshCurrentPage();
}

// ── NAVIGATION ───────────────────────────────────────────────
const PAGE_TITLES = {
  dashboard: 'topbar_dash', budget: 'topbar_budget',
  replenishment: 'topbar_replenishment', invoices: 'topbar_invoices',
  verification: 'topbar_verification', disbursement: 'topbar_disbursement',
  accounting: 'topbar_accounting', suppliers: 'topbar_suppliers',
  audit: 'topbar_audit', documents: 'topbar_documents', guide: 'topbar_guide',
};

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pg = document.getElementById('page-' + page);
  if (pg) pg.classList.add('active');
  const nav = document.getElementById('nav-' + page);
  if (nav) nav.classList.add('active');
  APP.currentPage = page;
  const title = t(PAGE_TITLES[page] || 'nav_dashboard');
  document.getElementById('topbar-title').textContent = title;
  refreshCurrentPage();
}

function refreshCurrentPage() {
  switch(APP.currentPage) {
    case 'dashboard':     renderDashboard();     break;
    case 'budget':        renderBudgetPage();    break;
    case 'invoices':      renderInvoicesTable(); break;
    case 'verification':  renderVerifPage();     break;
    case 'disbursement':  renderDisbursement();  break;
    case 'accounting':    renderAccounting();    break;
    case 'suppliers':     renderSuppliers();     break;
    case 'audit':         renderAudit();         break;
    case 'documents':     renderDocuments();     break;
    case 'replenishment': renderReplenishment(); break;
    case 'guide':         renderGuide();         break;
  }
}

function changeQuarter(q) {
  APP.currentQuarter = q;
  refreshCurrentPage();
  const ql = document.getElementById('kpi-quarter-label');
  if (ql) ql.textContent = q + ' 2026';
}

// ── FORMATTERS ──────────────────────────────────────────────
function fmt(n) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA';
}

function fmtNum(n) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-FR').format(Math.round(n));
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR');
}

function fmtPct(n) {
  return Math.round(n) + '%';
}

// ── NAP CALCULATION ENGINE ───────────────────────────────────
function calcNAP(amount, inputType, regime) {
  const airRate = regime === 'real' ? FISCAL.air_real : FISCAL.air_simplified;
  let ht, ttc, tva, air, nap;

  if (inputType === 'ht') {
    ht  = amount;
    tva = ht * FISCAL.tva;
    ttc = ht + tva;
    air = ht * airRate;
    nap = ttc - air;
  } else if (inputType === 'ttc') {
    ttc = amount;
    ht  = ttc / (1 + FISCAL.tva);
    tva = ht * FISCAL.tva;
    air = ht * airRate;
    nap = ttc - air;
  } else { // from nap
    // nap = ttc - air = ht*(1+tva) - ht*air = ht*(1+tva-air)
    const factor = 1 + FISCAL.tva - airRate;
    ht  = amount / factor;
    tva = ht * FISCAL.tva;
    ttc = ht + tva;
    air = ht * airRate;
    nap = amount;
  }
  return { ht: Math.round(ht), tva: Math.round(tva), ttc: Math.round(ttc), air: Math.round(air), nap: Math.round(nap), airRate };
}

// ── BUDGET HELPERS ──────────────────────────────────────────
function getLineConfig(code) {
  return BUDGET_CONFIG.lines.find(l => l.code === code);
}

function getConsumedByLineAndQuarter(code, quarter) {
  const invoices = store.get(KEYS.invoices);
  return invoices
    .filter(inv => inv.line === code && inv.quarter === quarter && ['approved','paid'].includes(inv.status))
    .reduce((s, inv) => s + (inv.nap || 0), 0);
}

function getDisbursedByLineAndQuarter(code, quarter) {
  const disb = store.get(KEYS.disbursements);
  const invoices = store.get(KEYS.invoices);
  return disb
    .filter(d => {
      const inv = invoices.find(i => i.id === d.invoiceId);
      return inv && inv.line === code && inv.quarter === quarter;
    })
    .reduce((s, d) => s + (d.amount || 0), 0);
}

function getTotalDisbursedForQuarter(quarter) {
  const disb = store.get(KEYS.disbursements);
  const invoices = store.get(KEYS.invoices);
  return disb.filter(d => {
    const inv = invoices.find(i => i.id === d.invoiceId);
    return inv && inv.quarter === quarter;
  }).reduce((s,d) => s + (d.amount||0), 0);
}

function getReplenReceived(quarter) {
  return store.get(KEYS.replenishments)
    .filter(r => r.quarter === quarter && r.status === 'received')
    .reduce((s,r) => s + (r.amount||0), 0);
}

function getCashBalance() {
  const allReplen  = store.get(KEYS.replenishments).filter(r => r.status === 'received').reduce((s,r)=>s+(r.amount||0),0);
  const allDisb    = store.get(KEYS.disbursements).reduce((s,d)=>s+(d.amount||0),0);
  return allReplen - allDisb;
}

function checkBudgetExceed(code, quarter, newNap, excludeId) {
  const cfg = getLineConfig(code);
  if (!cfg) return false;
  const invoices = store.get(KEYS.invoices);
  const already = invoices
    .filter(i => i.line === code && i.quarter === quarter && ['approved','paid','pending','verified'].includes(i.status) && i.id !== excludeId)
    .reduce((s,i) => s + (i.nap||0), 0);
  return (already + newNap) > cfg.quarterly;
}

// ── STATUS HELPERS ──────────────────────────────────────────
function statusBadge(status) {
  const map = {
    draft:    ['badge-draft',    '✏️ ' + t('status_draft')],
    pending:  ['badge-pending',  '⏳ ' + t('status_pending')],
    verified: ['badge-verified', '✔ '  + t('status_verified')],
    approved: ['badge-approved', '✅ ' + t('status_approved')],
    rejected: ['badge-rejected', '❌ ' + t('status_rejected')],
    paid:     ['badge-paid',     '💰 ' + t('status_paid')],
  };
  const [cls, label] = map[status] || ['badge-draft','—'];
  return `<span class="badge ${cls}">${label}</span>`;
}

// ── TOAST ────────────────────────────────────────────────────
function toast(msg, type='success') {
  const c = document.getElementById('toast-container');
  const d = document.createElement('div');
  d.className = `toast ${type}`;
  d.innerHTML = `<i class="fas fa-${type==='error'?'times-circle':type==='warning'?'exclamation-triangle':'check-circle'}"></i> ${msg}`;
  c.appendChild(d);
  setTimeout(() => d.remove(), 3500);
}

// ── MODAL ────────────────────────────────────────────────────
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// ── DASHBOARD RENDERER ───────────────────────────────────────
function renderDashboard() {
  const q = APP.currentQuarter;
  const qLabel = q + ' 2026';
  const el = document.getElementById('kpi-quarter-label');
  if (el) el.textContent = qLabel;

  // ─ KPIs ─
  const engaged    = BUDGET_CONFIG.lines.reduce((s,l) => s + getConsumedByLineAndQuarter(l.code, q), 0);
  const disbursed  = getTotalDisbursedForQuarter(q);
  const qBudget    = BUDGET_CONFIG.quarterly_total;
  const available  = qBudget - engaged;
  const cashBal    = getCashBalance();
  const replenRcv  = getReplenReceived(q);

  const kpiEl = document.getElementById('kpi-global');
  if (!kpiEl) return;
  kpiEl.innerHTML = `
    <div class="kpi-card primary">
      <div class="kpi-label">${t('kpi_solde')}</div>
      <div class="kpi-value">${fmt(cashBal)}</div>
      <div class="kpi-sub">Toutes périodes confondues</div>
    </div>
    <div class="kpi-card secondary">
      <div class="kpi-label">${t('kpi_budget')} — ${q}</div>
      <div class="kpi-value">${fmt(qBudget)}</div>
      <div class="kpi-sub">${fmt(BUDGET_CONFIG.annual_total)} / an</div>
    </div>
    <div class="kpi-card accent">
      <div class="kpi-label">${t('kpi_engaged')}</div>
      <div class="kpi-value">${fmt(engaged)}</div>
      <div class="kpi-sub">${fmtPct(qBudget>0?engaged/qBudget*100:0)} du budget</div>
    </div>
    <div class="kpi-card ${available < 0 ? 'danger' : available < qBudget*0.2 ? 'warning' : 'success'}">
      <div class="kpi-label">${t('kpi_available')}</div>
      <div class="kpi-value">${fmt(available)}</div>
      <div class="kpi-sub">${available < 0 ? '⚠️ DÉPASSEMENT' : 'Disponible ce trimestre'}</div>
    </div>
    <div class="kpi-card light">
      <div class="kpi-label">${t('kpi_disbursed')}</div>
      <div class="kpi-value">${fmt(disbursed)}</div>
      <div class="kpi-sub">Décaissé ${q}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">${t('kpi_replenishments')}</div>
      <div class="kpi-value">${fmt(replenRcv)}</div>
      <div class="kpi-sub">Reçu ${q}</div>
    </div>
  `;

  // ─ Budget Bars ─
  const bbEl = document.getElementById('budget-bars');
  if (bbEl) {
    bbEl.innerHTML = BUDGET_CONFIG.lines.map(line => {
      const consumed = getConsumedByLineAndQuarter(line.code, q);
      const pct = Math.min(100, line.quarterly > 0 ? consumed / line.quarterly * 100 : 0);
      const cls = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : '';
      return `
        <div class="budget-line">
          <div class="budget-line-header">
            <div class="budget-line-name">${line.code} – ${APP.lang==='en'?line.label_en:line.label_fr}</div>
            <div class="budget-line-values">${fmt(consumed)} / <strong>${fmt(line.quarterly)}</strong></div>
          </div>
          <div class="progress-bar"><div class="progress-fill ${cls}" style="width:${pct}%"></div></div>
          <div class="mt-4 text-xs text-muted">${fmtPct(pct)} engagé — Disponible : ${fmt(line.quarterly - consumed)}</div>
        </div>`;
    }).join('');
  }

  // ─ Quarterly Cards ─
  const qcEl = document.getElementById('quarter-cards');
  if (qcEl) {
    qcEl.innerHTML = BUDGET_CONFIG.quarters.map(qr => {
      const repln = getReplenReceived(qr);
      const dsbQ  = getTotalDisbursedForQuarter(qr);
      const isCurrent = qr === q;
      return `
        <div class="quarter-card ${isCurrent ? 'current' : ''}">
          <div class="quarter-title">${qr.replace('Q','T')}</div>
          <div class="quarter-period">${BUDGET_CONFIG.quarter_periods[qr]}</div>
          <div class="quarter-amount">${fmtNum(BUDGET_CONFIG.quarterly_total)}</div>
          <div class="quarter-currency">FCFA dotation</div>
          <div class="divider"></div>
          <div class="text-xs text-muted mt-4">Reçu : <strong>${fmt(repln)}</strong></div>
          <div class="text-xs text-muted">Décaissé : <strong>${fmt(dsbQ)}</strong></div>
          <div class="text-xs mt-4"><strong>Solde : ${fmt(repln - dsbQ)}</strong></div>
        </div>`;
    }).join('');
  }

  // ─ Alerts ─
  const alertEl = document.getElementById('alerts-section');
  if (alertEl) {
    const alerts = [];
    BUDGET_CONFIG.lines.forEach(line => {
      const consumed = getConsumedByLineAndQuarter(line.code, q);
      const pct = line.quarterly > 0 ? consumed / line.quarterly * 100 : 0;
      if (pct >= 100) {
        alerts.push(`<div class="alert alert-danger"><i class="fas fa-exclamation-triangle"></i> ${t('alert_over_budget')} – Ligne ${line.code} : ${fmt(consumed)} / ${fmt(line.quarterly)}</div>`);
      } else if (pct >= 80) {
        alerts.push(`<div class="alert alert-warning"><i class="fas fa-exclamation-triangle"></i> ${t('alert_near_budget')} – Ligne ${line.code} : ${fmtPct(pct)}</div>`);
      }
    });
    alertEl.innerHTML = alerts.join('');
  }

  // ─ Recent Invoices ─
  renderRecentInvoices();
}

function renderRecentInvoices() {
  const tbody = document.getElementById('recent-invoices-body');
  if (!tbody) return;
  const invoices = store.get(KEYS.invoices).slice(-8).reverse();
  if (!invoices.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="td-center text-muted" style="padding:20px">${t('no_invoice')}</td></tr>`;
    return;
  }
  tbody.innerHTML = invoices.map(inv => `
    <tr>
      <td>${inv.ref || '—'}</td>
      <td>${getSupplierName(inv.supplierId)}</td>
      <td><span class="badge badge-pending" style="font-size:0.65rem">${inv.line}</span></td>
      <td class="td-right">${fmt(inv.nap)}</td>
      <td>${statusBadge(inv.status)}</td>
      <td>${fmtDate(inv.date)}</td>
    </tr>`).join('');
}

// ── BUDGET PAGE ─────────────────────────────────────────────
function renderBudgetPage() {
  const q = APP.currentQuarter;
  const tbody = document.getElementById('budget-lines-body');
  const tfoot = document.getElementById('budget-lines-foot');
  if (!tbody) return;

  let totalAnnual = 0, totalQuarterly = 0, totalConsumed = 0;

  tbody.innerHTML = BUDGET_CONFIG.lines.map(line => {
    const consumed  = getConsumedByLineAndQuarter(line.code, q);
    const available = line.quarterly - consumed;
    const pct = line.quarterly > 0 ? Math.round(consumed / line.quarterly * 100) : 0;
    const cls = pct >= 100 ? 'text-danger fw-bold' : pct >= 80 ? '' : '';
    totalAnnual    += line.annual;
    totalQuarterly += line.quarterly;
    totalConsumed  += consumed;
    return `
      <tr>
        <td><strong>${line.code}</strong></td>
        <td>${APP.lang==='en'?line.label_en:line.label_fr}</td>
        <td class="text-xs text-muted">${line.pa}</td>
        <td class="td-right fw-bold">${fmt(line.annual)}</td>
        <td class="td-right fw-bold text-accent">${fmt(line.quarterly)}</td>
        <td class="td-right ${cls}">${fmt(consumed)}</td>
        <td class="td-right ${available<0?'text-danger fw-bold':''}">${fmt(available)}</td>
        <td class="td-center">
          <div style="display:flex;align-items:center;gap:6px">
            <div class="progress-bar" style="flex:1;min-width:60px"><div class="progress-fill ${pct>=100?'danger':pct>=80?'warning':''}" style="width:${Math.min(100,pct)}%"></div></div>
            <span class="${cls}">${pct}%</span>
          </div>
        </td>
      </tr>`;
  }).join('');

  if (tfoot) {
    tfoot.innerHTML = `
      <tr style="background:var(--pak-primary);color:white;font-weight:800">
        <td colspan="3">TOTAL</td>
        <td class="td-right">${fmt(totalAnnual)}</td>
        <td class="td-right">${fmt(totalQuarterly)}</td>
        <td class="td-right">${fmt(totalConsumed)}</td>
        <td class="td-right">${fmt(totalQuarterly - totalConsumed)}</td>
        <td class="td-center">${Math.round(totalQuarterly>0?totalConsumed/totalQuarterly*100:0)}%</td>
      </tr>`;
  }

  // Detail grid
  const detailEl = document.getElementById('budget-detail-grid');
  if (detailEl) {
    detailEl.innerHTML = `
      <div style="overflow-x:auto">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Libellé</th>
              ${BUDGET_CONFIG.quarters.map(qr=>`<th class="td-right">${qr.replace('Q','T')} (${fmt(BUDGET_CONFIG.quarterly_total).replace(' FCFA','')})</th>`).join('')}
              <th class="td-right">Total Annuel</th>
            </tr>
          </thead>
          <tbody>
            ${BUDGET_CONFIG.lines.map(line => `
              <tr>
                <td><strong>${line.code}</strong></td>
                <td>${APP.lang==='en'?line.label_en:line.label_fr}</td>
                ${BUDGET_CONFIG.quarters.map(qr => {
                  const c = getConsumedByLineAndQuarter(line.code, qr);
                  const pct = Math.round(line.quarterly>0?c/line.quarterly*100:0);
                  return `<td class="td-right">
                    <div>${fmt(line.quarterly)}</div>
                    <div class="text-xs ${pct>=100?'text-danger':pct>=80?'':'text-muted'}">${fmt(c)} (${pct}%)</div>
                  </td>`;
                }).join('')}
                <td class="td-right fw-bold">${fmt(line.annual)}</td>
              </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr style="background:var(--pak-lightest);font-weight:700">
              <td colspan="2">TOTAL par trimestre</td>
              ${BUDGET_CONFIG.quarters.map(() => `<td class="td-right">${fmt(BUDGET_CONFIG.quarterly_total)}</td>`).join('')}
              <td class="td-right">${fmt(BUDGET_CONFIG.annual_total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>`;
  }
}

// ── SUPPLIER HELPERS ─────────────────────────────────────────
function getSupplierName(id) {
  if (!id) return '—';
  const s = store.get(KEYS.suppliers).find(x => x.id === id);
  return s ? s.name : '—';
}

function getSupplierRegime(id) {
  if (!id) return 'simplified';
  const s = store.get(KEYS.suppliers).find(x => x.id === id);
  return s ? (s.regime || 'simplified') : 'simplified';
}

function renderSuppliers() {
  const tbody = document.getElementById('suppliers-body');
  if (!tbody) return;
  const suppliers = store.get(KEYS.suppliers);
  if (!suppliers.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="td-center text-muted" style="padding:20px">${t('no_supplier')}</td></tr>`;
    return;
  }
  tbody.innerHTML = suppliers.map(s => `
    <tr>
      <td><strong>${s.name}</strong></td>
      <td>${s.niu || '—'}</td>
      <td>${s.regime === 'real' ? 'Réel (2.2%)' : 'Simplifié (5.5%)'}</td>
      <td>${s.phone || '—'}</td>
      <td class="td-center">${s.niu && s.niu.length >= 12 ? '<span class="badge badge-verified">✓ Valide</span>' : '<span class="badge badge-rejected">⚠ À vérifier</span>'}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-sm btn-outline btn-icon" onclick="editSupplier('${s.id}')" title="Modifier"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-danger btn-icon" onclick="deleteSupplier('${s.id}')" title="Supprimer"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

// ── SUPPLIER MODAL ──────────────────────────────────────────
function openSupplierModal(id) {
  const modal = document.getElementById('supplier-modal');
  if (id) {
    const s = store.get(KEYS.suppliers).find(x => x.id === id);
    if (s) {
      document.getElementById('sup-name').value    = s.name;
      document.getElementById('sup-niu').value     = s.niu || '';
      document.getElementById('sup-regime').value  = s.regime || 'simplified';
      document.getElementById('sup-phone').value   = s.phone || '';
      document.getElementById('sup-email').value   = s.email || '';
      document.getElementById('sup-address').value = s.address || '';
      modal.dataset.editId = id;
    }
  } else {
    ['sup-name','sup-niu','sup-phone','sup-email','sup-address'].forEach(i => document.getElementById(i).value = '');
    document.getElementById('sup-regime').value = 'simplified';
    delete modal.dataset.editId;
  }
  modal.classList.add('open');
}

function saveSupplier() {
  const name = document.getElementById('sup-name').value.trim();
  const niu  = document.getElementById('sup-niu').value.trim();
  if (!name) { toast('Veuillez saisir la raison sociale.', 'error'); return; }
  const modal = document.getElementById('supplier-modal');
  const editId = modal.dataset.editId;
  const obj = {
    name, niu,
    regime:  document.getElementById('sup-regime').value,
    phone:   document.getElementById('sup-phone').value.trim(),
    email:   document.getElementById('sup-email').value.trim(),
    address: document.getElementById('sup-address').value.trim(),
  };
  if (editId) {
    store.update(KEYS.suppliers, editId, obj);
    toast('Fournisseur mis à jour.', 'success');
  } else {
    store.push(KEYS.suppliers, { id: genId(), createdAt: new Date().toISOString(), ...obj });
    toast('Fournisseur enregistré.', 'success');
  }
  closeModal('supplier-modal');
  renderSuppliers();
  refreshSupplierSelects();
}

function deleteSupplier(id) {
  if (!confirm('Supprimer ce fournisseur ?')) return;
  store.remove(KEYS.suppliers, id);
  renderSuppliers();
  toast('Fournisseur supprimé.');
}

function editSupplier(id) {
  openSupplierModal(id);
}

function refreshSupplierSelects() {
  const suppliers = store.get(KEYS.suppliers);
  const opts = '<option value="">-- Sélectionner --</option>' + suppliers.map(s =>
    `<option value="${s.id}">${s.name}</option>`).join('');
  ['inv-supplier'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
}

// ── INVOICE MODAL OPEN ───────────────────────────────────────
function openInvoiceModal(id) {
  APP.editingInvoiceId = id || null;
  refreshSupplierSelects();
  if (id) {
    const inv = store.get(KEYS.invoices).find(x => x.id === id);
    if (inv) {
      document.getElementById('inv-ref').value        = inv.ref || '';
      document.getElementById('inv-supplier').value   = inv.supplierId || '';
      document.getElementById('inv-line').value       = inv.line || '624800';
      document.getElementById('inv-quarter').value    = inv.quarter || APP.currentQuarter;
      document.getElementById('inv-date').value       = inv.date || '';
      document.getElementById('inv-regime').value     = inv.regime || 'simplified';
      document.getElementById('inv-input-type').value = 'nap';
      document.getElementById('inv-amount').value     = inv.nap || '';
      document.getElementById('inv-label').value      = inv.label || '';
      document.getElementById('inv-notes').value      = inv.notes || '';
      document.getElementById('invoice-modal-title').textContent = 'Modifier Facture';
      calcInvNAP();
    }
  } else {
    ['inv-ref','inv-amount','inv-label','inv-notes'].forEach(i => document.getElementById(i).value = '');
    document.getElementById('inv-line').value       = '624800';
    document.getElementById('inv-quarter').value    = APP.currentQuarter;
    document.getElementById('inv-date').value       = new Date().toISOString().split('T')[0];
    document.getElementById('inv-regime').value     = 'simplified';
    document.getElementById('inv-input-type').value = 'ht';
    document.getElementById('invoice-modal-title').textContent = t('new_invoice_title');
    document.getElementById('inv-nap-box').innerHTML = `<div class="nap-calc-title">Calcul automatique NAP</div>
      <div class="nap-row"><span class="nap-label">HT</span><span class="nap-val" id="inv-res-ht">—</span></div>
      <div class="nap-row"><span class="nap-label">TVA 19.25%</span><span class="nap-val" id="inv-res-tva">—</span></div>
      <div class="nap-row"><span class="nap-label" id="inv-res-air-label">AIR 5.5%</span><span class="nap-val" id="inv-res-air">—</span></div>
      <div class="nap-row"><span class="nap-label">TTC</span><span class="nap-val" id="inv-res-ttc">—</span></div>
      <div class="nap-row nap-total"><span class="nap-label">NET À PAYER</span><span class="nap-val" id="inv-res-nap">—</span></div>`;
  }
  document.getElementById('budget-warning-modal').innerHTML = '';
  document.getElementById('invoice-modal').classList.add('open');
}

function calcInvNAP() {
  const amount = parseFloat(document.getElementById('inv-amount').value) || 0;
  const regime = document.getElementById('inv-regime').value;
  const type   = document.getElementById('inv-input-type').value;
  if (!amount) return;
  const r = calcNAP(amount, type, regime);
  setEl('inv-res-ht',  fmt(r.ht));
  setEl('inv-res-tva', fmt(r.tva));
  setEl('inv-res-air', fmt(r.air));
  setEl('inv-res-ttc', fmt(r.ttc));
  setEl('inv-res-nap', fmt(r.nap));
  setEl('inv-res-air-label', `AIR ${r.airRate*100}%`);
  checkBudgetOnSelect();
}

function checkBudgetOnSelect() {
  const code    = document.getElementById('inv-line').value;
  const quarter = document.getElementById('inv-quarter').value;
  const amount  = parseFloat(document.getElementById('inv-amount').value) || 0;
  const regime  = document.getElementById('inv-regime').value;
  const type    = document.getElementById('inv-input-type').value;
  if (!amount || !code) return;
  const r = calcNAP(amount, type, regime);
  const warn = document.getElementById('budget-warning-modal');
  if (warn) {
    if (checkBudgetExceed(code, quarter, r.nap, APP.editingInvoiceId)) {
      const cfg = getLineConfig(code);
      const already = getConsumedByLineAndQuarter(code, quarter);
      warn.innerHTML = `<div class="alert alert-danger"><i class="fas fa-ban"></i> ⚠️ DÉPASSEMENT BUDGÉTAIRE — Ligne ${code} — Budget ${quarter} : ${fmt(cfg.quarterly)} | Déjà engagé : ${fmt(already)} | NAP facture : ${fmt(r.nap)}</div>`;
    } else {
      warn.innerHTML = '';
    }
  }
}

function setEl(id, val) {
  const e = document.getElementById(id);
  if (e) e.textContent = val;
}

// ── SAVE INVOICE ─────────────────────────────────────────────
function saveInvoice() {
  const ref      = document.getElementById('inv-ref').value.trim();
  const supId    = document.getElementById('inv-supplier').value;
  const line     = document.getElementById('inv-line').value;
  const quarter  = document.getElementById('inv-quarter').value;
  const date     = document.getElementById('inv-date').value;
  const regime   = document.getElementById('inv-regime').value;
  const type     = document.getElementById('inv-input-type').value;
  const amount   = parseFloat(document.getElementById('inv-amount').value) || 0;
  const label    = document.getElementById('inv-label').value.trim();
  const notes    = document.getElementById('inv-notes').value.trim();

  if (!ref) { toast('Veuillez saisir le numéro de facture.', 'error'); return; }
  if (!amount) { toast('Veuillez saisir un montant.', 'error'); return; }

  const r = calcNAP(amount, type, regime);
  const newNap = r.nap;

  if (checkBudgetExceed(line, quarter, newNap, APP.editingInvoiceId)) {
    if (!confirm('⚠️ Ce montant dépasse le budget trimestriel disponible pour cette ligne. Continuer quand même ?')) return;
  }

  const obj = { ref, supplierId: supId, line, quarter, date, regime,
    ht: r.ht, tva: r.tva, air: r.air, ttc: r.ttc, nap: r.nap,
    label, notes, status: 'draft',
    checklist: initChecklist(),
    createdAt: new Date().toISOString() };

  if (APP.editingInvoiceId) {
    const old = store.get(KEYS.invoices).find(i => i.id === APP.editingInvoiceId);
    store.update(KEYS.invoices, APP.editingInvoiceId, { ...obj, status: old ? old.status : 'draft', checklist: old ? old.checklist : initChecklist() });
    toast('Facture mise à jour.');
  } else {
    store.push(KEYS.invoices, { id: genId(), ...obj });
    toast('Facture enregistrée.');
  }
  closeModal('invoice-modal');
  renderInvoicesTable();
  updateBadges();
}

// ── CHECKLIST INIT ───────────────────────────────────────────
function initChecklist() {
  return [
    { id:'niu',     label_fr:'NIU valide et conforme',         label_en:'Valid Tax ID (NIU)',              checked:false, required:true },
    { id:'address', label_fr:'Facture adressée au PAK',        label_en:'Invoice addressed to PAK',        checked:false, required:true },
    { id:'stamp',   label_fr:'Timbre fiscal (si > 25 000)',    label_en:'Fiscal stamp (if > 25,000)',       checked:false, required:false },
    { id:'libelle', label_fr:'Libellé précis et complet',      label_en:'Clear and complete description',  checked:false, required:true },
    { id:'amounts', label_fr:'Concordance chiffres & lettres', label_en:'Figures and words match',         checked:false, required:true },
    { id:'tva',     label_fr:'Détail TVA correct (19.25%)',    label_en:'Correct VAT detail (19.25%)',     checked:false, required:true },
    { id:'pvrecep', label_fr:'PV de réception signé',          label_en:'Signed reception report',         checked:false, required:true },
    { id:'auth',    label_fr:'Autorisation de dépense signée', label_en:'Signed expense authorisation',    checked:false, required:true },
  ];
}

// ── BADGES ──────────────────────────────────────────────────
function updateBadges() {
  const pending = store.get(KEYS.invoices).filter(i => ['draft','pending','verified'].includes(i.status)).length;
  const el = document.getElementById('badge-pending-invoices');
  if (el) el.textContent = pending || '0';
}

// ── NAP CALCULATOR PAGE ─────────────────────────────────────
function recalcNAP() {
  const amount = parseFloat(document.getElementById('nap-input-amount').value) || 0;
  const regime = document.getElementById('nap-regime').value;
  const type   = document.getElementById('nap-input-type').value;
  if (!amount) {
    ['res-ht','res-tva','res-air','res-ttc','res-nap'].forEach(id => setEl(id,'—'));
    return;
  }
  const r = calcNAP(amount, type, regime);
  setEl('res-ht',  fmt(r.ht));
  setEl('res-tva', fmt(r.tva));
  setEl('res-air', fmt(r.air));
  setEl('res-ttc', fmt(r.ttc));
  setEl('res-nap', fmt(r.nap));
  setEl('res-air-label', `AIR (${r.airRate*100}%)`);
}

function renderGuide() {
  setCurrentUserUI();
}

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Set today's date
  document.getElementById('topbar-date').textContent = new Date().toLocaleDateString('fr-FR',{weekday:'short',year:'numeric',month:'short',day:'numeric'});

  // Set current quarter based on current month
  const now = new Date();
  const month = now.getMonth() + 1;
  const autoQ = month <= 3 ? 'Q1' : month <= 6 ? 'Q2' : month <= 9 ? 'Q3' : 'Q4';
  APP.currentQuarter = autoQ;
  document.getElementById('current-quarter-select').value = autoQ;

  setAuthenticatedLayout(false);
  setCurrentUserUI();

  const hasSession = await restoreSession();
  if (!hasSession) return;

  setAuthenticatedLayout(true);
  await bootstrapState();
  refreshSupplierSelects();
  renderDashboard();
  updateBadges();
});
