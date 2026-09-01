// ============================================================
// RH JOURNEY
// CONFIGURAÇÕES — BPOs, OPERAÇÕES E TURNOS
// Módulo isolado. Não altera login, app.js, avaliações ou usuários.
// ============================================================

(function () {
  'use strict';

  const STATE = {
    profile: null,
    bpos: [],
    operations: [],
    periods: [],
    tab: 'bpos',
    search: ''
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeStructureSettings);
  } else {
    initializeStructureSettings();
  }

  function initializeStructureSettings() {
    document.addEventListener('click', captureSettingsNavigation, true);
  }

  function captureSettingsNavigation(event) {
    const target = event.target.closest('[data-page="settings"]');
    if (!target) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openStructureSettings();
  }

  async function openStructureSettings() {
    const host = getHost();
    if (!host) return;

    try {
      await ensureAdminProfile();
      setPageChrome();
      host.innerHTML = '<div class="structure-loading">Carregando configurações...</div>';
      await loadStructureData();
      renderStructurePage();
    } catch (error) {
      console.error('RH Journey / Configurações:', error);
      host.innerHTML = renderError(error);
    }
  }

  async function ensureAdminProfile() {
    if (STATE.profile?.role === 'ADMIN_RH' && STATE.profile?.active !== false) return;

    const { data: sessionData, error: sessionError } =
      await journeySupabase.auth.getSession();

    if (sessionError) throw sessionError;

    const user = sessionData?.session?.user;
    if (!user) throw new Error('Sessão não encontrada. Entre novamente.');

    const { data: profile, error: profileError } =
      await journeySupabase
        .from('profiles')
        .select('id, role, active')
        .eq('id', user.id)
        .single();

    if (profileError) throw profileError;

    STATE.profile = profile;

    if (profile?.role !== 'ADMIN_RH' || profile?.active === false) {
      throw new Error('Esta configuração é exclusiva do perfil ADMIN / RH.');
    }
  }

  function setPageChrome() {
    document.querySelectorAll('[data-page]').forEach(item => {
      item.classList.toggle('active', item.dataset.page === 'settings');
    });

    const title = document.getElementById('pageTitle');
    const subtitle = document.getElementById('pageSubtitle');

    if (title) title.textContent = 'Configurações';
    if (subtitle) subtitle.textContent = 'Estrutura de BPOs, operações e turnos.';
  }

  async function loadStructureData() {
    const [bposResult, operationsResult, periodsResult] = await Promise.all([
      journeySupabase
        .from('bpos')
        .select('id, name, active, created_at, updated_at')
        .order('name'),

      journeySupabase
        .from('operations')
        .select('id, name, active, regional_id, use_period_filter, regionals(id,name)')
        .order('name'),

      journeySupabase
        .from('operation_periods')
        .select('id, operation_id, name, active, created_at, updated_at')
        .order('name')
    ]);

    if (bposResult.error) throw bposResult.error;
    if (operationsResult.error) throw operationsResult.error;
    if (periodsResult.error) throw periodsResult.error;

    STATE.bpos = bposResult.data || [];
    STATE.operations = operationsResult.data || [];
    STATE.periods = periodsResult.data || [];
  }

  function renderStructurePage() {
    const host = getHost();
    if (!host) return;

    host.innerHTML = `
      <section class="structure-page">
        <div class="structure-summary">
          ${metricCard('BPOs ativas', STATE.bpos.filter(item => item.active !== false).length)}
          ${metricCard('Operações', STATE.operations.filter(item => item.active !== false).length)}
          ${metricCard('Turnos ativos', STATE.periods.filter(item => item.active !== false).length)}
          ${metricCard('Filtro por turno', STATE.operations.filter(item => item.use_period_filter).length)}
        </div>

        <div class="structure-panel">
          <div class="structure-panel-head">
            <div>
              <small>ESTRUTURA CADASTRAL</small>
              <h2>Configurações operacionais</h2>
              <p>Cadastre classificações. Nenhum horário é usado para inferir o turno.</p>
            </div>
            <div id="structureNotice" class="structure-notice" role="status" aria-live="polite"></div>
          </div>

          <div class="structure-toolbar">
            <div class="structure-tabs" role="tablist" aria-label="Configurações de estrutura">
              <button type="button" role="tab" data-structure-tab="bpos" class="${STATE.tab === 'bpos' ? 'active' : ''}">BPOs</button>
              <button type="button" role="tab" data-structure-tab="operations" class="${STATE.tab === 'operations' ? 'active' : ''}">Operações e turnos</button>
            </div>

            <label class="structure-search">
              <span>Buscar</span>
              <input id="structureSearch" type="search" value="${escapeHTML(STATE.search)}" placeholder="Digite um nome...">
            </label>
          </div>

          <div id="structureContent"></div>
        </div>
      </section>
    `;

    bindPageEvents();
    renderActiveTab();
  }

  function metricCard(label, value) {
    return `
      <article class="structure-metric">
        <small>${escapeHTML(label)}</small>
        <strong>${Number(value || 0)}</strong>
      </article>
    `;
  }

  function bindPageEvents() {
    document.querySelectorAll('[data-structure-tab]').forEach(button => {
      button.addEventListener('click', () => {
        STATE.tab = button.dataset.structureTab;
        STATE.search = '';
        renderStructurePage();
      });
    });

    document.getElementById('structureSearch')?.addEventListener('input', event => {
      STATE.search = event.target.value || '';
      renderActiveTab();
    });
  }

  function renderActiveTab() {
    if (STATE.tab === 'operations') {
      renderOperationsTab();
      return;
    }

    renderBposTab();
  }

  function renderBposTab() {
    const content = document.getElementById('structureContent');
    if (!content) return;

    const search = normalize(STATE.search);
    const rows = STATE.bpos.filter(item => !search || normalize(item.name).includes(search));

    content.innerHTML = `
      <div class="structure-section-head">
        <div>
          <h3>BPOs</h3>
          <p>Cadastre, edite ou inative sem apagar vínculos existentes.</p>
        </div>
        <button type="button" class="structure-primary" id="newBpoButton">+ Nova BPO</button>
      </div>

      <div class="structure-list">
        ${rows.length ? rows.map(renderBpoRow).join('') : renderEmpty('Nenhuma BPO encontrada.')}
      </div>
    `;

    document.getElementById('newBpoButton')?.addEventListener('click', () => openBpoModal());

    content.querySelectorAll('[data-edit-bpo]').forEach(button => {
      button.addEventListener('click', () => {
        openBpoModal(STATE.bpos.find(item => item.id === button.dataset.editBpo));
      });
    });

    content.querySelectorAll('[data-toggle-bpo]').forEach(button => {
      button.addEventListener('click', () => toggleBpo(button.dataset.toggleBpo));
    });
  }

  function renderBpoRow(item) {
    const active = item.active !== false;
    return `
      <article class="structure-row ${active ? '' : 'inactive'}">
        <div class="structure-row-main">
          <span class="structure-icon">B</span>
          <div>
            <strong>${escapeHTML(item.name)}</strong>
            <small>BPO ${active ? 'ativa' : 'inativa'}</small>
          </div>
        </div>
        <div class="structure-row-actions">
          ${statusPill(active)}
          <button type="button" class="structure-secondary" data-edit-bpo="${escapeHTML(item.id)}">Editar</button>
          <button type="button" class="structure-toggle" data-toggle-bpo="${escapeHTML(item.id)}">${active ? 'Inativar' : 'Ativar'}</button>
        </div>
      </article>
    `;
  }

  function openBpoModal(item = null) {
    openModal(`
      <form id="structureBpoForm" class="structure-modal-card">
        ${modalHeader(item ? 'EDITAR BPO' : 'NOVA BPO', item ? 'Atualize o nome sem alterar os vínculos.' : 'Cadastre uma BPO para uso nos colaboradores.')}
        <div class="structure-modal-body">
          <label class="structure-field">
            <span>Nome da BPO *</span>
            <input id="structureBpoName" type="text" maxlength="80" required value="${escapeHTML(item?.name || '')}" placeholder="Ex.: WECAN">
          </label>
        </div>
        ${modalFooter(item ? 'Salvar alteração' : 'Cadastrar BPO')}
      </form>
    `);

    document.getElementById('structureBpoForm')?.addEventListener('submit', event => saveBpo(event, item));
    document.getElementById('structureBpoName')?.focus();
  }

  async function saveBpo(event, item) {
    event.preventDefault();
    const button = document.getElementById('structureModalSave');
    const name = cleanName(document.getElementById('structureBpoName')?.value);

    try {
      if (!name) throw new Error('Informe o nome da BPO.');

      const duplicate = STATE.bpos.find(row =>
        row.id !== item?.id && normalize(row.name) === normalize(name)
      );
      if (duplicate) throw new Error('Já existe uma BPO com esse nome.');

      setBusy(button, true);

      const query = item
        ? journeySupabase.from('bpos').update({ name }).eq('id', item.id)
        : journeySupabase.from('bpos').insert({ name, active: true });

      const { error } = await query;
      if (error) throw error;

      closeModal();
      await refreshAndRender(item ? 'BPO atualizada.' : 'BPO cadastrada.');
    } catch (error) {
      showModalError(error);
      setBusy(button, false);
    }
  }

  async function toggleBpo(id) {
    const item = STATE.bpos.find(row => row.id === id);
    if (!item) return;

    const nextActive = item.active === false;
    if (!nextActive && !window.confirm(`Inativar a BPO ${item.name}?\n\nOs vínculos existentes serão mantidos.`)) return;

    try {
      const { error } = await journeySupabase
        .from('bpos')
        .update({ active: nextActive })
        .eq('id', id);

      if (error) throw error;
      await refreshAndRender(nextActive ? 'BPO ativada.' : 'BPO inativada.');
    } catch (error) {
      showNotice(error.message || 'Não foi possível alterar a BPO.', true);
    }
  }

  function renderOperationsTab() {
    const content = document.getElementById('structureContent');
    if (!content) return;

    const search = normalize(STATE.search);
    const operations = STATE.operations.filter(operation => {
      const regional = relationObject(operation.regionals)?.name || '';
      return !search || normalize(`${operation.name} ${regional}`).includes(search);
    });

    content.innerHTML = `
      <div class="structure-section-head">
        <div>
          <h3>Operações e turnos</h3>
          <p>O turno é um nome cadastrado por operação; a escala continua sendo um campo separado.</p>
        </div>
      </div>

      <div class="structure-operation-grid">
        ${operations.length ? operations.map(renderOperationCard).join('') : renderEmpty('Nenhuma operação encontrada.')}
      </div>
    `;

    bindOperationEvents(content);
  }

  function renderOperationCard(operation) {
    const regional = relationObject(operation.regionals)?.name || 'Sem regional';
    const periods = periodsFor(operation.id);
    const active = operation.active !== false;

    return `
      <article class="structure-operation ${active ? '' : 'inactive'}">
        <div class="structure-operation-head">
          <div>
            <small>${escapeHTML(regional)}</small>
            <h4>${escapeHTML(operation.name)}</h4>
            <p>${periods.filter(item => item.active !== false).length} turno(s) ativo(s)</p>
          </div>
          ${statusPill(active, active ? 'Operação ativa' : 'Operação inativa')}
        </div>

        <label class="structure-switch ${active ? '' : 'disabled'}">
          <input type="checkbox" data-operation-filter="${escapeHTML(operation.id)}" ${operation.use_period_filter ? 'checked' : ''} ${active ? '' : 'disabled'}>
          <span>
            <strong>Usar filtro de turno para liderança</strong>
            <small>${operation.use_period_filter ? 'Ativado' : 'Desativado'}</small>
          </span>
        </label>

        <div class="structure-period-list">
          ${periods.length
            ? periods.map(renderPeriodRow).join('')
            : '<div class="structure-inline-empty">Nenhum turno cadastrado.</div>'}
        </div>

        <div class="structure-operation-actions">
          <button type="button" class="structure-primary" data-new-period="${escapeHTML(operation.id)}" ${active ? '' : 'disabled'}>+ Novo turno</button>
        </div>
      </article>
    `;
  }

  function renderPeriodRow(period) {
    const active = period.active !== false;
    return `
      <div class="structure-period ${active ? '' : 'inactive'}">
        <div>
          <span class="structure-period-dot"></span>
          <strong>${escapeHTML(period.name)}</strong>
          ${statusPill(active)}
        </div>
        <div>
          <button type="button" class="structure-link" data-edit-period="${escapeHTML(period.id)}">Editar</button>
          <button type="button" class="structure-link" data-toggle-period="${escapeHTML(period.id)}">${active ? 'Inativar' : 'Ativar'}</button>
        </div>
      </div>
    `;
  }

  function bindOperationEvents(content) {
    content.querySelectorAll('[data-operation-filter]').forEach(input => {
      input.addEventListener('change', () => toggleOperationFilter(input.dataset.operationFilter, input.checked));
    });

    content.querySelectorAll('[data-new-period]').forEach(button => {
      button.addEventListener('click', () => openPeriodModal(button.dataset.newPeriod));
    });

    content.querySelectorAll('[data-edit-period]').forEach(button => {
      const period = STATE.periods.find(item => item.id === button.dataset.editPeriod);
      button.addEventListener('click', () => openPeriodModal(period?.operation_id, period));
    });

    content.querySelectorAll('[data-toggle-period]').forEach(button => {
      button.addEventListener('click', () => togglePeriod(button.dataset.togglePeriod));
    });
  }

  async function toggleOperationFilter(operationId, enabled) {
    const input = document.querySelector(`[data-operation-filter="${cssEscape(operationId)}"]`);

    try {
      if (enabled && !periodsFor(operationId).some(item => item.active !== false)) {
        throw new Error('Cadastre e ative ao menos um turno antes de ligar este filtro.');
      }

      const { error } = await journeySupabase
        .from('operations')
        .update({ use_period_filter: enabled })
        .eq('id', operationId);

      if (error) throw error;
      await refreshAndRender(enabled ? 'Filtro por turno ativado.' : 'Filtro por turno desativado.');
    } catch (error) {
      if (input) input.checked = !enabled;
      showNotice(error.message || 'Não foi possível alterar a operação.', true);
    }
  }

  function openPeriodModal(operationId, period = null) {
    const operation = STATE.operations.find(item => item.id === operationId);
    if (!operation) return;

    openModal(`
      <form id="structurePeriodForm" class="structure-modal-card">
        ${modalHeader(period ? 'EDITAR TURNO' : 'NOVO TURNO', operation.name)}
        <div class="structure-modal-body">
          <label class="structure-field">
            <span>Nome do turno *</span>
            <input id="structurePeriodName" type="text" maxlength="40" required value="${escapeHTML(period?.name || '')}" placeholder="Ex.: MANHÃ, NOITE ou TARDE">
          </label>
          <p class="structure-help">Informe apenas a classificação do turno. A escala/horário é cadastrada separadamente no colaborador.</p>
        </div>
        ${modalFooter(period ? 'Salvar alteração' : 'Cadastrar turno')}
      </form>
    `);

    document.getElementById('structurePeriodForm')?.addEventListener('submit', event => savePeriod(event, operationId, period));
    document.getElementById('structurePeriodName')?.focus();
  }

  async function savePeriod(event, operationId, period) {
    event.preventDefault();
    const button = document.getElementById('structureModalSave');
    const name = cleanName(document.getElementById('structurePeriodName')?.value);

    try {
      if (!name) throw new Error('Informe o nome do turno.');

      const duplicate = periodsFor(operationId).find(item =>
        item.id !== period?.id && normalize(item.name) === normalize(name)
      );
      if (duplicate) throw new Error('Já existe um turno com esse nome nesta operação.');

      setBusy(button, true);

      const query = period
        ? journeySupabase.from('operation_periods').update({ name }).eq('id', period.id)
        : journeySupabase.from('operation_periods').insert({ operation_id: operationId, name, active: true });

      const { error } = await query;
      if (error) throw error;

      closeModal();
      await refreshAndRender(period ? 'Turno atualizado.' : 'Turno cadastrado.');
    } catch (error) {
      showModalError(error);
      setBusy(button, false);
    }
  }

  async function togglePeriod(periodId) {
    const period = STATE.periods.find(item => item.id === periodId);
    const operation = STATE.operations.find(item => item.id === period?.operation_id);
    if (!period || !operation) return;

    const nextActive = period.active === false;

    if (!nextActive) {
      const otherActive = periodsFor(period.operation_id).some(item =>
        item.id !== period.id && item.active !== false
      );

      if (operation.use_period_filter && !otherActive) {
        showNotice('Desative primeiro o filtro de turno da operação ou mantenha ao menos um turno ativo.', true);
        return;
      }

      if (!window.confirm(`Inativar o turno ${period.name}?\n\nColaboradores e líderes já vinculados continuarão preservados.`)) return;
    }

    try {
      const { error } = await journeySupabase
        .from('operation_periods')
        .update({ active: nextActive })
        .eq('id', period.id);

      if (error) throw error;
      await refreshAndRender(nextActive ? 'Turno ativado.' : 'Turno inativado.');
    } catch (error) {
      showNotice(error.message || 'Não foi possível alterar o turno.', true);
    }
  }

  async function refreshAndRender(message) {
    await loadStructureData();
    renderStructurePage();
    showNotice(message);
  }

  function periodsFor(operationId) {
    return STATE.periods.filter(item => item.operation_id === operationId);
  }

  function getHost() {
    return document.getElementById('pageContent') || document.querySelector('.page-content');
  }

  function relationObject(value) {
    if (!value) return null;
    return Array.isArray(value) ? value[0] || null : value;
  }

  function statusPill(active, label = '') {
    return `<span class="structure-status ${active ? 'active' : 'inactive'}">${escapeHTML(label || (active ? 'Ativo' : 'Inativo'))}</span>`;
  }

  function renderEmpty(message) {
    return `<div class="structure-empty">${escapeHTML(message)}</div>`;
  }

  function openModal(content) {
    closeModal();

    const overlay = document.createElement('div');
    overlay.id = 'structureModal';
    overlay.className = 'structure-modal-overlay';
    overlay.innerHTML = content;
    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeModal();
    });

    document.body.appendChild(overlay);

    overlay.querySelectorAll('[data-close-structure-modal]').forEach(button => {
      button.addEventListener('click', closeModal);
    });
  }

  function closeModal() {
    document.getElementById('structureModal')?.remove();
  }

  function modalHeader(title, subtitle) {
    return `
      <div class="structure-modal-header">
        <div><small>${escapeHTML(title)}</small><h2>${escapeHTML(subtitle)}</h2></div>
        <button type="button" class="structure-modal-close" data-close-structure-modal aria-label="Fechar">×</button>
      </div>
    `;
  }

  function modalFooter(saveLabel) {
    return `
      <div class="structure-modal-error" id="structureModalError" role="alert"></div>
      <div class="structure-modal-footer">
        <button type="button" class="structure-secondary" data-close-structure-modal>Cancelar</button>
        <button type="submit" class="structure-primary" id="structureModalSave" data-idle-label="${escapeHTML(saveLabel)}">${escapeHTML(saveLabel)}</button>
      </div>
    `;
  }

  function showModalError(error) {
    const node = document.getElementById('structureModalError');
    if (node) node.textContent = error?.message || 'Não foi possível salvar.';
  }

  function showNotice(message, error = false) {
    const node = document.getElementById('structureNotice');
    if (!node) return;
    node.textContent = message || '';
    node.classList.toggle('error', error);
    window.setTimeout(() => {
      if (node.textContent === message) node.textContent = '';
    }, 5000);
  }

  function setBusy(button, busy) {
    if (!button) return;
    button.disabled = busy;
    button.textContent = busy ? 'Salvando...' : button.dataset.idleLabel;
  }

  function cleanName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
  }

  function normalize(value) {
    return cleanName(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return window.CSS.escape(String(value));
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function renderError(error) {
    return `
      <div class="structure-error">
        <h2>Não foi possível abrir Configurações.</h2>
        <p>${escapeHTML(error?.message || 'Erro desconhecido.')}</p>
        <small>Confirme que o SQL deste pacote foi aplicado antes dos arquivos do site.</small>
      </div>
    `;
  }

  window.JourneyStructure = Object.freeze({
    open: openStructureSettings,
    reload: loadStructureData
  });

  console.log('RH Journey: settings-structure.js carregado.');
})();
