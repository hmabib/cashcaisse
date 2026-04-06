/* ============================================================
   PAK RDLA – Caisse d'Avance 2026
   modules2.js — Replenishment, Accounting, Audit, Documents
   ============================================================ */

// ══════════════════════════════════════════════════════════════
// MODULE 4 : REPLENISHMENT
// ══════════════════════════════════════════════════════════════

function renderReplenishment() {
  renderReplenQuarterCards();
  renderReplenHistory();
}

function renderReplenQuarterCards() {
  const el = document.getElementById('replen-quarters');
  if (!el) return;
  const repls = store.get(KEYS.replenishments);

  el.innerHTML = BUDGET_CONFIG.quarters.map(q => {
    const received = repls.filter(r => r.quarter === q && r.status === 'received').reduce((s,r) => s+(r.amount||0), 0);
    const isFull   = received >= BUDGET_CONFIG.quarterly_total;
    const isCurrent = q === APP.currentQuarter;
    return `
      <div class="quarter-card ${isCurrent ? 'current' : ''}">
        <div class="quarter-title">${q.replace('Q','T')}</div>
        <div class="quarter-period">${BUDGET_CONFIG.quarter_periods[q]}</div>
        <div class="quarter-amount">${fmtNum(BUDGET_CONFIG.quarterly_total)}</div>
        <div class="quarter-currency">FCFA dotation trimestrielle</div>
        <div class="divider"></div>
        <div class="text-xs mt-4">
          ${isFull
            ? '<span class="badge badge-paid">✅ Approvisionnement complet</span>'
            : `<span class="badge badge-pending">⏳ Reçu : ${fmt(received)} / ${fmt(BUDGET_CONFIG.quarterly_total)}</span>`}
        </div>
        ${BUDGET_CONFIG.lines.map(l => `
          <div class="text-xs text-muted mt-4">
            ${l.code} : <strong>${fmt(l.quarterly)}</strong>
          </div>`).join('')}
      </div>`;
  }).join('');
}

function saveReplenishment() {
  const quarter = document.getElementById('replen-quarter').value;
  const amount  = parseFloat(document.getElementById('replen-amount').value) || 0;
  const date    = document.getElementById('replen-date').value;
  const ref     = document.getElementById('replen-ref').value.trim();
  const notes   = document.getElementById('replen-notes').value.trim();

  if (!date) { toast('Veuillez saisir la date de réception.', 'error'); return; }
  if (!ref)  { toast('Veuillez saisir la référence.', 'error'); return; }
  if (amount !== BUDGET_CONFIG.quarterly_total) {
    if (!confirm(`⚠️ Le montant saisi (${fmt(amount)}) diffère du plafond trimestriel (${fmt(BUDGET_CONFIG.quarterly_total)}). Continuer ?`)) return;
  }

  // Check if already received for this quarter
  const existing = store.get(KEYS.replenishments).filter(r => r.quarter === quarter && r.status === 'received').reduce((s,r)=>s+(r.amount||0),0);
  if (existing + amount > BUDGET_CONFIG.quarterly_total) {
    toast(`⚠️ Dépassement du plafond trimestriel (${fmt(BUDGET_CONFIG.quarterly_total)}) pour ${quarter}.`, 'warning');
  }

  const repl = {
    id: genId(),
    quarter, amount, date, ref, notes,
    status: 'received',
    createdAt: new Date().toISOString(),
  };

  store.push(KEYS.replenishments, repl);

  // Add journal entry
  addJournalEntry({
    date,
    ref,
    label: `Mise à disposition – ${quarter} 2026`,
    account: '530100',
    debit: amount,
    credit: 0,
    type: 'replenishment',
  });

  toast(`Approvisionnement ${quarter} enregistré : ${fmt(amount)}`, 'success');

  document.getElementById('replen-date').value  = '';
  document.getElementById('replen-ref').value   = '';
  document.getElementById('replen-notes').value = '';

  renderReplenishment();
  renderDashboard();
  generateBordereauPreview(repl);
}

function renderReplenHistory() {
  const tbody = document.getElementById('replen-history-body');
  if (!tbody) return;
  const repls = store.get(KEYS.replenishments).slice().reverse();
  if (!repls.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="td-center text-muted" style="padding:16px">Aucun approvisionnement</td></tr>`;
    return;
  }
  tbody.innerHTML = repls.map(r => `
    <tr>
      <td><strong>${r.quarter.replace('Q','T')}</strong></td>
      <td>${fmtDate(r.date)}</td>
      <td class="td-right fw-bold">${fmt(r.amount)}</td>
      <td>${r.ref}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="generateBordereauPreview(JSON.parse(decodeURIComponent('${encodeURIComponent(JSON.stringify(r))}')))" title="Bordereau">
          <i class="fas fa-file-alt"></i>
        </button>
      </td>
    </tr>`).join('');
}

function generateBordereauPreview(repl) {
  const el = document.getElementById('bordereau-preview');
  if (!el) return;
  el.innerHTML = `
    <div class="print-doc" id="bordereau-doc">
      <div class="print-doc-header">
        <div class="org">PORT AUTONOME DE KRIBI – REPRÉSENTATION DE DOUALA (RDLA)</div>
        <div class="title">BORDEREAU DE MISE À DISPOSITION DE FONDS</div>
        <div class="ref">Réf : ${repl.ref} | ${repl.quarter.replace('Q','T')} 2026 | ${fmtDate(repl.date)}</div>
      </div>
      <p style="margin-bottom:12px">Conformément à la Décision N° 0719/PAK/DG/DFC/2025 portant création et fonctionnement de la caisse d'avance de la Représentation de Douala, il est procédé à la mise à disposition suivante :</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <tr style="background:var(--pak-primary);color:white">
          <th style="padding:8px 12px;text-align:left">Ligne Budgétaire</th>
          <th style="padding:8px 12px;text-align:left">Libellé</th>
          <th style="padding:8px 12px;text-align:right">Dotation Trimestrielle</th>
        </tr>
        ${BUDGET_CONFIG.lines.map(l => `
          <tr style="border-bottom:1px solid #dde3ed">
            <td style="padding:8px 12px">${l.code}</td>
            <td style="padding:8px 12px">${l.label_fr}</td>
            <td style="padding:8px 12px;text-align:right;font-weight:700">${fmt(l.quarterly)}</td>
          </tr>`).join('')}
        <tr style="background:#f0f4f9;font-weight:800">
          <td colspan="2" style="padding:10px 12px">TOTAL MISE À DISPOSITION</td>
          <td style="padding:10px 12px;text-align:right;font-size:1.05rem;color:var(--pak-primary)">${fmt(repl.amount)}</td>
        </tr>
      </table>
      <p style="font-size:0.8rem;color:#607d8b;margin-bottom:24px">Note : Conformément à la Note de Service N°025/2019/DG/DFC/PAK, les dépenses ne peuvent dépasser le quart de l'encaisse annuelle par trimestre. Toute dépense doit être payée sur la base du <strong>NET À PAYER</strong> et non du montant TTC.</p>
      <div class="signature-grid">
        <div class="sig-box">
          <div class="sig-area"></div>
          <div class="sig-role">ORDONNATEUR</div>
          <div class="sig-name">M. MOHAMMED IYA Habib</div>
        </div>
        <div class="sig-box">
          <div class="sig-area"></div>
          <div class="sig-role">RÉGISSEUR</div>
          <div class="sig-name">Mme KANGE Polivone</div>
        </div>
        <div class="sig-box">
          <div class="sig-area"></div>
          <div class="sig-role">CONTRÔLEUR</div>
          <div class="sig-name">Mme BANINI Sandrine</div>
        </div>
      </div>
    </div>`;
}

function printBordereau() {
  const el = document.getElementById('bordereau-doc');
  if (!el) { toast('Aucun bordereau à imprimer.', 'warning'); return; }
  printElement(el);
}

// ══════════════════════════════════════════════════════════════
// MODULE 5 : ACCOUNTING
// ══════════════════════════════════════════════════════════════

function addJournalEntry(entry) {
  const journal = store.get(KEYS.journal);
  const last = journal.length > 0 ? (journal[journal.length-1].balance || 0) : 0;
  const balance = last + entry.debit - entry.credit;
  store.push(KEYS.journal, {
    id: genId(),
    ...entry,
    balance,
    createdAt: new Date().toISOString(),
  });
}

function renderAccounting() {
  const journal = store.get(KEYS.journal);

  // KPIs
  const accEl = document.getElementById('acc-kpis');
  if (accEl) {
    const totalDebit  = journal.reduce((s,e) => s + (e.debit ||0), 0);
    const totalCredit = journal.reduce((s,e) => s + (e.credit||0), 0);
    const solde       = totalDebit - totalCredit;
    const lastEntry   = journal.length > 0 ? journal[journal.length-1] : null;

    accEl.innerHTML = `
      <div class="kpi-card primary"><div class="kpi-label">${t('acc_kpi_physique')}</div><div class="kpi-value">${fmt(getCashBalance())}</div><div class="kpi-sub">Encaisse physique</div></div>
      <div class="kpi-card secondary"><div class="kpi-label">${t('acc_kpi_theorique')}</div><div class="kpi-value">${fmt(solde)}</div><div class="kpi-sub">Solde comptable</div></div>
      <div class="kpi-card accent"><div class="kpi-label">${t('acc_kpi_total_debit')}</div><div class="kpi-value">${fmt(totalDebit)}</div><div class="kpi-sub">Total entrées</div></div>
      <div class="kpi-card light"><div class="kpi-label">${t('acc_kpi_total_credit')}</div><div class="kpi-value">${fmt(totalCredit)}</div><div class="kpi-sub">Total sorties</div></div>
    `;
  }

  // Journal table
  const tbody = document.getElementById('journal-body');
  if (tbody) {
    if (!journal.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="td-center text-muted" style="padding:20px">${t('no_entries')}</td></tr>`;
    } else {
      tbody.innerHTML = journal.map(e => `
        <tr>
          <td>${fmtDate(e.date || e.createdAt)}</td>
          <td><strong>${e.ref || '—'}</strong></td>
          <td>${e.label || '—'}</td>
          <td class="td-center"><span class="badge badge-pending" style="font-size:0.65rem">${e.account || '—'}</span></td>
          <td class="td-right" style="color:var(--pak-secondary)">${e.debit  > 0 ? fmt(e.debit)  : '—'}</td>
          <td class="td-right" style="color:var(--danger)">${e.credit > 0 ? fmt(e.credit) : '—'}</td>
          <td class="td-right fw-bold">${fmt(e.balance || 0)}</td>
          <td class="td-center">
            <button class="btn btn-sm btn-danger btn-icon" onclick="deleteJournalEntry('${e.id}')" title="Delete entry"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`).join('');
    }
  }

  // Balance
  const balEl = document.getElementById('balance-content');
  if (balEl) {
    const accounts = {};
    journal.forEach(e => {
      const acc = e.account || '—';
      if (!accounts[acc]) accounts[acc] = { debit:0, credit:0 };
      accounts[acc].debit  += e.debit  || 0;
      accounts[acc].credit += e.credit || 0;
    });

    const accountLabels = {
      '530100': 'Caisse d\'avance (encaisse)',
      '580000': 'Virement interne',
      '624800': 'Autres entretiens et réparations',
      '627700': 'Frais de colloques / séminaires',
      '627710': 'Frais de réception et de relations publiques',
    };

    balEl.innerHTML = `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Compte</th>
              <th>Libellé</th>
              <th class="td-right">Total Débit</th>
              <th class="td-right">Total Crédit</th>
              <th class="td-right">Solde</th>
            </tr>
          </thead>
          <tbody>
            ${Object.keys(accounts).length === 0 ? '<tr><td colspan="5" class="td-center text-muted" style="padding:20px">Aucune écriture</td></tr>' :
              Object.entries(accounts).map(([acc, vals]) => {
                const solde = vals.debit - vals.credit;
                return `<tr>
                  <td><strong>${acc}</strong></td>
                  <td>${accountLabels[acc] || acc}</td>
                  <td class="td-right" style="color:var(--pak-secondary)">${fmt(vals.debit)}</td>
                  <td class="td-right" style="color:var(--danger)">${fmt(vals.credit)}</td>
                  <td class="td-right fw-bold ${solde < 0 ? 'text-danger' : ''}">${fmt(Math.abs(solde))} ${solde < 0 ? '(Cr)' : '(Dr)'}</td>
                </tr>`;
              }).join('')}
          </tbody>
          <tfoot>
            <tr style="background:var(--pak-primary);color:white;font-weight:800">
              <td colspan="2">TOTAUX</td>
              <td class="td-right">${fmt(Object.values(accounts).reduce((s,a)=>s+a.debit,0))}</td>
              <td class="td-right">${fmt(Object.values(accounts).reduce((s,a)=>s+a.credit,0))}</td>
              <td class="td-right">${fmt(getCashBalance())}</td>
            </tr>
          </tfoot>
        </table>
      </div>`;
  }
}

function printJournal() {
  const el = document.getElementById('journal-body');
  if (!el) return;
  toast('Utilisez la fonction d\'impression du navigateur (Ctrl+P).', 'success');
  window.print();
}

function recomputeJournalBalances(entries) {
  let running = 0;
  return entries.map(entry => {
    running += (entry.debit || 0) - (entry.credit || 0);
    return { ...entry, balance: running };
  });
}

function deleteJournalEntry(id) {
  if (!confirm('Delete this accounting entry?')) return;
  const journal = store.get(KEYS.journal).filter(entry => entry.id !== id);
  store.set(KEYS.journal, recomputeJournalBalances(journal));
  renderAccounting();
  toast('Accounting entry deleted.', 'warning');
}

// ══════════════════════════════════════════════════════════════
// MODULE 6 : AUDIT
// ══════════════════════════════════════════════════════════════

const AUDIT_CHECKLIST_ITEMS = [
  { id:'a1', label_fr:'Arrêté de caisse établi et signé',              label_en:'Cash count completed and signed' },
  { id:'a2', label_fr:'Concordance physique / registre / ERP',         label_en:'Physical / register / ERP reconciliation' },
  { id:'a3', label_fr:'Toutes les factures adressées au PAK',          label_en:'All invoices addressed to PAK' },
  { id:'a4', label_fr:'NIU de tous les fournisseurs valides',          label_en:'All supplier NIUs valid' },
  { id:'a5', label_fr:'Paiements effectués en Net à Payer (non TTC)',  label_en:'Payments made on Net Payable (not TTC)' },
  { id:'a6', label_fr:'Aucun dépassement budgétaire par ligne',        label_en:'No budget overrun per line' },
  { id:'a7', label_fr:'PV de réception pour chaque dépense',           label_en:'Reception report for each expense' },
  { id:'a8', label_fr:'Autorisations de dépenses signées',             label_en:'Signed expense authorisations' },
  { id:'a9', label_fr:'Timbre fiscal présent si montant > 25 000',     label_en:'Fiscal stamp for amounts over 25,000' },
  { id:'a10',label_fr:'Dépenses dans les lignes budgétaires autorisées',label_en:'Expenses within authorised budget lines' },
];

function renderAudit() {
  const q = APP.currentQuarter;
  const invoices = store.get(KEYS.invoices);
  const disbs = store.get(KEYS.disbursements);

  // KPIs
  const kpiEl = document.getElementById('audit-kpis');
  if (kpiEl) {
    const qInv    = invoices.filter(i => i.quarter === q);
    const qPaid   = qInv.filter(i => i.status === 'paid');
    const qRejected = qInv.filter(i => i.status === 'rejected');
    const anomalies = detectAnomalies();

    kpiEl.innerHTML = `
      <div class="kpi-card primary"><div class="kpi-label">Factures ${q}</div><div class="kpi-value">${qInv.length}</div><div class="kpi-sub">Toutes</div></div>
      <div class="kpi-card secondary"><div class="kpi-label">Payées ${q}</div><div class="kpi-value">${qPaid.length}</div><div class="kpi-sub">Status: payé</div></div>
      <div class="kpi-card ${anomalies.length > 0 ? 'danger' : 'success'}"><div class="kpi-label">Anomalies</div><div class="kpi-value">${anomalies.length}</div><div class="kpi-sub">${anomalies.length > 0 ? 'À corriger' : 'Aucune'}</div></div>
      <div class="kpi-card accent"><div class="kpi-label">Solde Caisse</div><div class="kpi-value">${fmt(getCashBalance())}</div><div class="kpi-sub">Encaisse physique</div></div>
    `;
  }

  // Audit checklist
  const checkEl = document.getElementById('audit-checklist-body');
  if (checkEl) {
    const checkState = getAuditChecklistState(q);
    checkEl.innerHTML = AUDIT_CHECKLIST_ITEMS.map(item => {
      const checked = checkState[item.id] || false;
      return `
        <div class="checklist-item ${checked ? 'checked' : ''}" onclick="toggleAuditCheck('${item.id}','${q}')">
          <div class="check-icon">${checked ? '✓' : ''}</div>
          <div class="check-label">${APP.lang === 'en' ? item.label_en : item.label_fr}</div>
        </div>`;
    }).join('');
    // Score
    const checkedCount = Object.values(checkState).filter(Boolean).length;
    checkEl.innerHTML += `
      <div class="nap-calc mt-16">
        <div class="nap-calc-title">Score d'Audit ${q}</div>
        <div class="nap-row nap-total">
          <span class="nap-label">Conformité</span>
          <span class="nap-val">${checkedCount}/${AUDIT_CHECKLIST_ITEMS.length} (${Math.round(checkedCount/AUDIT_CHECKLIST_ITEMS.length*100)}%)</span>
        </div>
      </div>`;
  }

  // Anomalies
  const anomEl = document.getElementById('audit-anomalies-body');
  if (anomEl) {
    const anomalies = detectAnomalies();
    if (!anomalies.length) {
      anomEl.innerHTML = `<div class="alert alert-success"><i class="fas fa-check-circle"></i> Aucune anomalie détectée pour ${q}.</div>`;
    } else {
      anomEl.innerHTML = anomalies.map(a => `
        <div class="alert alert-danger mb-8">
          <i class="fas fa-exclamation-triangle"></i>
          <div>
            <strong>${a.type}</strong>
            <div class="text-sm">${a.detail}</div>
          </div>
        </div>`).join('');
    }
  }

  // Cash count
  renderCashCount();
}

function toggleAuditCheck(itemId, quarter) {
  const state = getAuditChecklistState(quarter);
  state[itemId] = !state[itemId];
  setAuditChecklistState(quarter, state);
  renderAudit();
}

function detectAnomalies() {
  const invoices   = store.get(KEYS.invoices);
  const disbs      = store.get(KEYS.disbursements);
  const anomalies  = [];
  const q          = APP.currentQuarter;

  // 1. Budget overruns per line
  BUDGET_CONFIG.lines.forEach(line => {
    const consumed = getConsumedByLineAndQuarter(line.code, q);
    if (consumed > line.quarterly) {
      anomalies.push({
        type: 'Dépassement budgétaire',
        detail: `Ligne ${line.code} – ${q} : engagé ${fmt(consumed)} / budget ${fmt(line.quarterly)}`
      });
    }
  });

  // 2. Invoices without NIU check
  invoices.filter(i => i.quarter === q).forEach(inv => {
    const checklist = inv.checklist || [];
    const niuItem = checklist.find(c => c.id === 'niu');
    if (!niuItem || !niuItem.checked) {
      anomalies.push({
        type: 'NIU non vérifié',
        detail: `Facture ${inv.ref} — ${getSupplierName(inv.supplierId)}`
      });
    }
    const pvItem = checklist.find(c => c.id === 'pvrecep');
    if (!pvItem || !pvItem.checked) {
      anomalies.push({
        type: 'PV de réception manquant',
        detail: `Facture ${inv.ref} — ${getSupplierName(inv.supplierId)}`
      });
    }
  });

  // 3. Disbursements > cash
  const totalReplen = store.get(KEYS.replenishments).filter(r => r.status === 'received').reduce((s,r)=>s+(r.amount||0),0);
  const totalDisb   = disbs.reduce((s,d) => s+(d.amount||0), 0);
  if (totalDisb > totalReplen) {
    anomalies.push({
      type: 'Solde caisse négatif',
      detail: `Décaissements totaux (${fmt(totalDisb)}) supérieurs aux approvisionnements reçus (${fmt(totalReplen)})`
    });
  }

  // 4. Unverified invoices in paid status (should have been verified first)
  invoices.filter(i => i.status === 'paid' && i.quarter === q).forEach(inv => {
    const checklist = inv.checklist || [];
    const requiredMissed = checklist.filter(c => c.required && !c.checked);
    if (requiredMissed.length > 0) {
      anomalies.push({
        type: 'Facture payée avec éléments requis manquants',
        detail: `${inv.ref} — ${requiredMissed.map(c => c.id).join(', ')} non validés`
      });
    }
  });

  return anomalies;
}

function renderCashCount() {
  const el = document.getElementById('cash-count-body');
  if (!el) return;
  const q         = APP.currentQuarter;
  const replenRcv = getReplenReceived(q);
  const disbursed = getTotalDisbursedForQuarter(q);
  const solde     = replenRcv - disbursed;
  const totalAll  = getCashBalance();
  const today     = new Date().toLocaleDateString('fr-FR');

  el.innerHTML = `
    <div class="print-doc" id="cash-count-doc">
      <div class="print-doc-header">
        <div class="org">PORT AUTONOME DE KRIBI – REPRÉSENTATION DE DOUALA (RDLA)</div>
        <div class="title">ARRÊTÉ DE CAISSE — ${q.replace('Q','T')} 2026</div>
        <div class="ref">Date d'arrêté : ${today}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <tr style="background:var(--pak-primary);color:white">
          <th style="padding:8px 12px;text-align:left">Ligne Budgétaire</th>
          <th style="padding:8px 12px;text-align:right">Dotation ${q.replace('Q','T')}</th>
          <th style="padding:8px 12px;text-align:right">Engagé</th>
          <th style="padding:8px 12px;text-align:right">Disponible</th>
        </tr>
        ${BUDGET_CONFIG.lines.map(l => {
          const consumed = getConsumedByLineAndQuarter(l.code, q);
          return `<tr style="border-bottom:1px solid #dde3ed">
            <td style="padding:8px 12px">${l.code} – ${l.label_fr}</td>
            <td style="padding:8px 12px;text-align:right">${fmt(l.quarterly)}</td>
            <td style="padding:8px 12px;text-align:right;font-weight:700">${fmt(consumed)}</td>
            <td style="padding:8px 12px;text-align:right;${consumed > l.quarterly ? 'color:red;font-weight:700':''}">${fmt(l.quarterly - consumed)}</td>
          </tr>`;
        }).join('')}
        <tr style="background:#f0f4f9;font-weight:800">
          <td style="padding:10px 12px">TOTAL ${q.replace('Q','T')}</td>
          <td style="padding:10px 12px;text-align:right">${fmt(BUDGET_CONFIG.quarterly_total)}</td>
          <td style="padding:10px 12px;text-align:right">${fmt(BUDGET_CONFIG.lines.reduce((s,l)=>s+getConsumedByLineAndQuarter(l.code,q),0))}</td>
          <td style="padding:10px 12px;text-align:right">${fmt(BUDGET_CONFIG.quarterly_total - BUDGET_CONFIG.lines.reduce((s,l)=>s+getConsumedByLineAndQuarter(l.code,q),0))}</td>
        </tr>
      </table>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr><td style="padding:6px 0;color:#607d8b">Dotation reçue ${q.replace('Q','T')} :</td><td style="text-align:right;font-weight:700">${fmt(replenRcv)}</td></tr>
        <tr><td style="padding:6px 0;color:#607d8b">Total décaissé ${q.replace('Q','T')} :</td><td style="text-align:right;font-weight:700">${fmt(disbursed)}</td></tr>
        <tr style="background:#0a2d6e;color:white"><td style="padding:10px;font-weight:700">SOLDE THÉORIQUE ${q.replace('Q','T')} :</td><td style="padding:10px;text-align:right;font-weight:800;font-size:1.1rem">${fmt(solde)}</td></tr>
        <tr><td style="padding:6px 0;color:#607d8b">Solde global caisse :</td><td style="text-align:right;font-weight:700">${fmt(totalAll)}</td></tr>
        <tr><td style="padding:6px 0;color:#607d8b">Solde physique (à constater) :</td><td style="text-align:right">____________________ FCFA</td></tr>
        <tr><td style="padding:6px 0;color:#607d8b">Écart (solde physique – solde théorique) :</td><td style="text-align:right">____________________ FCFA</td></tr>
      </table>
      <div class="signature-grid">
        <div class="sig-box">
          <div class="sig-area"></div>
          <div class="sig-role">ORDONNATEUR</div>
          <div class="sig-name">M. MOHAMMED IYA Habib</div>
        </div>
        <div class="sig-box">
          <div class="sig-area"></div>
          <div class="sig-role">RÉGISSEUR</div>
          <div class="sig-name">Mme KANGE Polivone</div>
        </div>
        <div class="sig-box">
          <div class="sig-area"></div>
          <div class="sig-role">CONTRÔLEUR / AUDITEUR</div>
          <div class="sig-name">Mme BANINI Sandrine</div>
        </div>
      </div>
    </div>`;
}

function printCashCount() {
  const el = document.getElementById('cash-count-doc');
  if (!el) { toast('Aucun arrêté à imprimer.', 'warning'); return; }
  printElement(el);
}

// ══════════════════════════════════════════════════════════════
// MODULE 7 : DOCUMENTS
// ══════════════════════════════════════════════════════════════

function renderDocuments() {
  refreshInvoiceSelects();
  renderArrêtDeDoc();
  renderAuditReportDoc();
}

function showDocTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#doc-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  document.querySelector(`[onclick="showDocTab('${tabId}')"]`)?.classList.add('active');
}

function renderArrêtDeDoc() {
  const el = document.getElementById('doc-arrest-content');
  if (!el) return;
  const q = APP.currentQuarter;
  const today = new Date().toLocaleDateString('fr-FR');
  const invoices = store.get(KEYS.invoices).filter(i => i.quarter === q);
  const disbursed = getTotalDisbursedForQuarter(q);
  const replenRcv = getReplenReceived(q);

  el.innerHTML = `
    <div class="print-doc" id="arrest-doc">
      <div class="print-doc-header">
        <div class="org">PORT AUTONOME DE KRIBI – REPRÉSENTATION DE DOUALA (RDLA)</div>
        <div class="title">ARRÊTÉ DE CAISSE D'AVANCE — ${q.replace('Q','T')} 2026</div>
        <div class="ref">Établi le : ${today} | Décision N° 0719/PAK/DG/DFC/2025</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
        <div>
          <div style="font-size:0.75rem;font-weight:700;color:var(--pak-primary);text-transform:uppercase;margin-bottom:8px">Informations Générales</div>
          <table style="width:100%;font-size:0.82rem">
            <tr><td style="color:#607d8b;padding:3px 0">Exercice :</td><td><strong>2026</strong></td></tr>
            <tr><td style="color:#607d8b;padding:3px 0">Trimestre :</td><td><strong>${q.replace('Q','T')} (${BUDGET_CONFIG.quarter_periods[q]})</strong></td></tr>
            <tr><td style="color:#607d8b;padding:3px 0">Dotation trimestrielle :</td><td><strong>${fmt(BUDGET_CONFIG.quarterly_total)}</strong></td></tr>
            <tr><td style="color:#607d8b;padding:3px 0">Total reçu :</td><td><strong>${fmt(replenRcv)}</strong></td></tr>
          </table>
        </div>
        <div>
          <div style="font-size:0.75rem;font-weight:700;color:var(--pak-primary);text-transform:uppercase;margin-bottom:8px">Acteurs</div>
          <table style="width:100%;font-size:0.82rem">
            <tr><td style="color:#607d8b;padding:3px 0">Ordonnateur :</td><td><strong>M. MOHAMMED IYA Habib</strong></td></tr>
            <tr><td style="color:#607d8b;padding:3px 0">Régisseur :</td><td><strong>Mme KANGE Polivone</strong></td></tr>
            <tr><td style="color:#607d8b;padding:3px 0">Contrôleur :</td><td><strong>Mme BANINI Sandrine</strong></td></tr>
          </table>
        </div>
      </div>
      <div style="margin-bottom:16px">
        <div style="font-size:0.75rem;font-weight:700;color:var(--pak-primary);text-transform:uppercase;margin-bottom:8px">Factures traitées — ${q.replace('Q','T')} 2026</div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:var(--pak-primary);color:white">
            <th style="padding:8px 10px;text-align:left">Réf.</th>
            <th style="padding:8px 10px;text-align:left">Fournisseur</th>
            <th style="padding:8px 10px;text-align:left">Ligne</th>
            <th style="padding:8px 10px;text-align:right">HT</th>
            <th style="padding:8px 10px;text-align:right">NAP</th>
            <th style="padding:8px 10px;text-align:left">Statut</th>
          </tr></thead>
          <tbody>
            ${invoices.length === 0 ? '<tr><td colspan="6" style="padding:12px;text-align:center;color:#607d8b">Aucune facture</td></tr>' :
              invoices.map(inv => `
                <tr style="border-bottom:1px solid #dde3ed">
                  <td style="padding:7px 10px">${inv.ref}</td>
                  <td style="padding:7px 10px">${getSupplierName(inv.supplierId)}</td>
                  <td style="padding:7px 10px">${inv.line}</td>
                  <td style="padding:7px 10px;text-align:right">${fmt(inv.ht)}</td>
                  <td style="padding:7px 10px;text-align:right;font-weight:700">${fmt(inv.nap)}</td>
                  <td style="padding:7px 10px">${inv.status}</td>
                </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr style="background:#f0f4f9;font-weight:800">
              <td colspan="4" style="padding:8px 10px">TOTAL DÉCAISSÉ</td>
              <td style="padding:8px 10px;text-align:right">${fmt(disbursed)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div class="signature-grid">
        <div class="sig-box"><div class="sig-area"></div><div class="sig-role">ORDONNATEUR</div><div class="sig-name">M. MOHAMMED IYA Habib</div></div>
        <div class="sig-box"><div class="sig-area"></div><div class="sig-role">RÉGISSEUR</div><div class="sig-name">Mme KANGE Polivone</div></div>
        <div class="sig-box"><div class="sig-area"></div><div class="sig-role">CONTRÔLEUR</div><div class="sig-name">Mme BANINI Sandrine</div></div>
      </div>
    </div>`;
}

function generateOrdo(invoiceId) {
  const el = document.getElementById('doc-ordonnancement-content');
  if (!el || !invoiceId) return;
  const inv = store.get(KEYS.invoices).find(i => i.id === invoiceId);
  if (!inv) return;
  const today = new Date().toLocaleDateString('fr-FR');
  el.innerHTML = `
    <div class="print-doc" id="ordo-doc">
      <div class="print-doc-header">
        <div class="org">PORT AUTONOME DE KRIBI – REPRÉSENTATION DE DOUALA</div>
        <div class="title">FICHE D'ORDONNANCEMENT DE DÉPENSE</div>
        <div class="ref">Réf : ${inv.ref} | ${today}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:0.85rem">
        <tr><td style="width:45%;color:#607d8b;padding:6px 0">N° de la facture :</td><td><strong>${inv.ref}</strong></td></tr>
        <tr><td style="color:#607d8b;padding:6px 0">Fournisseur :</td><td><strong>${getSupplierName(inv.supplierId)}</strong></td></tr>
        <tr><td style="color:#607d8b;padding:6px 0">Date de la facture :</td><td>${fmtDate(inv.date)}</td></tr>
        <tr><td style="color:#607d8b;padding:6px 0">Objet :</td><td>${inv.label || '—'}</td></tr>
        <tr><td style="color:#607d8b;padding:6px 0">Ligne budgétaire :</td><td><strong>${inv.line}</strong></td></tr>
        <tr><td style="color:#607d8b;padding:6px 0">Plan annuel :</td><td>${getLineConfig(inv.line)?.pa || '—'}</td></tr>
        <tr><td style="color:#607d8b;padding:6px 0">Trimestre :</td><td><strong>${inv.quarter} 2026</strong></td></tr>
        <tr><td style="color:#607d8b;padding:6px 0">Montant HT :</td><td>${fmt(inv.ht)}</td></tr>
        <tr><td style="color:#607d8b;padding:6px 0">TVA (19.25%) :</td><td>${fmt(inv.tva)}</td></tr>
        <tr><td style="color:#607d8b;padding:6px 0">AIR :</td><td>${fmt(inv.air)}</td></tr>
        <tr><td style="color:#607d8b;padding:6px 0">Montant TTC :</td><td>${fmt(inv.ttc)}</td></tr>
        <tr style="background:#0a2d6e;color:white">
          <td style="padding:10px;font-weight:700">NET À PAYER :</td>
          <td style="padding:10px;font-weight:800;font-size:1.1rem">${fmt(inv.nap)}</td>
        </tr>
      </table>
      <div style="margin-bottom:20px">
        <div style="font-size:0.75rem;font-weight:700;color:var(--pak-primary);margin-bottom:8px">VÉRIFICATION BUDGÉTAIRE</div>
        ${(() => {
          const cfg = getLineConfig(inv.line);
          const consumed = getConsumedByLineAndQuarter(inv.line, inv.quarter);
          const available = cfg ? cfg.quarterly - consumed : 0;
          const over = available < inv.nap;
          return `<p style="font-size:0.82rem;${over ? 'color:red' : 'color:green'}">
            Budget ${inv.quarter} ligne ${inv.line} : ${fmt(cfg?.quarterly)} | Engagé : ${fmt(consumed)} | Disponible : ${fmt(available)}
            ${over ? ' ⚠️ ATTENTION : DÉPASSEMENT BUDGÉTAIRE' : ' ✅ DANS LES LIMITES BUDGÉTAIRES'}
          </p>`;
        })()}
      </div>
      <div class="signature-grid">
        <div class="sig-box"><div class="sig-area"></div><div class="sig-role">CONTRÔLEUR</div><div class="sig-name">Mme BANINI Sandrine</div></div>
        <div class="sig-box"><div class="sig-area"></div><div class="sig-role">RÉGISSEUR</div><div class="sig-name">Mme KANGE Polivone</div></div>
        <div class="sig-box"><div class="sig-area"></div><div class="sig-role">ORDONNATEUR</div><div class="sig-name">M. MOHAMMED IYA Habib</div></div>
      </div>
    </div>`;
}

function generatePV(invoiceId) {
  const el = document.getElementById('doc-reception-content');
  if (!el || !invoiceId) return;
  const inv = store.get(KEYS.invoices).find(i => i.id === invoiceId);
  if (!inv) return;
  const today = new Date().toLocaleDateString('fr-FR');
  el.innerHTML = `
    <div class="print-doc" id="pv-doc">
      <div class="print-doc-header">
        <div class="org">PORT AUTONOME DE KRIBI – REPRÉSENTATION DE DOUALA</div>
        <div class="title">PROCÈS-VERBAL DE RÉCEPTION DES PRESTATIONS</div>
        <div class="ref">Réf Facture : ${inv.ref} | Date : ${today}</div>
      </div>
      <p style="font-size:0.85rem;margin-bottom:16px">Nous soussignés, membres de la commission de réception ci-dessous désignés, attestons avoir réceptionné les prestations ci-après :</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:0.85rem">
        <tr><td style="width:45%;color:#607d8b;padding:6px 0">Prestataire :</td><td><strong>${getSupplierName(inv.supplierId)}</strong></td></tr>
        <tr><td style="color:#607d8b;padding:6px 0">N° Facture :</td><td>${inv.ref}</td></tr>
        <tr><td style="color:#607d8b;padding:6px 0">Objet des prestations :</td><td>${inv.label || '—'}</td></tr>
        <tr><td style="color:#607d8b;padding:6px 0">Date de la facture :</td><td>${fmtDate(inv.date)}</td></tr>
        <tr><td style="color:#607d8b;padding:6px 0">Ligne budgétaire :</td><td>${inv.line}</td></tr>
        <tr><td style="color:#607d8b;padding:6px 0">Net à Payer :</td><td style="font-weight:700">${fmt(inv.nap)}</td></tr>
      </table>
      <div style="border:1.5px solid var(--pak-lighter);border-radius:8px;padding:14px;margin-bottom:20px">
        <div style="font-size:0.75rem;font-weight:700;color:var(--pak-primary);margin-bottom:8px">CONSTAT DE RÉCEPTION</div>
        <p style="font-size:0.82rem">Les prestations décrites ci-dessus ont été réalisées et réceptionnées conformément aux conditions convenues.</p>
        <div style="margin-top:12px;font-size:0.82rem">
          <p>☐ Prestation conforme et entièrement réalisée</p>
          <p style="margin-top:6px">☐ Prestation partiellement réalisée – Observations : ________________________</p>
          <p style="margin-top:6px">☐ Prestation non conforme – Motif : _______________________________________</p>
        </div>
      </div>
      <div style="margin-bottom:8px;font-size:0.78rem;color:#607d8b">Date de réception effective : ${today}</div>
      <div class="signature-grid">
        <div class="sig-box"><div class="sig-area"></div><div class="sig-role">BÉNÉFICIAIRE</div><div class="sig-name">______________________</div></div>
        <div class="sig-box"><div class="sig-area"></div><div class="sig-role">RÉGISSEUR</div><div class="sig-name">Mme KANGE Polivone</div></div>
        <div class="sig-box"><div class="sig-area"></div><div class="sig-role">ORDONNATEUR</div><div class="sig-name">M. MOHAMMED IYA Habib</div></div>
      </div>
    </div>`;
}

function renderAuditReportDoc() {
  const el = document.getElementById('doc-audit-content');
  if (!el) return;
  const q         = APP.currentQuarter;
  const today     = new Date().toLocaleDateString('fr-FR');
  const invoices  = store.get(KEYS.invoices).filter(i => i.quarter === q);
  const anomalies = detectAnomalies();
  const checkState = getAuditChecklistState(q);
  const checkedCount = Object.values(checkState).filter(Boolean).length;

  el.innerHTML = `
    <div class="print-doc" id="audit-report-doc">
      <div class="print-doc-header">
        <div class="org">PORT AUTONOME DE KRIBI – DIVISION AUDIT ET QUALITÉ</div>
        <div class="title">RAPPORT D'AUDIT TRIMESTRIEL DE LA CAISSE D'AVANCE</div>
        <div class="ref">Période : ${q.replace('Q','T')} 2026 | Date : ${today}</div>
      </div>
      <div style="margin-bottom:16px">
        <div style="font-size:0.85rem;font-weight:700;color:var(--pak-primary);margin-bottom:8px">1. INFORMATIONS GÉNÉRALES</div>
        <p style="font-size:0.82rem">Budget annuel net : <strong>${fmt(BUDGET_CONFIG.annual_total)}</strong> | Dotation ${q.replace('Q','T')} : <strong>${fmt(BUDGET_CONFIG.quarterly_total)}</strong></p>
        <p style="font-size:0.82rem">Nombre de factures traitées : <strong>${invoices.length}</strong> | Score conformité audit : <strong>${checkedCount}/${AUDIT_CHECKLIST_ITEMS.length} (${Math.round(checkedCount/AUDIT_CHECKLIST_ITEMS.length*100)}%)</strong></p>
      </div>
      <div style="margin-bottom:16px">
        <div style="font-size:0.85rem;font-weight:700;color:var(--pak-primary);margin-bottom:8px">2. SYNTHÈSE PAR LIGNE BUDGÉTAIRE</div>
        <table style="width:100%;border-collapse:collapse;font-size:0.82rem">
          <thead><tr style="background:var(--pak-primary);color:white">
            <th style="padding:7px 10px">Code</th><th style="padding:7px 10px">Libellé</th>
            <th style="padding:7px 10px;text-align:right">Budget T.</th>
            <th style="padding:7px 10px;text-align:right">Engagé</th>
            <th style="padding:7px 10px;text-align:right">Disponible</th>
            <th style="padding:7px 10px;text-align:center">%</th>
          </tr></thead>
          <tbody>
            ${BUDGET_CONFIG.lines.map(l => {
              const consumed = getConsumedByLineAndQuarter(l.code, q);
              const pct = Math.round(l.quarterly > 0 ? consumed/l.quarterly*100 : 0);
              const over = consumed > l.quarterly;
              return `<tr style="border-bottom:1px solid #dde3ed${over ? ';background:#fff8f8' : ''}">
                <td style="padding:7px 10px">${l.code}</td>
                <td style="padding:7px 10px">${l.label_fr}</td>
                <td style="padding:7px 10px;text-align:right">${fmt(l.quarterly)}</td>
                <td style="padding:7px 10px;text-align:right;font-weight:700${over ? ';color:red' : ''}">${fmt(consumed)}</td>
                <td style="padding:7px 10px;text-align:right${over ? ';color:red' : ''}">${fmt(l.quarterly - consumed)}</td>
                <td style="padding:7px 10px;text-align:center${pct >= 100 ? ';color:red;font-weight:700' : ''}">${pct}%</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-bottom:16px">
        <div style="font-size:0.85rem;font-weight:700;color:var(--pak-primary);margin-bottom:8px">3. ANOMALIES CONSTATÉES (${anomalies.length})</div>
        ${anomalies.length === 0
          ? '<p style="color:green;font-size:0.82rem">✅ Aucune anomalie détectée.</p>'
          : anomalies.map((a, i) => `<p style="font-size:0.82rem;margin-bottom:4px"><strong>${i+1}. ${a.type} :</strong> ${a.detail}</p>`).join('')}
      </div>
      <div style="margin-bottom:20px">
        <div style="font-size:0.85rem;font-weight:700;color:var(--pak-primary);margin-bottom:8px">4. RECOMMANDATIONS</div>
        <ul style="font-size:0.82rem;padding-left:18px">
          <li>Toujours payer le NET À PAYER (jamais le TTC) conformément à la Note de Service N°025/2019</li>
          <li>Vérifier la validité du NIU de tous les prestataires avant paiement</li>
          <li>S'assurer que toutes les factures sont adressées au PAK</li>
          <li>Obtenir un PV de réception signé pour chaque prestation</li>
          <li>Respecter les lignes budgétaires autorisées sans dépassement</li>
          <li>Mettre à jour l'ERP en temps réel après chaque opération</li>
        </ul>
      </div>
      <div class="signature-grid">
        <div class="sig-box"><div class="sig-area"></div><div class="sig-role">AUDITEUR</div><div class="sig-name">______________________</div></div>
        <div class="sig-box"><div class="sig-area"></div><div class="sig-role">CHEF RDLA</div><div class="sig-name">M. MOHAMMED IYA Habib</div></div>
        <div class="sig-box"><div class="sig-area"></div><div class="sig-role">DAQ</div><div class="sig-name">______________________</div></div>
      </div>
    </div>`;
}

function printDoc(type) {
  const docIds = {
    arrest: 'arrest-doc',
    ordonnancement: 'ordo-doc',
    reception: 'pv-doc',
    audit: 'audit-report-doc',
  };
  const el = document.getElementById(docIds[type]);
  if (!el) { toast('Document non généré. Sélectionnez une facture.', 'warning'); return; }
  printElement(el);
}

function printElement(el) {
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>PAKAZURE – PAK RDLA</title>
    <link rel="stylesheet" href="css/style.css"/>
    <style>
      body { padding: 30px; font-family: 'Segoe UI', sans-serif; }
      @media print { body { padding: 0; } }
    </style>
    </head><body>
    <div style="text-align:center;margin-bottom:20px">
      <img src="https://static.wixstatic.com/media/ccfac3_e82eb7f271cb42709c78ae85c0aaf01f~mv2.jpg/v1/fill/w_144,h_122,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/PAKAZURE_JPG.jpg" style="height:60px;margin-bottom:8px"/>
      <div style="font-size:0.65rem;letter-spacing:2px;color:#607d8b;font-weight:700">PAKAZURE</div>
    </div>
    ${el.outerHTML}
    <script>window.onload = () => { window.print(); }<\/script>
    </body></html>`);
  win.document.close();
}
