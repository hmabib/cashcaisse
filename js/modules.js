/* ============================================================
   PAK RDLA – Caisse d'Avance 2026
   modules.js — Invoices, Verification, Disbursements
   ============================================================ */

// ══════════════════════════════════════════════════════════════
// MODULE 1 : INVOICES
// ══════════════════════════════════════════════════════════════

function renderInvoicesTable() {
  const tbody = document.getElementById('invoices-body');
  if (!tbody) return;

  let invoices = store.get(KEYS.invoices);
  const filter = APP.invoiceFilter || 'all';

  if (filter !== 'all') invoices = invoices.filter(i => i.status === filter);

  // Highlight active tab
  document.querySelectorAll('#invoice-tabs .tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${filter}'`));
  });

  // Refresh invoice selects for other modules
  refreshInvoiceSelects();
  updateBadges();

  if (!invoices.length) {
    tbody.innerHTML = `<tr><td colspan="11" class="td-center text-muted" style="padding:20px">${t('no_invoice')}</td></tr>`;
    return;
  }

  tbody.innerHTML = invoices.map(inv => {
    const supplierName = getSupplierName(inv.supplierId);
    const checked  = (inv.checklist || []).filter(c => c.checked).length;
    const total    = (inv.checklist || []).length;
    const pctCheck = total > 0 ? Math.round(checked / total * 100) : 0;
    const checkCls = pctCheck >= 100 ? 'badge-verified' : pctCheck > 50 ? 'badge-pending' : 'badge-draft';

    return `
      <tr>
        <td><strong>${inv.ref || '—'}</strong></td>
        <td>${supplierName}</td>
        <td><span class="badge badge-pending" style="font-size:0.65rem">${inv.line}</span></td>
        <td class="td-center">${inv.quarter || '—'}</td>
        <td class="td-right">${fmt(inv.ht)}</td>
        <td class="td-right text-muted">${fmt(inv.tva)}</td>
        <td class="td-right text-muted">${fmt(inv.air)}</td>
        <td class="td-right fw-bold" style="color:var(--pak-primary)">${fmt(inv.nap)}</td>
        <td>${statusBadge(inv.status)}</td>
        <td class="td-center">
          <span class="badge ${checkCls}" style="font-size:0.65rem">${checked}/${total}</span>
        </td>
        <td>
          <div class="btn-group">
            <button class="btn btn-sm btn-outline btn-icon" onclick="openInvoiceModal('${inv.id}')" title="Modifier"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm btn-accent btn-icon" onclick="openVerifForInvoice('${inv.id}')" title="Vérifier"><i class="fas fa-check-double"></i></button>
            ${inv.status === 'approved' ? `<button class="btn btn-sm btn-primary btn-icon" onclick="openDisbForInvoice('${inv.id}')" title="Décaisser"><i class="fas fa-money-bill-wave"></i></button>` : ''}
            <button class="btn btn-sm btn-danger btn-icon" onclick="deleteInvoice('${inv.id}')" title="Supprimer"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function filterInvoices(status) {
  APP.invoiceFilter = status;
  renderInvoicesTable();
}

function deleteInvoice(id) {
  if (!confirm('Supprimer cette facture ?')) return;
  store.remove(KEYS.invoices, id);
  renderInvoicesTable();
  toast('Facture supprimée.');
}

function openVerifForInvoice(id) {
  APP.selectedVerifInvoiceId = id;
  showPage('verification');
  setTimeout(() => {
    const sel = document.getElementById('verif-invoice-select');
    if (sel) { sel.value = id; loadVerifChecklist(id); }
  }, 100);
}

function openDisbForInvoice(id) {
  APP.selectedDisbInvoiceId = id;
  showPage('disbursement');
  setTimeout(() => {
    const sel = document.getElementById('disb-invoice-select');
    if (sel) { sel.value = id; loadDisbAmount(id); }
  }, 100);
}

// Invoice selects for verification, disbursement, documents
function refreshInvoiceSelects() {
  const invoices = store.get(KEYS.invoices);

  // Verif select — all non-rejected
  const verifOpts = '<option value="">-- Choisir --</option>' +
    invoices.filter(i => !['rejected','paid'].includes(i.status)).map(i =>
      `<option value="${i.id}">[${i.status.toUpperCase()}] ${i.ref} — ${getSupplierName(i.supplierId)} — ${fmt(i.nap)}</option>`).join('');
  ['verif-invoice-select'].forEach(id => {
    const el = document.getElementById(id); if (el) el.innerHTML = verifOpts;
  });

  // Disb select — approved only
  const disbOpts = '<option value="">-- Sélectionner une facture approuvée --</option>' +
    invoices.filter(i => i.status === 'approved').map(i =>
      `<option value="${i.id}">${i.ref} — ${getSupplierName(i.supplierId)} — ${fmt(i.nap)}</option>`).join('');
  ['disb-invoice-select'].forEach(id => {
    const el = document.getElementById(id); if (el) el.innerHTML = disbOpts;
  });

  // Document selects
  const allOpts = '<option value="">-- Choisir --</option>' +
    invoices.map(i => `<option value="${i.id}">${i.ref} — ${getSupplierName(i.supplierId)}</option>`).join('');
  ['ord-invoice-select','pv-invoice-select'].forEach(id => {
    const el = document.getElementById(id); if (el) el.innerHTML = allOpts;
  });
}

// ══════════════════════════════════════════════════════════════
// MODULE 2 : VERIFICATION
// ══════════════════════════════════════════════════════════════

const CHECKLIST_ITEMS = [
  { id:'niu',     label_fr:'NIU valide et conforme (format correct)',   label_en:'Valid and compliant NIU (correct format)',      required:true },
  { id:'address', label_fr:'Facture adressée au PAK',                   label_en:'Invoice addressed to PAK',                     required:true },
  { id:'stamp',   label_fr:'Timbre fiscal (montant > 25 000 FCFA)',     label_en:'Fiscal stamp (amount > 25,000 FCFA)',           required:false },
  { id:'libelle', label_fr:'Libellé précis, complet et hors ambiguïté', label_en:'Clear, complete and unambiguous description',  required:true },
  { id:'amounts', label_fr:'Concordance montant en chiffres & lettres', label_en:'Figures and words match',                      required:true },
  { id:'tva',     label_fr:'Détail TVA correct (19.25%)',               label_en:'Correct VAT breakdown (19.25%)',                required:true },
  { id:'pvrecep', label_fr:'PV de réception signé et daté',             label_en:'Signed and dated reception report',            required:true },
  { id:'auth',    label_fr:'Autorisation de dépense signée (Ordonnateur)', label_en:'Signed expense authorisation (Ordinator)', required:true },
];

function renderVerifPage() {
  refreshInvoiceSelects();
  renderVerifQueue();
  // If a pre-selected invoice exists, load it
  if (APP.selectedVerifInvoiceId) {
    const sel = document.getElementById('verif-invoice-select');
    if (sel) { sel.value = APP.selectedVerifInvoiceId; loadVerifChecklist(APP.selectedVerifInvoiceId); }
  }
}

function loadVerifChecklist(invoiceId) {
  APP.selectedVerifInvoiceId = invoiceId;
  const area  = document.getElementById('verif-checklist-area');
  const score = document.getElementById('verif-score');
  if (!area) return;

  if (!invoiceId) {
    area.innerHTML = `<div class="alert alert-info"><i class="fas fa-hand-point-up"></i> ${t('select_invoice_first')}</div>`;
    if (score) score.style.display = 'none';
    return;
  }

  const inv = store.get(KEYS.invoices).find(i => i.id === invoiceId);
  if (!inv) return;

  const checklist = inv.checklist && inv.checklist.length ? inv.checklist : initChecklist();

  area.innerHTML = `
    <div class="alert alert-info mb-12" style="font-size:0.78rem">
      <i class="fas fa-file-invoice"></i> <strong>${inv.ref}</strong> — ${getSupplierName(inv.supplierId)} — ${fmt(inv.nap)}
    </div>
    <div class="checklist" id="verif-checklist-items">
      ${checklist.map((item,i) => {
        const lbl = APP.lang === 'en' ? item.label_en : item.label_fr;
        return `
          <div class="checklist-item ${item.checked ? 'checked' : ''}" id="chk-${item.id}" onclick="toggleCheckItem('${invoiceId}','${item.id}')">
            <div class="check-icon">${item.checked ? '✓' : ''}</div>
            <div class="check-label">${lbl}</div>
            ${item.required ? '<span class="check-required">REQUIS</span>' : '<span class="check-required" style="color:#0277bd">OPT.</span>'}
          </div>`;
      }).join('')}
    </div>`;

  if (score) score.style.display = 'block';
  updateVerifScore(checklist);
}

function toggleCheckItem(invoiceId, itemId) {
  const invoices = store.get(KEYS.invoices);
  const inv = invoices.find(i => i.id === invoiceId);
  if (!inv) return;

  const checklist = inv.checklist || initChecklist();
  const item = checklist.find(c => c.id === itemId);
  if (item) item.checked = !item.checked;

  store.update(KEYS.invoices, invoiceId, { checklist });

  const el = document.getElementById('chk-' + itemId);
  if (el) {
    el.classList.toggle('checked', item.checked);
    el.querySelector('.check-icon').textContent = item.checked ? '✓' : '';
  }
  updateVerifScore(checklist);
}

function updateVerifScore(checklist) {
  const checked = checklist.filter(c => c.checked).length;
  const total   = checklist.length;
  const pct     = total > 0 ? Math.round(checked / total * 100) : 0;
  setEl('score-checked', checked);
  setEl('score-total', total);
  setEl('score-pct', pct + '%');
}

function saveVerifChecklist() {
  const id = APP.selectedVerifInvoiceId;
  if (!id) { toast('Sélectionnez une facture.', 'warning'); return; }
  const inv = store.get(KEYS.invoices).find(i => i.id === id);
  if (!inv) return;
  store.update(KEYS.invoices, id, { status: 'verified' });
  toast('Vérification sauvegardée — Statut: VÉRIFIÉ.', 'success');
  renderVerifQueue();
}

function approveFromVerif() {
  const id = APP.selectedVerifInvoiceId;
  if (!id) { toast('Sélectionnez une facture.', 'warning'); return; }
  const inv = store.get(KEYS.invoices).find(i => i.id === id);
  if (!inv) return;

  // Check required items
  const checklist = inv.checklist || initChecklist();
  const missedRequired = checklist.filter(c => c.required && !c.checked);
  if (missedRequired.length > 0 && !confirm(`${missedRequired.length} élément(s) requis non cochés. Approuver quand même ?`)) return;

  // Check budget
  if (checkBudgetExceed(inv.line, inv.quarter, inv.nap, id)) {
    if (!confirm('⚠️ DÉPASSEMENT BUDGÉTAIRE détecté. Approuver quand même ?')) return;
  }

  store.update(KEYS.invoices, id, { status: 'approved' });
  toast('Facture APPROUVÉE — prête au décaissement.', 'success');
  renderVerifQueue();
  updateBadges();
}

function rejectFromVerif() {
  const id = APP.selectedVerifInvoiceId;
  if (!id) { toast('Sélectionnez une facture.', 'warning'); return; }
  const reason = prompt('Motif du rejet (obligatoire):');
  if (!reason) return;
  store.update(KEYS.invoices, id, { status: 'rejected', rejectReason: reason });
  toast('Facture REJETÉE.', 'warning');
  renderVerifQueue();
  updateBadges();
}

function renderVerifQueue() {
  const tbody = document.getElementById('verif-queue-body');
  if (!tbody) return;

  const invoices = store.get(KEYS.invoices).filter(i => ['draft','pending','verified','approved'].includes(i.status));
  if (!invoices.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="td-center text-muted" style="padding:16px">${t('no_pending')}</td></tr>`;
    return;
  }

  tbody.innerHTML = invoices.map(inv => {
    const checklist = inv.checklist || [];
    const checked   = checklist.filter(c => c.checked).length;
    const total     = checklist.length;
    const pct       = total > 0 ? Math.round(checked / total * 100) : 0;
    const badgeCls  = pct >= 100 ? 'badge-verified' : pct >= 50 ? 'badge-pending' : 'badge-draft';

    return `
      <tr>
        <td><strong>${inv.ref}</strong></td>
        <td>${getSupplierName(inv.supplierId)}</td>
        <td class="td-right fw-bold">${fmt(inv.nap)}</td>
        <td><span class="badge badge-pending" style="font-size:0.65rem">${inv.line}</span></td>
        <td class="td-center">
          <span class="badge ${badgeCls}">${checked}/${total} (${pct}%)</span>
        </td>
        <td>${statusBadge(inv.status)}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="openVerifForInvoice('${inv.id}')">
            <i class="fas fa-check-double"></i> Vérifier
          </button>
        </td>
      </tr>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════
// MODULE 3 : DISBURSEMENTS
// ══════════════════════════════════════════════════════════════

function renderDisbursement() {
  const q = APP.currentQuarter;
  refreshInvoiceSelects();

  // KPIs
  const disbEl = document.getElementById('disb-kpis');
  if (disbEl) {
    const disbs = store.get(KEYS.disbursements);
    const invoices = store.get(KEYS.invoices);
    const totalDisb = disbs.reduce((s,d) => s + (d.amount||0), 0);
    const qDisb = getTotalDisbursedForQuarter(q);
    const pendingApproved = invoices.filter(i => i.status === 'approved').reduce((s,i)=>s+(i.nap||0),0);
    const cashBal = getCashBalance();

    disbEl.innerHTML = `
      <div class="kpi-card primary"><div class="kpi-label">Solde Caisse</div><div class="kpi-value">${fmt(cashBal)}</div><div class="kpi-sub">Toutes périodes</div></div>
      <div class="kpi-card secondary"><div class="kpi-label">Décaissé ${q}</div><div class="kpi-value">${fmt(qDisb)}</div><div class="kpi-sub">Ce trimestre</div></div>
      <div class="kpi-card accent"><div class="kpi-label">Total Décaissé</div><div class="kpi-value">${fmt(totalDisb)}</div><div class="kpi-sub">Toutes périodes</div></div>
      <div class="kpi-card warning"><div class="kpi-label">À Décaisser</div><div class="kpi-value">${fmt(pendingApproved)}</div><div class="kpi-sub">Factures approuvées non payées</div></div>
    `;
  }

  // Pre-select if from invoice action
  if (APP.selectedDisbInvoiceId) {
    const sel = document.getElementById('disb-invoice-select');
    if (sel) { sel.value = APP.selectedDisbInvoiceId; loadDisbAmount(APP.selectedDisbInvoiceId); }
    APP.selectedDisbInvoiceId = null;
  }

  renderDisbHistory();
}

function loadDisbAmount(invoiceId) {
  if (!invoiceId) {
    document.getElementById('disb-amount').value = '';
    document.getElementById('bon-depense-preview').innerHTML = `<div class="alert alert-info"><i class="fas fa-info-circle"></i> ${t('select_invoice_first')}</div>`;
    return;
  }
  const inv = store.get(KEYS.invoices).find(i => i.id === invoiceId);
  if (inv) {
    document.getElementById('disb-amount').value = inv.nap;
    generateBonDepensePreview(inv);
  }
}

function generateBonDepensePreview(inv) {
  const el = document.getElementById('bon-depense-preview');
  if (!el) return;
  const today = new Date().toLocaleDateString('fr-FR');
  el.innerHTML = `
    <div class="print-doc" id="bon-depense-doc">
      <div class="print-doc-header">
        <div class="org">PORT AUTONOME DE KRIBI – REPRÉSENTATION DE DOUALA (RDLA)</div>
        <div class="title">BON DE DÉPENSE</div>
        <div class="ref">Réf : ${inv.ref} | ${today}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <tr><td style="width:40%;color:#607d8b;padding:4px 0">Fournisseur :</td><td><strong>${getSupplierName(inv.supplierId)}</strong></td></tr>
        <tr><td style="color:#607d8b;padding:4px 0">Ligne budgétaire :</td><td><strong>${inv.line}</strong></td></tr>
        <tr><td style="color:#607d8b;padding:4px 0">Trimestre :</td><td><strong>${inv.quarter} 2026</strong></td></tr>
        <tr><td style="color:#607d8b;padding:4px 0">Libellé :</td><td>${inv.label || '—'}</td></tr>
        <tr><td style="color:#607d8b;padding:4px 0">Montant HT :</td><td>${fmt(inv.ht)}</td></tr>
        <tr><td style="color:#607d8b;padding:4px 0">TVA (19.25%) :</td><td>${fmt(inv.tva)}</td></tr>
        <tr><td style="color:#607d8b;padding:4px 0">AIR :</td><td>${fmt(inv.air)}</td></tr>
        <tr><td style="color:#607d8b;padding:4px 0">Montant TTC :</td><td>${fmt(inv.ttc)}</td></tr>
        <tr style="background:#0a2d6e;color:white"><td style="padding:8px;font-weight:700">NET À PAYER :</td><td style="padding:8px;font-weight:800;font-size:1.1rem">${fmt(inv.nap)}</td></tr>
      </table>
      <div class="signature-grid">
        <div class="sig-box">
          <div class="sig-area"></div>
          <div class="sig-role">ORDONNATEUR</div>
          <div class="sig-name">M. MOHAMMED IYA Habib</div>
        </div>
        <div class="sig-box">
          <div class="sig-area"></div>
          <div class="sig-role">CONTRÔLEUR</div>
          <div class="sig-name">Mme BANINI Sandrine</div>
        </div>
        <div class="sig-box">
          <div class="sig-area"></div>
          <div class="sig-role">RÉGISSEUR</div>
          <div class="sig-name">Mme KANGE Polivone</div>
        </div>
      </div>
    </div>`;
}

function saveDisbursement() {
  const invoiceId = document.getElementById('disb-invoice-select').value;
  const date      = document.getElementById('disb-date').value;
  const amount    = parseFloat(document.getElementById('disb-amount').value) || 0;
  const mode      = document.getElementById('disb-mode').value;
  const notes     = document.getElementById('disb-notes').value.trim();

  if (!invoiceId) { toast('Sélectionnez une facture approuvée.', 'error'); return; }
  if (!amount)    { toast('Montant invalide.', 'error'); return; }
  if (!date)      { toast('Veuillez saisir la date de paiement.', 'error'); return; }

  // Check cash balance
  const cashBal = getCashBalance();
  if (cashBal < amount) {
    if (!confirm(`⚠️ Solde caisse insuffisant (${fmt(cashBal)}). Continuer ?`)) return;
  }

  const inv = store.get(KEYS.invoices).find(i => i.id === invoiceId);

  const disb = {
    id: genId(),
    invoiceId, amount, date, mode, notes,
    invoiceRef: inv ? inv.ref : '—',
    createdAt: new Date().toISOString(),
  };

  store.push(KEYS.disbursements, disb);
  store.update(KEYS.invoices, invoiceId, { status: 'paid', paidAt: date });

  // Add journal entry
  addJournalEntry({
    date,
    ref: inv ? inv.ref : '—',
    label: `Décaissement – ${getSupplierName(inv?.supplierId)} – ${inv?.line}`,
    account: inv ? inv.line : '—',
    debit: 0,
    credit: amount,
    type: 'disbursement',
  });

  toast('Décaissement enregistré avec succès.', 'success');

  document.getElementById('disb-notes').value = '';
  document.getElementById('disb-date').value  = '';

  renderDisbursement();
  updateBadges();
}

function renderDisbHistory() {
  const tbody = document.getElementById('disb-history-body');
  if (!tbody) return;
  const disbs = store.get(KEYS.disbursements).slice().reverse();
  if (!disbs.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="td-center text-muted" style="padding:16px">${t('no_disbursement')}</td></tr>`;
    return;
  }
  tbody.innerHTML = disbs.map((d, i) => {
    const inv = store.get(KEYS.invoices).find(x => x.id === d.invoiceId);
    const modeLabel = { cash: 'Espèces', transfer: 'Virement', check: 'Chèque' }[d.mode] || d.mode;
    return `
      <tr>
        <td class="text-muted text-xs">${disbs.length - i}</td>
        <td><strong>${d.invoiceRef || '—'}</strong></td>
        <td>${inv ? getSupplierName(inv.supplierId) : '—'}</td>
        <td>${inv ? `<span class="badge badge-pending" style="font-size:0.65rem">${inv.line}</span>` : '—'}</td>
        <td class="td-right fw-bold" style="color:var(--pak-primary)">${fmt(d.amount)}</td>
        <td>${fmtDate(d.date)}</td>
        <td>${modeLabel}</td>
        <td>
          <button class="btn btn-sm btn-outline btn-icon" onclick="previewDisbDoc('${d.id}')" title="Voir bon"><i class="fas fa-eye"></i></button>
        </td>
      </tr>`;
  }).join('');
}

function previewDisbDoc(disbId) {
  const d = store.get(KEYS.disbursements).find(x => x.id === disbId);
  if (!d) return;
  const inv = store.get(KEYS.invoices).find(i => i.id === d.invoiceId);
  if (inv) generateBonDepensePreview(inv);
  showPage('disbursement');
}

function printBonDepense() {
  const el = document.getElementById('bon-depense-doc');
  if (!el) { toast('Aucun bon de dépense à imprimer.', 'warning'); return; }
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>Bon de Dépense</title>
    <link rel="stylesheet" href="css/style.css"/>
    <style>body{padding:30px}@media print{body{padding:0}}</style>
    </head><body>${el.outerHTML}
    <script>window.onload=()=>window.print()<\/script></body></html>`);
  win.document.close();
}
