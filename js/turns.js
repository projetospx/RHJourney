// ============================================================
// SHOPEE JOURNEY
// GESTÃO DE TURNOS POR OPERAÇÃO
// Arquivo completo: js/turns.js
// ============================================================

(function () {
  'use strict';

  const STATE = {
    profile: null,
    operations: [],
    periods: [],
    search: ''
  };

  document.addEventListener('DOMContentLoaded', initializeTurnsModule);

  async function initializeTurnsModule() {
    bindNavigationCapture();

    try {
      await loadIdentity();
      updateMenuVisibility();
      setTimeout(updateMenuVisibility, 300);
      setTimeout(updateMenuVisibility, 1000);
    } catch (error) {
      console.warn('Shopee Journey / Turnos: identidade ainda não disponível.', error);
    }
  }

  async function loadIdentity() {
    const { data: sessionData, error: sessionError } = await journeySupabase.auth.getSession();
    if (sessionError) throw sessionError;

    const user = sessionData?.session?.user || null;
    if (!user) return;

    const { data: profile, error: profileError } = await journeySupabase
      .from('profiles')
      .select('id, full_name, role, active')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;
    STATE.profile = profile;
  }

  function canManage() {
    return STATE.profile?.role === 'ADMIN_RH';
  }

  function updateMenuVisibility() {
    const menu = document.querySelector('[data-page="turns"]');
    if (!menu) return;
    menu.style.display = canManage() ? '' : 'none';
  }

  function bindNavigationCapture() {
    document.addEventListener(
      'click',
      event => {
        const target = event.target.closest('[data-page="turns"]');
        if (!target) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        openTurnsPage();
      },
      true
    );
  }

  async function openTurnsPage() {
    try {
      if (!STATE.profile) await loadIdentity();
      if (!canManage()) return;

      document.querySelectorAll('[data-page]').forEach(item => {
        item.classList.toggle('active', item.dataset.page === 'turns');
      });

      const title = document.getElementById('pageTitle');
      const subtitle = document.getElementById('pageSubtitle');
      if (title) title.textContent = 'Turnos';
      if (subtitle) subtitle.textContent = 'Cadastre MANHÃ, NOITE ou outros turnos por operação.';

      const host = getHost();
      if (!host) return;
      host.innerHTML = '<div class="page-loading">Carregando turnos...</div>';

      await loadData();
      renderPage();
    } catch (error) {
      console.error('Erro ao abrir Turnos:', error);
      const host = getHost();
      if (host) {
        host.innerHTML = `
          <div class="turns-error">
            <h2>Não foi possível carregar os turnos.</h2>
            <p>${escapeHTML(error.message || 'Erro desconhecido.')}</p>
          </div>
        `;
      }
    }
  }

  function getHost() {
    return document.getElementById('pageContent') || document.querySelector('.page-content');
  }

  async function loadData() {
    const [operationsResult, periodsResult] = await Promise.all([
      journeySupabase
        .from('operations')
        .select('id, name, regional_id, use_period_filter, active, regionals(id,name)')
        .eq('active', true)
        .order('name'),

      journeySupabase
        .from('operation_periods')
        .select('id, operation_id, name')
        .order('name')
    ]);

    if (operationsResult.error) throw operationsResult.error;
    if (periodsResult.error) throw periodsResult.error;

    STATE.operations = operationsResult.data || [];
    STATE.periods = periodsResult.data || [];
  }

  function renderPage() {
    const host = getHost();
    if (!host) return;

    const configured = STATE.operations.filter(operation => periodsFor(operation.id).length > 0).length;
    const usingFilter = STATE.operations.filter(operation => operation.use_period_filter).length;

    host.innerHTML = `
      <div class="turns-metrics-grid">
        ${metric('Operações', STATE.operations.length, 'Operações ativas')}
        ${metric('Com turnos', configured, 'Possuem turnos cadastrados')}
        ${metric('Filtro por turno', usingFilter, 'Usam turno na elegibilidade')}
        ${metric('Turnos cadastrados', STATE.periods.length, 'Total de registros')}
      </div>

      <section class="turns-panel">
        <div class="turns-panel-head">
          <div>
            <h2>Turnos por operação</h2>
            <p>O TURNO classifica o colaborador e pode limitar quais líderes são elegíveis. A ESCALA continua sendo o horário real.</p>
          </div>

          <label class="turns-search">
            <span>Buscar operação</span>
            <input id="turnsSearch" type="search" placeholder="Ex.: HUB-LPA-03" value="${escapeHTML(STATE.search)}">
          </label>
        </div>

        <div id="turnsOperationsHost" class="turns-operations-grid"></div>
      </section>
    `;

    document.getElementById('turnsSearch')?.addEventListener('input', event => {
      STATE.search = event.target.value;
      renderOperations();
    });

    renderOperations();
  }

  function metric(label, value, description) {
    return `
      <article class="turns-metric">
        <small>${escapeHTML(label)}</small>
        <strong>${escapeHTML(value)}</strong>
        <span>${escapeHTML(description)}</span>
      </article>
    `;
  }

  function renderOperations() {
    const host = document.getElementById('turnsOperationsHost');
    if (!host) return;

    const search = normalize(STATE.search);
    const operations = STATE.operations.filter(operation => {
      const regional = relationObject(operation.regionals)?.name || '';
      return !search || normalize(`${operation.name} ${regional}`).includes(search);
    });

    host.innerHTML = operations.length
      ? operations.map(renderOperationCard).join('')
      : '<div class="turns-empty">Nenhuma operação encontrada.</div>';

    bindOperationActions(host);
  }

  function renderOperationCard(operation) {
    const regional = relationObject(operation.regionals)?.name || '';
    const periods = periodsFor(operation.id);

    return `
      <article class="turns-operation-card" data-turns-operation-card="${escapeHTML(operation.id)}">
        <div class="turns-operation-head">
          <div>
            <small>${escapeHTML(regional || 'REGIONAL')}</small>
            <h3>${escapeHTML(operation.name)}</h3>
            <p>${periods.length} turno(s) cadastrado(s)</p>
          </div>

          <label class="turns-switch-row">
            <input
              type="checkbox"
              data-period-filter-toggle="${escapeHTML(operation.id)}"
              ${operation.use_period_filter ? 'checked' : ''}
            >
            <span>
              <strong>Usar turno para liderança</strong>
              <small>${operation.use_period_filter ? 'Ativado' : 'Desativado'}</small>
            </span>
          </label>
        </div>

        <div class="turns-period-list">
          ${periods.length
            ? periods.map(period => `
                <div class="turns-period-row">
                  <div>
                    <span class="turns-period-icon">${periodIcon(period.name)}</span>
                    <strong>${escapeHTML(period.name)}</strong>
                  </div>
                  <div class="turns-row-actions">
                    <button class="turns-secondary-button" type="button" data-edit-period="${escapeHTML(period.id)}">Editar</button>
                    <button class="turns-danger-button" type="button" data-delete-period="${escapeHTML(period.id)}">Excluir</button>
                  </div>
                </div>
              `).join('')
            : '<div class="turns-empty-inline">Nenhum turno cadastrado nesta operação.</div>'}
        </div>

        <div class="turns-operation-actions">
          <button class="turns-secondary-button" type="button" data-create-default-periods="${escapeHTML(operation.id)}">
            + Criar MANHÃ e NOITE
          </button>
          <button class="turns-primary-button" type="button" data-create-period="${escapeHTML(operation.id)}">
            + Novo turno
          </button>
        </div>
      </article>
    `;
  }

  function bindOperationActions(host) {
    host.querySelectorAll('[data-period-filter-toggle]').forEach(input => {
      input.addEventListener('change', () => toggleOperationPeriodFilter(input.dataset.periodFilterToggle, input.checked));
    });

    host.querySelectorAll('[data-create-period]').forEach(button => {
      button.addEventListener('click', () => openPeriodModal(button.dataset.createPeriod, null));
    });

    host.querySelectorAll('[data-create-default-periods]').forEach(button => {
      button.addEventListener('click', () => createDefaultPeriods(button.dataset.createDefaultPeriods));
    });

    host.querySelectorAll('[data-edit-period]').forEach(button => {
      const period = STATE.periods.find(item => item.id === button.dataset.editPeriod);
      button.addEventListener('click', () => openPeriodModal(period?.operation_id, period || null));
    });

    host.querySelectorAll('[data-delete-period]').forEach(button => {
      button.addEventListener('click', () => deletePeriod(button.dataset.deletePeriod));
    });
  }

  async function toggleOperationPeriodFilter(operationId, enabled) {
    try {
      if (enabled && !periodsFor(operationId).length) {
        throw new Error('Cadastre ao menos um turno antes de ativar o filtro por turno.');
      }

      const { error } = await journeySupabase
        .from('operations')
        .update({ use_period_filter: enabled })
        .eq('id', operationId);

      if (error) throw error;

      const operation = STATE.operations.find(item => item.id === operationId);
      if (operation) operation.use_period_filter = enabled;

      renderOperations();
    } catch (error) {
      alert(error.message || 'Não foi possível alterar a configuração.');
      renderOperations();
    }
  }

  async function createDefaultPeriods(operationId) {
    const existing = periodsFor(operationId).map(item => normalize(item.name));
    const rows = [];

    if (!existing.includes('manha')) rows.push({ operation_id: operationId, name: 'MANHÃ' });
    if (!existing.includes('noite')) rows.push({ operation_id: operationId, name: 'NOITE' });

    if (!rows.length) {
      alert('MANHÃ e NOITE já estão cadastrados nesta operação.');
      return;
    }

    try {
      const { error } = await journeySupabase.from('operation_periods').insert(rows);
      if (error) throw error;

      await loadData();
      renderPage();
      alert('Turnos padrão cadastrados com sucesso.');
    } catch (error) {
      alert(error.message || 'Não foi possível cadastrar os turnos.');
    }
  }

  function openPeriodModal(operationId, period) {
    closePeriodModal();

    const operation = STATE.operations.find(item => item.id === operationId);
    if (!operation) return;

    const overlay = document.createElement('div');
    overlay.id = 'turnsModal';
    overlay.className = 'turns-modal-overlay';
    overlay.innerHTML = `
      <div class="turns-modal-card">
        <div class="turns-modal-header">
          <div>
            <small>${period ? 'EDITAR TURNO' : 'NOVO TURNO'}</small>
            <h2>${escapeHTML(operation.name)}</h2>
            <p>Exemplos: MANHÃ, NOITE, MADRUGADA.</p>
          </div>
          <button type="button" class="turns-modal-close" data-close-turns-modal>×</button>
        </div>

        <form id="turnsPeriodForm" class="turns-modal-body">
          <label class="turns-field">
            <span>Nome do turno *</span>
            <input id="turnsPeriodName" type="text" maxlength="40" required value="${escapeHTML(period?.name || '')}" placeholder="Ex.: MANHÃ">
          </label>

          <div class="turns-quick-options">
            <button type="button" data-quick-period="MANHÃ">☀ MANHÃ</button>
            <button type="button" data-quick-period="NOITE">☾ NOITE</button>
          </div>

          <div class="turns-modal-footer">
            <button type="button" class="turns-secondary-button" data-close-turns-modal>Cancelar</button>
            <button id="turnsSavePeriodButton" type="submit" class="turns-primary-button">${period ? 'Salvar alteração' : 'Cadastrar turno'}</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelectorAll('[data-close-turns-modal]').forEach(button => {
      button.addEventListener('click', closePeriodModal);
    });

    overlay.querySelectorAll('[data-quick-period]').forEach(button => {
      button.addEventListener('click', () => {
        const input = document.getElementById('turnsPeriodName');
        if (input) input.value = button.dataset.quickPeriod;
      });
    });

    overlay.addEventListener('click', event => {
      if (event.target === overlay) closePeriodModal();
    });

    document.getElementById('turnsPeriodForm')?.addEventListener('submit', event => savePeriod(event, operationId, period));
  }

  async function savePeriod(event, operationId, period) {
    event.preventDefault();

    const button = document.getElementById('turnsSavePeriodButton');
    setBusy(button, true, 'Salvando...');

    try {
      const name = String(document.getElementById('turnsPeriodName')?.value || '').trim().toUpperCase();
      if (!name) throw new Error('Informe o nome do turno.');

      const duplicate = periodsFor(operationId).find(item =>
        item.id !== period?.id && normalize(item.name) === normalize(name)
      );
      if (duplicate) throw new Error('Já existe um turno com esse nome nesta operação.');

      if (period) {
        const { error } = await journeySupabase
          .from('operation_periods')
          .update({ name })
          .eq('id', period.id);
        if (error) throw error;
      } else {
        const { error } = await journeySupabase
          .from('operation_periods')
          .insert({ operation_id: operationId, name });
        if (error) throw error;
      }

      closePeriodModal();
      await loadData();
      renderPage();
    } catch (error) {
      alert(error.message || 'Não foi possível salvar o turno.');
    } finally {
      setBusy(button, false, period ? 'Salvar alteração' : 'Cadastrar turno');
    }
  }

  async function deletePeriod(periodId) {
    const period = STATE.periods.find(item => item.id === periodId);
    if (!period) return;

    if (!confirm(`Excluir o turno ${period.name}?\n\nSe já houver colaborador ou líder vinculado a ele, a exclusão será bloqueada.`)) {
      return;
    }

    try {
      const [employmentResult, leaderResult] = await Promise.all([
        journeySupabase
          .from('employments')
          .select('id', { count: 'exact', head: true })
          .eq('period_id', periodId),
        journeySupabase
          .from('leader_operation_periods')
          .select('leader_id', { count: 'exact', head: true })
          .eq('period_id', periodId)
      ]);

      if (employmentResult.error) throw employmentResult.error;
      if (leaderResult.error) throw leaderResult.error;

      if ((employmentResult.count || 0) > 0 || (leaderResult.count || 0) > 0) {
        throw new Error('Este turno já está em uso por colaborador(es) ou liderança(s). Remova os vínculos antes de excluir.');
      }

      const { error } = await journeySupabase
        .from('operation_periods')
        .delete()
        .eq('id', periodId);

      if (error) throw error;

      await loadData();
      renderPage();
    } catch (error) {
      alert(error.message || 'Não foi possível excluir o turno.');
    }
  }

  function periodsFor(operationId) {
    return STATE.periods.filter(period => period.operation_id === operationId);
  }

  function relationObject(value) {
    if (!value) return null;
    return Array.isArray(value) ? (value[0] || null) : value;
  }

  function periodIcon(name) {
    const normalized = normalize(name);
    if (normalized.includes('manha')) return '☀';
    if (normalized.includes('noite') || normalized.includes('madrugada')) return '☾';
    return '◷';
  }

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function setBusy(button, busy, text) {
    if (!button) return;
    if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
    button.disabled = busy;
    button.textContent = busy ? text : (button.dataset.originalText || text);
  }

  function closePeriodModal() {
    document.getElementById('turnsModal')?.remove();
  }

  window.loadTurnsPage = openTurnsPage;

  console.log('Shopee Journey: turns.js carregado.');
})();
