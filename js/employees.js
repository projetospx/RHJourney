// ============================================================
// RH JOURNEY
// MÓDULO DE COLABORADORES - RH
// Arquivo completo: js/employees.js
// ============================================================

(function () {
  'use strict';

  const MODULE = {
    profile: null,
    user: null,
    rows: [],
    operations: [],
    periods: [],
    bpos: [],
    leaders: [],
    state: {
      search: '',
      regional: 'ALL',
      operation: 'ALL',
      bpo: 'ALL',
      period: 'ALL',
      leader: 'ALL',
      status: 'ALL',
      page: 1,
      pageSize: 25
    }
  };

  const CHECKPOINT_ORDER = {
    D1: 1,
    D7: 7,
    D15: 15,
    D30: 30,
    D45: 45,
    D90: 90
  };

  // ============================================================
  // INICIALIZAÇÃO
  // ============================================================

  document.addEventListener('DOMContentLoaded', initializeEmployeesModule);

  async function initializeEmployeesModule() {
    injectEmployeesStyles();
    bindNavigationCapture();

    try {
      await loadModuleIdentity();
      fixSidebarIdentity();
      updateEmployeesMenuVisibility();

      // O app principal pode aplicar permissões alguns ms depois.
      setTimeout(updateEmployeesMenuVisibility, 300);
      setTimeout(fixSidebarIdentity, 300);
      setTimeout(updateEmployeesMenuVisibility, 1000);
      setTimeout(fixSidebarIdentity, 1000);
    } catch (error) {
      console.warn('RH Journey / Colaboradores: identidade ainda não disponível.', error);
    }
  }

  async function loadModuleIdentity() {
    const { data: sessionData, error: sessionError } =
      await journeySupabase.auth.getSession();

    if (sessionError) throw sessionError;

    MODULE.user = sessionData?.session?.user || null;

    if (!MODULE.user) return;

    const { data: profile, error: profileError } =
      await journeySupabase
        .from('profiles')
        .select('id, full_name, role, corporate_email, active')
        .eq('id', MODULE.user.id)
        .single();

    if (profileError) throw profileError;

    MODULE.profile = profile;
  }

  function canViewEmployees() {
    return ['ADMIN_RH', 'HR_MANAGER'].includes(MODULE.profile?.role);
  }

  function canEditEmployees() {
    return MODULE.profile?.role === 'ADMIN_RH';
  }

  function updateEmployeesMenuVisibility() {
    const menu = document.querySelector('[data-page="employees"]');
    if (!menu) return;
    menu.style.display = canViewEmployees() ? '' : 'none';
  }

  // ============================================================
  // IDENTIFICAÇÃO DO USUÁRIO NO RODAPÉ
  // ============================================================

  function fixSidebarIdentity() {
    if (!MODULE.profile && !MODULE.user) return;

    const name =
      MODULE.profile?.full_name ||
      MODULE.profile?.corporate_email ||
      MODULE.user?.email ||
      'Usuário';

    const role = roleLabel(MODULE.profile?.role);
    const initials = getInitialsLocal(name);

    const nameNode =
      document.getElementById('sidebarUserName') ||
      document.getElementById('sidebarName') ||
      document.querySelector('[data-user-name]') ||
      document.querySelector('.sidebar-profile strong');

    const roleNode =
      document.getElementById('sidebarUserRole') ||
      document.getElementById('sidebarRole') ||
      document.querySelector('[data-user-role]') ||
      document.querySelector('.sidebar-profile .profile-role') ||
      document.querySelector('.sidebar-profile span');

    const avatarNode =
      document.getElementById('sidebarUserAvatar') ||
      document.getElementById('sidebarAvatar') ||
      document.querySelector('[data-user-avatar]') ||
      document.querySelector('.profile-avatar');

    if (nameNode) nameNode.textContent = name;
    if (roleNode) roleNode.textContent = role;
    if (avatarNode) avatarNode.textContent = initials;
  }

  function roleLabel(role) {
    return {
      ADMIN_RH: 'ADMIN / RH',
      HR_MANAGER: 'GESTOR DE RH',
      LEADER: 'LIDERANÇA',
      EMPLOYEE: 'COLABORADOR'
    }[role] || role || 'USUÁRIO';
  }

  // ============================================================
  // NAVEGAÇÃO SEM PRECISAR ALTERAR O app.js
  // ============================================================

  function bindNavigationCapture() {
    document.addEventListener(
      'click',
      event => {
        const target = event.target.closest('[data-page="employees"]');
        if (!target) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        openEmployeesPage();
      },
      true
    );
  }

  async function openEmployeesPage() {
    try {
      if (!MODULE.profile) {
        await loadModuleIdentity();
      }

      if (!canViewEmployees()) {
        return openFallbackPage();
      }

      setEmployeesActiveNav();
      setEmployeesHeader();
      closeEmployeesModal();
      showEmployeesLoading();
      await loadEmployeesData();
      renderEmployeesPage();
    } catch (error) {
      console.error('Erro ao abrir Colaboradores:', error);
      const host = getPageContent();
      if (host) {
        host.innerHTML = renderModuleError(
          'Não foi possível carregar Colaboradores.',
          error.message
        );
      }
    }
  }

  function openFallbackPage() {
    if (typeof window.openPage === 'function') {
      window.openPage('dashboard');
    }
  }

  function setEmployeesActiveNav() {
    document.querySelectorAll('[data-page]').forEach(item => {
      item.classList.toggle('active', item.dataset.page === 'employees');
    });
  }

  function setEmployeesHeader() {
    const title = document.getElementById('pageTitle');
    const subtitle = document.getElementById('pageSubtitle');

    if (title) title.textContent = 'Colaboradores';
    if (subtitle) {
      subtitle.textContent = canEditEmployees()
        ? 'Cadastro, vínculo, horário, turno e liderança.'
        : 'Consulta cadastral dos colaboradores.';
    }
  }

  function getPageContent() {
    return document.getElementById('pageContent') || document.querySelector('.page-content');
  }

  function showEmployeesLoading() {
    const host = getPageContent();
    if (!host) return;

    host.innerHTML = `
      <div class="employees-loading">
        <div class="employees-spinner"></div>
        <p>Carregando colaboradores...</p>
      </div>
    `;
  }

  // ============================================================
  // CARGA DE DADOS
  // ============================================================

  async function loadEmployeesData() {
    const results = await Promise.all([
      journeySupabase
        .from('employments')
        .select(`
          id,
          person_id,
          bpo_id,
          operation_id,
          period_id,
          leader_id,
          admission_date,
          work_schedule,
          status,

          people (
            id,
            auth_user_id,
            full_name,
            cpf,
            birth_date,
            email,
            phone
          ),

          bpos (
            id,
            name,
            active
          ),

          operations (
            id,
            name,
            regional_id,
            use_period_filter,
            regionals (
              id,
              name
            )
          ),

          period:operation_periods!employments_period_id_fkey (
            id,
            name,
            operation_id,
            active
          ),

          leader:profiles!employments_leader_id_fkey (
            id,
            full_name,
            corporate_email
          ),

          journeys (
            id,
            status,
            started_at,
            completed_at,
            journey_checkpoints (
              id,
              checkpoint,
              opens_at,
              due_at
            )
          )
        `)
        .order('admission_date', { ascending: false }),

      journeySupabase
        .from('operations')
        .select(`
          id,
          name,
          regional_id,
          use_period_filter,
          active,
          regionals (
            id,
            name
          )
        `)
        .eq('active', true)
        .order('name'),

      journeySupabase
        .from('operation_periods')
        .select('id, operation_id, name, active')
        .order('name'),

      journeySupabase
        .from('bpos')
        .select('id, name, active')
        .order('name'),

      journeySupabase
        .from('profiles')
        .select('id, full_name, corporate_email, role, active')
        .eq('role', 'LEADER')
        .eq('active', true)
        .order('full_name')
    ]);

    const [employmentResult, operationResult, periodResult, bpoResult, leaderResult] = results;

    if (employmentResult.error) throw employmentResult.error;
    if (operationResult.error) throw operationResult.error;

    // Períodos podem ainda não estar configurados em operações antigas.
    if (periodResult.error) {
      console.warn('Não foi possível carregar períodos:', periodResult.error);
    }

    if (bpoResult.error) throw bpoResult.error;
    if (leaderResult.error) throw leaderResult.error;

    MODULE.rows = employmentResult.data || [];
    MODULE.operations = operationResult.data || [];
    MODULE.periods = periodResult.data || [];
    MODULE.bpos = bpoResult.data || [];
    MODULE.leaders = leaderResult.data || [];
  }

  // ============================================================
  // RENDER PRINCIPAL
  // ============================================================

  function renderEmployeesPage() {
    const host = getPageContent();
    if (!host) return;

    const total = MODULE.rows.length;
    const waiting = MODULE.rows.filter(row => row.status === 'WAITING').length;
    const active = MODULE.rows.filter(row => row.status === 'IN_JOURNEY').length;
    const noLeader = MODULE.rows.filter(row => !row.leader_id && row.status !== 'COMPLETED').length;
    const needsReview = MODULE.rows.filter(hasRegistrationAttention).length;

    const regionalNames = [...new Set(
      MODULE.operations
        .map(op => relationObjectLocal(op.regionals)?.name)
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    host.innerHTML = `
      <div class="employees-metrics-grid">
        ${employeeMetricCard('Base cadastrada', total, 'Todos os vínculos')}
        ${employeeMetricCard('Em Jornada', active, 'Acompanhamento ativo')}
        ${employeeMetricCard('Aguardando', waiting, 'Jornada ainda não iniciada')}
        ${employeeMetricCard('Sem liderança', noLeader, 'Precisam de identificação', noLeader ? 'attention' : '')}
        ${employeeMetricCard('Cadastro a revisar', needsReview, 'Horário/turno/liderança', needsReview ? 'attention' : '')}
      </div>

      <section class="employees-panel">
        <div class="employees-panel-head">
          <div>
            <h2>Base de Colaboradores</h2>
            <p>
              ${canEditEmployees()
                ? 'Confira e ajuste dados de vínculo sem alterar o histórico da Jornada.'
                : 'Consulte os dados cadastrais e de vínculo.'}
            </p>
          </div>
          <div class="employees-head-badge">${total} registro(s)</div>
        </div>

        <div class="employees-filters">
          <label class="employees-search-field">
            <span>Buscar</span>
            <input id="employeesSearch" type="search" placeholder="Nome, CPF, e-mail ou telefone..." value="${escapeLocal(MODULE.state.search)}">
          </label>

          <label>
            <span>Regional</span>
            <select id="employeesRegionalFilter">
              <option value="ALL">Todas</option>
              ${regionalNames.map(name => optionHTML(name, name, MODULE.state.regional)).join('')}
            </select>
          </label>

          <label>
            <span>Operação</span>
            <select id="employeesOperationFilter">
              <option value="ALL">Todas</option>
              ${MODULE.operations.map(op => optionHTML(op.id, op.name, MODULE.state.operation)).join('')}
            </select>
          </label>

          <label>
            <span>BPO</span>
            <select id="employeesBpoFilter">
              <option value="ALL">Todas</option>
              ${MODULE.bpos.map(bpo => optionHTML(bpo.id, bpo.name, MODULE.state.bpo)).join('')}
            </select>
          </label>

          <label>
            <span>Turno</span>
            <select id="employeesPeriodFilter">
              <option value="ALL">Todos</option>
              <option value="NO_PERIOD" ${MODULE.state.period === 'NO_PERIOD' ? 'selected' : ''}>Sem turno</option>
              ${MODULE.periods.map(period => optionHTML(period.id, period.name, MODULE.state.period)).join('')}
            </select>
          </label>

          <label>
            <span>Líder</span>
            <select id="employeesLeaderFilter">
              <option value="ALL">Todos</option>
              <option value="NO_LEADER" ${MODULE.state.leader === 'NO_LEADER' ? 'selected' : ''}>Sem líder</option>
              ${MODULE.leaders.map(leader => optionHTML(leader.id, leader.full_name, MODULE.state.leader)).join('')}
            </select>
          </label>

          <label>
            <span>Status</span>
            <select id="employeesStatusFilter">
              <option value="ALL">Todos</option>
              ${optionHTML('WAITING', 'Aguardando', MODULE.state.status)}
              ${optionHTML('IN_JOURNEY', 'Em acompanhamento', MODULE.state.status)}
              ${optionHTML('COMPLETED', 'Concluído', MODULE.state.status)}
            </select>
          </label>
        </div>

        <div id="employeesTableHost"></div>
      </section>
    `;

    bindEmployeesFilters();
    renderEmployeesTable();
  }

  function employeeMetricCard(label, value, detail, className = '') {
    return `
      <article class="employees-metric ${className}">
        <small>${escapeLocal(label)}</small>
        <strong>${escapeLocal(value)}</strong>
        <span>${escapeLocal(detail)}</span>
      </article>
    `;
  }

  function hasRegistrationAttention(row) {
    const operation = relationObjectLocal(row.operations);
    const requiresPeriod = !!operation?.use_period_filter;

    return (
      !String(row.work_schedule || '').trim() ||
      (!row.leader_id && row.status !== 'COMPLETED') ||
      (requiresPeriod && !row.period_id)
    );
  }

  // ============================================================
  // FILTROS E PAGINAÇÃO
  // ============================================================

  function bindEmployeesFilters() {
    const search = document.getElementById('employeesSearch');
    const regional = document.getElementById('employeesRegionalFilter');
    const operation = document.getElementById('employeesOperationFilter');
    const bpo = document.getElementById('employeesBpoFilter');
    const period = document.getElementById('employeesPeriodFilter');
    const leader = document.getElementById('employeesLeaderFilter');
    const status = document.getElementById('employeesStatusFilter');

    search?.addEventListener('input', event => {
      MODULE.state.search = event.target.value;
      MODULE.state.page = 1;
      renderEmployeesTable();
    });

    [
      [regional, 'regional'],
      [operation, 'operation'],
      [bpo, 'bpo'],
      [period, 'period'],
      [leader, 'leader'],
      [status, 'status']
    ].forEach(([element, key]) => {
      element?.addEventListener('change', event => {
        MODULE.state[key] = event.target.value;
        MODULE.state.page = 1;
        renderEmployeesTable();
      });
    });
  }

  function getFilteredEmployees() {
    const search = normalizeSearch(MODULE.state.search);

    return MODULE.rows.filter(row => {
      const person = relationObjectLocal(row.people);
      const operation = relationObjectLocal(row.operations);
      const regional = relationObjectLocal(operation?.regionals);

      const searchBlob = normalizeSearch([
        person?.full_name,
        person?.cpf,
        person?.email,
        person?.phone,
        operation?.name,
        relationObjectLocal(row.bpos)?.name,
        relationObjectLocal(row.leader)?.full_name,
        row.work_schedule
      ].filter(Boolean).join(' '));

      if (search && !searchBlob.includes(search)) return false;
      if (MODULE.state.regional !== 'ALL' && regional?.name !== MODULE.state.regional) return false;
      if (MODULE.state.operation !== 'ALL' && row.operation_id !== MODULE.state.operation) return false;
      if (MODULE.state.bpo !== 'ALL' && row.bpo_id !== MODULE.state.bpo) return false;

      if (MODULE.state.period === 'NO_PERIOD' && row.period_id) return false;
      if (MODULE.state.period !== 'ALL' && MODULE.state.period !== 'NO_PERIOD' && row.period_id !== MODULE.state.period) return false;

      if (MODULE.state.leader === 'NO_LEADER' && row.leader_id) return false;
      if (MODULE.state.leader !== 'ALL' && MODULE.state.leader !== 'NO_LEADER' && row.leader_id !== MODULE.state.leader) return false;

      if (MODULE.state.status !== 'ALL' && row.status !== MODULE.state.status) return false;

      return true;
    });
  }

  function renderEmployeesTable() {
    const host = document.getElementById('employeesTableHost');
    if (!host) return;

    const rows = getFilteredEmployees();
    const pageSize = MODULE.state.pageSize;
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

    if (MODULE.state.page > totalPages) MODULE.state.page = totalPages;

    const start = (MODULE.state.page - 1) * pageSize;
    const visible = rows.slice(start, start + pageSize);

    host.innerHTML = `
      <div class="employees-table-meta">
        <span>
          ${rows.length
            ? `Exibindo ${start + 1}–${Math.min(start + pageSize, rows.length)} de ${rows.length}`
            : 'Nenhum colaborador encontrado'}
        </span>
        <span>25 por página</span>
      </div>

      <div class="employees-table-wrap">
        <table class="employees-table">
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Operação</th>
              <th>Turno</th>
              <th>Escala</th>
              <th>Líder</th>
              <th>Jornada</th>
              <th>Etapa</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${visible.length ? visible.map(renderEmployeeRow).join('') : `
              <tr>
                <td colspan="8" class="employees-empty-cell">Nenhum colaborador encontrado com esses filtros.</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>

      ${renderEmployeesPagination(totalPages)}
    `;

    host.querySelectorAll('[data-open-employee]').forEach(button => {
      button.addEventListener('click', () => openEmployeeDetails(button.dataset.openEmployee));
    });

    host.querySelector('[data-employees-prev]')?.addEventListener('click', () => {
      MODULE.state.page = Math.max(1, MODULE.state.page - 1);
      renderEmployeesTable();
    });

    host.querySelector('[data-employees-next]')?.addEventListener('click', () => {
      MODULE.state.page = Math.min(totalPages, MODULE.state.page + 1);
      renderEmployeesTable();
    });
  }

  function renderEmployeeRow(row) {
    const person = relationObjectLocal(row.people);
    const operation = relationObjectLocal(row.operations);
    const period = relationObjectLocal(row.period);
    const leader = relationObjectLocal(row.leader);
    const stage = getCurrentStage(row);

    return `
      <tr class="${hasRegistrationAttention(row) ? 'employees-row-attention' : ''}">
        <td>
          <div class="employee-person-cell">
            <span class="employee-person-avatar">${escapeLocal(getInitialsLocal(person?.full_name || '?'))}</span>
            <div>
              <strong>${escapeLocal(person?.full_name || '-')}</strong>
              <small>${escapeLocal(formatCPFLocal(person?.cpf || ''))}</small>
            </div>
          </div>
        </td>

        <td>
          <strong>${escapeLocal(operation?.name || '-')}</strong>
          <small class="employees-subtext">${escapeLocal(relationObjectLocal(operation?.regionals)?.name || '')}</small>
        </td>

        <td>
          ${period
            ? `<span class="employee-pill neutral">${escapeLocal(period.name)}</span>`
            : `<span class="employee-pill ${operation?.use_period_filter ? 'danger' : 'muted'}">${operation?.use_period_filter ? '⚠ Não definido' : 'Não se aplica'}</span>`}
        </td>

        <td>
          ${row.work_schedule
            ? `<span class="employees-schedule">${escapeLocal(row.work_schedule)}</span>`
            : '<span class="employee-pill danger">⚠ Não informado</span>'}
        </td>

        <td>
          ${leader
            ? escapeLocal(leader.full_name || '-')
            : '<span class="employee-pill danger">⚠ Sem líder</span>'}
        </td>

        <td>${employmentStatusBadge(row.status)}</td>
        <td><strong>${escapeLocal(stage)}</strong></td>
        <td>
          <button type="button" class="employee-view-button" data-open-employee="${row.id}">
            ${canEditEmployees() ? 'Gerenciar' : 'Ver'}
          </button>
        </td>
      </tr>
    `;
  }

  function renderEmployeesPagination(totalPages) {
    if (totalPages <= 1) return '';

    return `
      <div class="employees-pagination">
        <button type="button" data-employees-prev ${MODULE.state.page <= 1 ? 'disabled' : ''}>‹</button>
        <span>Página <strong>${MODULE.state.page}</strong> de <strong>${totalPages}</strong></span>
        <button type="button" data-employees-next ${MODULE.state.page >= totalPages ? 'disabled' : ''}>›</button>
      </div>
    `;
  }

  // ============================================================
  // DETALHE / EDIÇÃO
  // ============================================================

  async function openEmployeeDetails(employmentId) {
    const row = MODULE.rows.find(item => item.id === employmentId);
    if (!row) return alert('Colaborador não encontrado.');

    const history = await loadLeaderHistorySafe(employmentId);
    renderEmployeeModal(row, history);
  }

  async function loadLeaderHistorySafe(employmentId) {
    try {
      const { data, error } =
        await journeySupabase
          .from('employment_leader_history')
          .select('*')
          .eq('employment_id', employmentId);

      if (error) throw error;

      const history = data || [];
      const profileIds = [...new Set(history.flatMap(item => [
        item.previous_leader_id,
        item.old_leader_id,
        item.new_leader_id,
        item.leader_id,
        item.changed_by,
        item.actor_id,
        item.actor_user_id
      ]).filter(Boolean))];

      let profileMap = new Map();

      if (profileIds.length) {
        const { data: profiles, error: profileError } =
          await journeySupabase
            .from('profiles')
            .select('id, full_name, corporate_email')
            .in('id', profileIds);

        if (!profileError) {
          profileMap = new Map((profiles || []).map(profile => [profile.id, profile]));
        }
      }

      return history
        .map(item => ({ ...item, __profiles: profileMap }))
        .sort((a, b) => historyDateValue(b) - historyDateValue(a));
    } catch (error) {
      console.warn('Histórico de liderança indisponível:', error);
      return [];
    }
  }

  function historyDateValue(item) {
    const value = item.effective_at || item.created_at || item.changed_at || item.updated_at;
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
  }

  function renderEmployeeModal(row, history) {
    const person = relationObjectLocal(row.people);
    const operation = relationObjectLocal(row.operations);
    const period = relationObjectLocal(row.period);
    const leader = relationObjectLocal(row.leader);
    const regional = relationObjectLocal(operation?.regionals);
    const editable = canEditEmployees();

    openEmployeesModal(`
      <div class="employee-modal-shell">
        <div class="employee-modal-header">
          <div class="employee-modal-person">
            <span class="employee-modal-avatar">${escapeLocal(getInitialsLocal(person?.full_name || '?'))}</span>
            <div>
              <small>COLABORADOR</small>
              <h2>${escapeLocal(person?.full_name || '-')}</h2>
              <p>${escapeLocal(formatCPFLocal(person?.cpf || ''))} · ${escapeLocal(operation?.name || 'Sem operação')}</p>
            </div>
          </div>
          <button type="button" class="employee-modal-close" data-close-employees-modal>×</button>
        </div>

        <div class="employee-modal-statusbar">
          ${employmentStatusBadge(row.status)}
          ${row.work_schedule ? '<span class="employee-pill success">✓ Escala informada</span>' : '<span class="employee-pill danger">⚠ Sem escala</span>'}
          ${leader ? '<span class="employee-pill success">✓ Liderança definida</span>' : '<span class="employee-pill danger">⚠ Sem liderança</span>'}
          ${operation?.use_period_filter
            ? (period ? '<span class="employee-pill success">✓ Turno definido</span>' : '<span class="employee-pill danger">⚠ Sem turno</span>')
            : '<span class="employee-pill muted">Turno não obrigatório</span>'}
        </div>

        <form id="employeeManagementForm" class="employee-management-form">
          <section class="employee-form-section">
            <div class="employee-section-title">
              <div><small>DADOS PESSOAIS</small><h3>Identificação e contato</h3></div>
              ${editable ? '<span>Editável pelo RH</span>' : '<span>Somente leitura</span>'}
            </div>

            <div class="employee-form-grid">
              ${formInput('Nome completo', 'employeeEditName', person?.full_name || '', editable, 'text', true)}
              ${formInput('CPF', 'employeeEditCpf', formatCPFLocal(person?.cpf || ''), false, 'text')}
              ${formInput('Data de nascimento', 'employeeEditBirthDate', toDateInput(person?.birth_date), editable, 'date')}
              ${formInput('E-mail', 'employeeEditEmail', person?.email || '', editable, 'email')}
              ${formInput('Telefone', 'employeeEditPhone', person?.phone || '', editable, 'text')}
              ${formInput('Acesso ao Journey', 'employeeEditAccess', person?.auth_user_id ? 'Conta criada' : 'Sem conta de acesso', false, 'text')}
            </div>
          </section>

          <section class="employee-form-section">
            <div class="employee-section-title">
              <div><small>VÍNCULO</small><h3>Operação, turno e escala</h3></div>
            </div>

            <div class="employee-form-grid">
              ${formInput('Regional', 'employeeEditRegional', regional?.name || '-', false, 'text')}

              ${formSelect(
                'Operação / HUB',
                'employeeEditOperation',
                row.operation_id || '',
                MODULE.operations.map(item => ({ value: item.id, label: item.name })),
                editable,
                true
              )}

              ${formSelect(
                'BPO',
                'employeeEditBpo',
                row.bpo_id || '',
                bposForEditor(row.bpo_id).map(item => ({
                  value: item.id,
                  label: item.active === false ? `${item.name} (inativa)` : item.name
                })),
                editable,
                true
              )}

              ${formSelect(
                'Turno',
                'employeeEditPeriod',
                row.period_id || '',
                periodsForOperation(row.operation_id, row.period_id).map(item => ({
                  value: item.id,
                  label: item.active === false ? `${item.name} (inativo)` : item.name
                })),
                editable,
                false,
                operation?.use_period_filter ? 'Selecione o turno' : 'Não se aplica / não definido'
              )}

              ${formInput('Escala', 'employeeEditSchedule', row.work_schedule || '', editable, 'text', true, 'Ex.: 06:00 às 15:00 ou 00:00 às 09:00')}
              ${formInput('Data de admissão', 'employeeEditAdmissionDate', toDateInput(row.admission_date), editable, 'date', true)}
            </div>

            <div id="employeePeriodRuleNote" class="employee-rule-note ${operation?.use_period_filter ? 'attention' : ''}">
              ${operation?.use_period_filter
                ? 'Esta operação usa o TURNO como filtro de elegibilidade da liderança.'
                : 'Nesta operação o TURNO não é obrigatório para definir a liderança.'}
            </div>
          </section>

          <section class="employee-form-section">
            <div class="employee-section-title">
              <div><small>LIDERANÇA</small><h3>Responsabilidade atual</h3></div>
            </div>

            <div class="employee-leader-card">
              <div class="employee-leader-current">
                <span class="employee-person-avatar">${escapeLocal(getInitialsLocal(leader?.full_name || '?'))}</span>
                <div>
                  <small>Líder atual</small>
                  <strong>${escapeLocal(leader?.full_name || 'Não definido')}</strong>
                  <span>${escapeLocal(leader?.corporate_email || '')}</span>
                </div>
              </div>

              ${formSelect(
                'Definir / alterar liderança',
                'employeeEditLeader',
                row.leader_id || '',
                MODULE.leaders.map(item => ({ value: item.id, label: item.full_name })),
                editable,
                false,
                'Sem líder'
              )}
            </div>
          </section>

          ${renderJourneySummary(row)}
          ${renderLeaderHistory(history)}

          <div class="employee-modal-actions">
            <div>
              ${editable && row.status === 'WAITING'
                ? '<button type="button" class="employee-secondary-action" id="employeeStartJourneyButton">Iniciar Jornada</button>'
                : ''}
              ${editable
                ? '<button type="button" class="employee-danger-action" id="employeeDeleteButton">Excluir colaborador</button>'
                : ''}
            </div>

            <div>
              <button type="button" class="employee-secondary-action" data-close-employees-modal>Fechar</button>
              ${editable ? '<button type="submit" class="employee-primary-action" id="employeeSaveButton">Salvar alterações</button>' : ''}
            </div>
          </div>
        </form>
      </div>
    `);

    bindEmployeeModal(row);
  }

  function formInput(label, id, value, enabled, type = 'text', required = false, placeholder = '') {
    return `
      <label class="employee-field">
        <span>${escapeLocal(label)}${required ? ' *' : ''}</span>
        <input
          id="${id}"
          type="${type}"
          value="${escapeLocal(value)}"
          ${placeholder ? `placeholder="${escapeLocal(placeholder)}"` : ''}
          ${enabled ? '' : 'disabled'}
          ${required && enabled ? 'required' : ''}
        >
      </label>
    `;
  }

  function formSelect(label, id, selectedValue, options, enabled, required = false, emptyLabel = 'Selecione') {
    return `
      <label class="employee-field">
        <span>${escapeLocal(label)}${required ? ' *' : ''}</span>
        <select id="${id}" ${enabled ? '' : 'disabled'} ${required && enabled ? 'required' : ''}>
          <option value="">${escapeLocal(emptyLabel)}</option>
          ${options.map(option => `
            <option value="${escapeLocal(option.value)}" ${String(option.value) === String(selectedValue) ? 'selected' : ''}>
              ${escapeLocal(option.label)}
            </option>
          `).join('')}
        </select>
      </label>
    `;
  }

  function periodsForOperation(operationId, currentPeriodId = '') {
    return MODULE.periods.filter(period =>
      period.operation_id === operationId &&
      (period.active !== false || String(period.id) === String(currentPeriodId || ''))
    );
  }

  function bposForEditor(currentBpoId = '') {
    return MODULE.bpos.filter(bpo =>
      bpo.active !== false || String(bpo.id) === String(currentBpoId || '')
    );
  }

  function renderJourneySummary(row) {
    const journey = getEmploymentJourneyLocal(row);
    const checkpoints = relationArrayLocal(journey?.journey_checkpoints)
      .slice()
      .sort((a, b) => (CHECKPOINT_ORDER[a.checkpoint] || 999) - (CHECKPOINT_ORDER[b.checkpoint] || 999));

    return `
      <section class="employee-form-section">
        <div class="employee-section-title">
          <div><small>JORNADA</small><h3>Acompanhamento D1 → D90</h3></div>
          <span>${escapeLocal(getCurrentStage(row))}</span>
        </div>

        ${journey
          ? `
            <div class="employee-checkpoint-grid">
              ${checkpoints.map(checkpoint => {
                const state = checkpointState(checkpoint);
                return `
                  <div class="employee-checkpoint ${state.css}">
                    <strong>${escapeLocal(checkpoint.checkpoint)}</strong>
                    <small>${escapeLocal(state.label)}</small>
                    <span>${escapeLocal(formatDateLocal(checkpoint.due_at))}</span>
                  </div>
                `;
              }).join('')}
            </div>
          `
          : '<div class="employee-empty-block">Jornada ainda não iniciada.</div>'}
      </section>
    `;
  }

  function checkpointState(checkpoint) {
    const now = new Date();
    const opens = checkpoint.opens_at ? new Date(checkpoint.opens_at) : null;
    const due = checkpoint.due_at ? new Date(checkpoint.due_at) : null;

    if (opens && now < opens) return { css: 'future', label: 'Em breve' };
    if (due && now > due) return { css: 'overdue', label: 'Aberto / prazo vencido' };
    return { css: 'open', label: 'Disponível' };
  }

  function renderLeaderHistory(history) {
    return `
      <section class="employee-form-section">
        <div class="employee-section-title">
          <div><small>HISTÓRICO</small><h3>Alterações de liderança</h3></div>
          <span>${history.length} registro(s)</span>
        </div>

        ${history.length
          ? `<div class="employee-history-list">${history.map(renderHistoryItem).join('')}</div>`
          : '<div class="employee-empty-block">Ainda não há histórico de liderança disponível para este vínculo.</div>'}
      </section>
    `;
  }

  function renderHistoryItem(item) {
    const map = item.__profiles || new Map();
    const previousId = item.previous_leader_id || item.old_leader_id || null;
    const newId = item.new_leader_id || item.leader_id || null;
    const actorId = item.changed_by || item.actor_id || item.actor_user_id || null;

    const previousName = previousId ? map.get(previousId)?.full_name || 'Líder anterior' : 'Sem líder';
    const newName = newId ? map.get(newId)?.full_name || 'Nova liderança' : 'Sem líder';
    const actorName = actorId ? map.get(actorId)?.full_name || 'Usuário' : 'Sistema';
    const dateValue = item.effective_at || item.created_at || item.changed_at || item.updated_at;

    return `
      <div class="employee-history-item">
        <div class="employee-history-dot"></div>
        <div>
          <strong>${escapeLocal(previousName)} → ${escapeLocal(newName)}</strong>
          <p>${escapeLocal(historySourceLabel(item.source))}${item.reason ? ` · ${escapeLocal(item.reason)}` : ''}</p>
          <small>${escapeLocal(formatDateTimeLocal(dateValue))} · por ${escapeLocal(actorName)}</small>
        </div>
      </div>
    `;
  }

  function historySourceLabel(source) {
    return {
      EMPLOYEE_SELECTED: 'Selecionado pelo colaborador',
      LEADER_CLAIMED: 'Assumido pela liderança',
      HR_ASSIGNED: 'Definido pelo RH',
      HR_CHANGED: 'Alterado pelo RH',
      LEADER_RELEASED: 'Liberado pela liderança'
    }[source] || source || 'Alteração de liderança';
  }

  function bindEmployeeModal(row) {
    document.querySelectorAll('[data-close-employees-modal]').forEach(button => {
      button.addEventListener('click', closeEmployeesModal);
    });

    const operationSelect = document.getElementById('employeeEditOperation');
    operationSelect?.addEventListener('change', handleOperationChangeInEditor);

    const form = document.getElementById('employeeManagementForm');
    form?.addEventListener('submit', event => saveEmployeeChanges(event, row));

    document.getElementById('employeeStartJourneyButton')?.addEventListener('click', () => startJourneyFromEmployee(row.id));
    document.getElementById('employeeDeleteButton')?.addEventListener('click', () => deleteEmployeeFromBase(row.id));
  }

  function handleOperationChangeInEditor(event) {
    const operationId = event.target.value;
    const operation = MODULE.operations.find(item => item.id === operationId);
    const periodSelect = document.getElementById('employeeEditPeriod');
    const regionalInput = document.getElementById('employeeEditRegional');
    const note = document.getElementById('employeePeriodRuleNote');

    if (regionalInput) {
      regionalInput.value = relationObjectLocal(operation?.regionals)?.name || '-';
    }

    if (periodSelect) {
      const options = periodsForOperation(operationId);
      periodSelect.innerHTML = `
        <option value="">${operation?.use_period_filter ? 'Selecione o turno' : 'Não se aplica / não definido'}</option>
        ${options.map(item => `<option value="${escapeLocal(item.id)}">${escapeLocal(item.name)}</option>`).join('')}
      `;
    }

    if (note) {
      note.classList.toggle('attention', !!operation?.use_period_filter);
      note.textContent = operation?.use_period_filter
        ? 'Esta operação usa o TURNO como filtro de elegibilidade da liderança.'
        : 'Nesta operação o TURNO não é obrigatório para definir a liderança.';
    }
  }

  // ============================================================
  // SALVAR ALTERAÇÕES
  // ============================================================

  async function saveEmployeeChanges(event, originalRow) {
    event.preventDefault();

    if (!canEditEmployees()) return;

    const button = document.getElementById('employeeSaveButton');
    setButtonBusy(button, true, 'Salvando...');

    const originalPerson = relationObjectLocal(originalRow.people) || {};

    const payloadPerson = {
      full_name: valueOf('employeeEditName'),
      birth_date: valueOf('employeeEditBirthDate') || null,
      email: valueOf('employeeEditEmail') || null,
      phone: valueOf('employeeEditPhone') || null
    };

    const payloadEmployment = {
      bpo_id: valueOf('employeeEditBpo') || null,
      operation_id: valueOf('employeeEditOperation') || null,
      period_id: valueOf('employeeEditPeriod') || null,
      admission_date: valueOf('employeeEditAdmissionDate') || null,
      work_schedule: valueOf('employeeEditSchedule') || null
    };

    const selectedLeaderId = valueOf('employeeEditLeader') || null;
    const leaderChanged = String(originalRow.leader_id || '') !== String(selectedLeaderId || '');
    const responsibilityContextChanged =
      String(originalRow.operation_id || '') !== String(payloadEmployment.operation_id || '') ||
      String(originalRow.period_id || '') !== String(payloadEmployment.period_id || '');

    if (!payloadPerson.full_name) {
      alert('Informe o nome completo.');
      setButtonBusy(button, false, 'Salvar alterações');
      return;
    }

    if (!payloadEmployment.operation_id) {
      alert('Selecione a operação.');
      setButtonBusy(button, false, 'Salvar alterações');
      return;
    }

    if (!payloadEmployment.bpo_id) {
      alert('Selecione a BPO.');
      setButtonBusy(button, false, 'Salvar alterações');
      return;
    }

    if (!payloadEmployment.work_schedule) {
      alert('Informe a escala do colaborador.');
      setButtonBusy(button, false, 'Salvar alterações');
      return;
    }

    const selectedOperation = MODULE.operations.find(op => op.id === payloadEmployment.operation_id);

    if (selectedOperation?.use_period_filter && !payloadEmployment.period_id) {
      alert('Esta operação usa filtro por turno/período. Selecione o turno do colaborador.');
      setButtonBusy(button, false, 'Salvar alterações');
      return;
    }

    const originalEmploymentPayload = {
      bpo_id: originalRow.bpo_id || null,
      operation_id: originalRow.operation_id || null,
      period_id: originalRow.period_id || null,
      admission_date: originalRow.admission_date || null,
      work_schedule: originalRow.work_schedule || null
    };

    const originalPersonPayload = {
      full_name: originalPerson.full_name || null,
      birth_date: originalPerson.birth_date || null,
      email: originalPerson.email || null,
      phone: originalPerson.phone || null
    };

    try {
      const { error: personError } =
        await journeySupabase
          .from('people')
          .update(payloadPerson)
          .eq('id', originalRow.person_id);

      if (personError) throw personError;

      if (originalPerson.auth_user_id && payloadPerson.full_name !== originalPerson.full_name) {
        const { error: profileNameError } =
          await journeySupabase
            .from('profiles')
            .update({ full_name: payloadPerson.full_name })
            .eq('id', originalPerson.auth_user_id);

        if (profileNameError) {
          console.warn('Nome do perfil de acesso não pôde ser sincronizado:', profileNameError);
        }
      }

      const { error: employmentError } =
        await journeySupabase
          .from('employments')
          .update(payloadEmployment)
          .eq('id', originalRow.id);

      if (employmentError) throw employmentError;

      // Se operação/turno mudou, validamos novamente a responsabilidade,
      // mesmo que o mesmo líder continue selecionado.
      if (leaderChanged || responsibilityContextChanged) {
        const source = originalRow.leader_id ? 'HR_CHANGED' : 'HR_ASSIGNED';
        const reason = responsibilityContextChanged
          ? 'Cadastro e responsabilidade revisados pelo RH após alteração de operação/turno.'
          : 'Liderança definida/alterada pelo RH na tela de Colaboradores.';

        const { error: leaderError } =
          await journeySupabase
            .rpc('set_employment_leader', {
              p_employment_id: originalRow.id,
              p_new_leader_id: selectedLeaderId,
              p_source: source,
              p_reason: reason
            });

        if (leaderError) {
          // Rollback cadastral para não deixar operação/turno e liderança incompatíveis.
          await journeySupabase
            .from('employments')
            .update(originalEmploymentPayload)
            .eq('id', originalRow.id);

          await journeySupabase
            .from('people')
            .update(originalPersonPayload)
            .eq('id', originalRow.person_id);

          throw new Error(`As alterações foram canceladas porque a liderança não pôde ser validada: ${leaderError.message}`);
        }
      }

      await writeActivityLogSafe('EMPLOYEE_UPDATED', originalRow.id, {
        person_id: originalRow.person_id,
        operation_id: payloadEmployment.operation_id,
        period_id: payloadEmployment.period_id,
        bpo_id: payloadEmployment.bpo_id,
        work_schedule: payloadEmployment.work_schedule,
        leader_id: selectedLeaderId
      });

      alert('Colaborador atualizado com sucesso.');
      closeEmployeesModal();
      await loadEmployeesData();
      renderEmployeesPage();
    } catch (error) {
      console.error('Erro ao salvar colaborador:', error);
      alert(error.message || 'Não foi possível salvar as alterações.');
    } finally {
      setButtonBusy(button, false, 'Salvar alterações');
    }
  }

  async function writeActivityLogSafe(action, entityId, details) {
    try {
      await journeySupabase
        .from('activity_log')
        .insert({
          user_id: MODULE.user?.id || MODULE.profile?.id || null,
          action,
          entity_type: 'employment',
          entity_id: entityId,
          details
        });
    } catch (error) {
      console.warn('Não foi possível registrar auditoria complementar:', error);
    }
  }

  // ============================================================
  // INICIAR / EXCLUIR
  // ============================================================

  async function startJourneyFromEmployee(employmentId) {
    if (!canEditEmployees()) return;

    if (!confirm('Iniciar a Jornada deste colaborador agora?')) return;

    const { error } =
      await journeySupabase
        .rpc('start_journey', { p_employment_id: employmentId });

    if (error) return alert(error.message);

    alert('Jornada iniciada com sucesso.');
    closeEmployeesModal();
    await loadEmployeesData();
    renderEmployeesPage();
  }

  async function deleteEmployeeFromBase(employmentId) {
    if (!canEditEmployees()) return;

    if (!confirm('Excluir permanentemente este colaborador e os dados vinculados? Esta ação não poderá ser desfeita.')) {
      return;
    }

    try {
      const { data, error } =
        await journeySupabase.functions.invoke('delete-employee', {
          body: { employment_id: employmentId }
        });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      alert('Colaborador excluído.');
      closeEmployeesModal();
      await loadEmployeesData();
      renderEmployeesPage();
    } catch (error) {
      console.error(error);
      alert(error.message || 'Não foi possível excluir o colaborador.');
    }
  }

  // ============================================================
  // MODAL
  // ============================================================

  function openEmployeesModal(content) {
    closeEmployeesModal();

    const overlay = document.createElement('div');
    overlay.id = 'employeesModuleModal';
    overlay.className = 'employees-modal-overlay';
    overlay.innerHTML = `<div class="employees-modal-card">${content}</div>`;

    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeEmployeesModal();
    });

    document.body.appendChild(overlay);
  }

  function closeEmployeesModal() {
    document.getElementById('employeesModuleModal')?.remove();
  }

  // ============================================================
  // HELPERS DE JORNADA
  // ============================================================

  function getEmploymentJourneyLocal(row) {
    const journeys = relationArrayLocal(row?.journeys);

    return (
      journeys.find(journey => ['ACTIVE', 'IN_JOURNEY'].includes(journey.status)) ||
      journeys[0] ||
      null
    );
  }

  function getCurrentStage(row) {
    if (row.status === 'WAITING') return 'Aguardando';

    const journey = getEmploymentJourneyLocal(row);
    if (!journey) return row.status === 'COMPLETED' ? 'Concluída' : '-';

    const checkpoints = relationArrayLocal(journey.journey_checkpoints)
      .slice()
      .sort((a, b) => (CHECKPOINT_ORDER[a.checkpoint] || 999) - (CHECKPOINT_ORDER[b.checkpoint] || 999));

    if (!checkpoints.length) return '-';
    if (row.status === 'COMPLETED') return checkpoints[checkpoints.length - 1]?.checkpoint || 'D90';

    const now = new Date();
    const opened = checkpoints.filter(checkpoint => {
      if (!checkpoint.opens_at) return true;
      const opens = new Date(checkpoint.opens_at);
      return !Number.isNaN(opens.getTime()) && opens <= now;
    });

    return (opened[opened.length - 1] || checkpoints[0])?.checkpoint || '-';
  }

  function employmentStatusBadge(status) {
    const map = {
      WAITING: ['warning', 'Aguardando'],
      IN_JOURNEY: ['success', 'Em acompanhamento'],
      COMPLETED: ['neutral', 'Concluído']
    };

    const [css, label] = map[status] || ['muted', status || '-'];
    return `<span class="employee-pill ${css}">${escapeLocal(label)}</span>`;
  }

  // ============================================================
  // HELPERS GERAIS
  // ============================================================

  function relationObjectLocal(value) {
    if (!value) return null;
    return Array.isArray(value) ? (value[0] || null) : value;
  }

  function relationArrayLocal(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  function normalizeSearch(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function escapeLocal(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getInitialsLocal(name) {
    const parts = String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!parts.length) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  }

  function formatCPFLocal(value) {
    const cpf = String(value || '').replace(/\D/g, '');
    if (cpf.length !== 11) return cpf;
    return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
  }

  function formatDateLocal(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('pt-BR');
  }

  function formatDateTimeLocal(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  }

  function toDateInput(value) {
    if (!value) return '';
    return String(value).slice(0, 10);
  }

  function optionHTML(value, label, selectedValue) {
    return `
      <option value="${escapeLocal(value)}" ${String(value) === String(selectedValue) ? 'selected' : ''}>
        ${escapeLocal(label)}
      </option>
    `;
  }

  function valueOf(id) {
    return document.getElementById(id)?.value?.trim?.() ?? document.getElementById(id)?.value ?? '';
  }

  function setButtonBusy(button, busy, text) {
    if (!button) return;
    button.disabled = busy;
    button.textContent = text;
  }

  function renderModuleError(title, message) {
    return `
      <div class="employees-module-error">
        <h2>${escapeLocal(title)}</h2>
        <p>${escapeLocal(message || '')}</p>
      </div>
    `;
  }

  // ============================================================
  // CSS DO MÓDULO
  // ============================================================

  function injectEmployeesStyles() {
    if (document.getElementById('employeesModuleStyles')) return;

    const style = document.createElement('style');
    style.id = 'employeesModuleStyles';
    style.textContent = `
      .employees-loading{
        min-height:300px;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:12px;
        color:var(--muted-color,#6b7280);
      }
      .employees-spinner{
        width:30px;
        height:30px;
        border-radius:50%;
        border:3px solid rgba(238,77,45,.18);
        border-top-color:#EE4D2D;
        animation:employeesSpin .8s linear infinite;
      }
      @keyframes employeesSpin{to{transform:rotate(360deg)}}

      .employees-metrics-grid{
        display:grid;
        grid-template-columns:repeat(5,minmax(0,1fr));
        gap:12px;
        margin-bottom:18px;
      }
      .employees-metric{
        padding:17px;
        border:1px solid var(--border-color,#e5e7eb);
        border-radius:14px;
        background:var(--card-bg,#fff);
      }
      .employees-metric small,
      .employees-metric strong,
      .employees-metric span{display:block}
      .employees-metric small{
        font-size:11px;
        font-weight:800;
        color:var(--muted-color,#6b7280);
      }
      .employees-metric strong{
        margin:6px 0 3px;
        font-size:27px;
      }
      .employees-metric span{
        font-size:11px;
        color:var(--muted-color,#6b7280);
      }
      .employees-metric.attention{
        border-color:rgba(238,77,45,.26);
        background:rgba(238,77,45,.045);
      }

      .employees-panel{
        border:1px solid var(--border-color,#e5e7eb);
        border-radius:16px;
        background:var(--card-bg,#fff);
        padding:20px;
      }
      .employees-panel-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:16px;
        margin-bottom:18px;
      }
      .employees-panel-head h2{margin:0 0 5px;font-size:18px}
      .employees-panel-head p{margin:0;color:var(--muted-color,#6b7280);font-size:13px}
      .employees-head-badge{
        padding:7px 10px;
        border-radius:999px;
        background:rgba(238,77,45,.09);
        color:#EE4D2D;
        font-size:11px;
        font-weight:800;
      }

      .employees-filters{
        display:grid;
        grid-template-columns:minmax(240px,2fr) repeat(6,minmax(125px,1fr));
        gap:9px;
        margin-bottom:14px;
      }
      .employees-filters label,
      .employee-field{
        display:flex;
        flex-direction:column;
        gap:5px;
      }
      .employees-filters label>span,
      .employee-field>span{
        font-size:10px;
        font-weight:800;
        color:var(--muted-color,#6b7280);
        text-transform:uppercase;
        letter-spacing:.035em;
      }
      .employees-filters input,
      .employees-filters select,
      .employee-field input,
      .employee-field select{
        width:100%;
        min-height:39px;
        box-sizing:border-box;
        border:1px solid var(--border-color,#e5e7eb);
        border-radius:9px;
        padding:9px 10px;
        background:var(--card-bg,#fff);
        color:inherit;
        outline:none;
      }
      .employees-filters input:focus,
      .employees-filters select:focus,
      .employee-field input:focus,
      .employee-field select:focus{
        border-color:rgba(238,77,45,.55);
        box-shadow:0 0 0 3px rgba(238,77,45,.08);
      }
      .employee-field input:disabled,
      .employee-field select:disabled{
        opacity:.72;
        cursor:not-allowed;
        background:rgba(127,127,127,.05);
      }

      .employees-table-meta{
        display:flex;
        justify-content:space-between;
        gap:10px;
        margin:2px 0 9px;
        font-size:11px;
        color:var(--muted-color,#6b7280);
      }
      .employees-table-wrap{overflow:auto}
      .employees-table{
        width:100%;
        min-width:1100px;
        border-collapse:collapse;
      }
      .employees-table th{
        padding:10px 11px;
        border-bottom:1px solid var(--border-color,#e5e7eb);
        text-align:left;
        font-size:10px;
        font-weight:800;
        color:var(--muted-color,#6b7280);
        text-transform:uppercase;
      }
      .employees-table td{
        padding:12px 11px;
        border-bottom:1px solid var(--border-color,#e5e7eb);
        vertical-align:middle;
        font-size:12px;
      }
      .employees-row-attention{background:rgba(238,77,45,.018)}
      .employee-person-cell{display:flex;align-items:center;gap:10px;min-width:205px}
      .employee-person-cell strong,
      .employee-person-cell small{display:block}
      .employee-person-cell small{margin-top:2px;color:var(--muted-color,#6b7280)}
      .employee-person-avatar{
        width:34px;
        height:34px;
        min-width:34px;
        display:flex;
        align-items:center;
        justify-content:center;
        border-radius:50%;
        background:rgba(238,77,45,.1);
        color:#EE4D2D;
        font-size:11px;
        font-weight:900;
      }
      .employees-subtext{display:block;margin-top:3px;color:var(--muted-color,#6b7280)}
      .employees-schedule{display:block;max-width:180px;white-space:normal}
      .employee-pill{
        display:inline-flex;
        align-items:center;
        border-radius:999px;
        padding:6px 8px;
        white-space:nowrap;
        font-size:10px;
        font-weight:800;
      }
      .employee-pill.success{background:rgba(22,155,80,.1);color:#169b50}
      .employee-pill.warning{background:rgba(238,77,45,.1);color:#EE4D2D}
      .employee-pill.danger{background:rgba(220,38,38,.08);color:#dc2626}
      .employee-pill.neutral{background:rgba(59,130,246,.08);color:#2563eb}
      .employee-pill.muted{background:rgba(127,127,127,.09);color:var(--muted-color,#6b7280)}
      .employee-view-button{
        border:1px solid rgba(238,77,45,.3);
        border-radius:8px;
        padding:7px 10px;
        background:transparent;
        color:#EE4D2D;
        font-weight:800;
        cursor:pointer;
      }
      .employee-view-button:hover{background:rgba(238,77,45,.06)}
      .employees-empty-cell{text-align:center!important;padding:35px!important;color:var(--muted-color,#6b7280)}

      .employees-pagination{
        display:flex;
        justify-content:flex-end;
        align-items:center;
        gap:10px;
        margin-top:14px;
        color:var(--muted-color,#6b7280);
        font-size:11px;
      }
      .employees-pagination button{
        width:34px;
        height:34px;
        border:1px solid var(--border-color,#e5e7eb);
        border-radius:8px;
        background:transparent;
        color:inherit;
        cursor:pointer;
      }
      .employees-pagination button:disabled{opacity:.35;cursor:not-allowed}

      .employees-modal-overlay{
        position:fixed;
        inset:0;
        z-index:99999;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:22px;
        background:rgba(15,23,42,.48);
        backdrop-filter:blur(3px);
      }
      .employees-modal-card{
        width:min(1050px,96vw);
        max-height:92vh;
        overflow:auto;
        border-radius:18px;
        border:1px solid var(--border-color,#e5e7eb);
        background:var(--card-bg,#fff);
        color:inherit;
        box-shadow:0 24px 80px rgba(0,0,0,.2);
      }
      .employee-modal-shell{padding:0}
      .employee-modal-header{
        position:sticky;
        top:0;
        z-index:2;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:16px;
        padding:20px 22px;
        border-bottom:1px solid var(--border-color,#e5e7eb);
        background:var(--card-bg,#fff);
      }
      .employee-modal-person{display:flex;align-items:center;gap:13px}
      .employee-modal-avatar{
        width:48px;
        height:48px;
        min-width:48px;
        display:flex;
        align-items:center;
        justify-content:center;
        border-radius:50%;
        background:#EE4D2D;
        color:#fff;
        font-weight:900;
      }
      .employee-modal-person small{font-size:9px;font-weight:900;color:#EE4D2D;letter-spacing:.09em}
      .employee-modal-person h2{margin:3px 0;font-size:20px}
      .employee-modal-person p{margin:0;color:var(--muted-color,#6b7280);font-size:12px}
      .employee-modal-close{
        width:38px;
        height:38px;
        border:0;
        border-radius:9px;
        background:rgba(127,127,127,.08);
        color:inherit;
        font-size:22px;
        cursor:pointer;
      }
      .employee-modal-statusbar{
        display:flex;
        flex-wrap:wrap;
        gap:7px;
        padding:13px 22px;
        border-bottom:1px solid var(--border-color,#e5e7eb);
        background:rgba(127,127,127,.025);
      }
      .employee-management-form{padding:0 22px 22px}
      .employee-form-section{padding:20px 0;border-bottom:1px solid var(--border-color,#e5e7eb)}
      .employee-section-title{
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:12px;
        margin-bottom:14px;
      }
      .employee-section-title small{font-size:9px;font-weight:900;color:#EE4D2D;letter-spacing:.08em}
      .employee-section-title h3{margin:3px 0 0;font-size:16px}
      .employee-section-title>span{font-size:10px;color:var(--muted-color,#6b7280)}
      .employee-form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .employee-rule-note{
        margin-top:12px;
        padding:10px 12px;
        border-radius:9px;
        background:rgba(59,130,246,.06);
        color:#2563eb;
        font-size:11px;
      }
      .employee-rule-note.attention{background:rgba(238,77,45,.07);color:#EE4D2D}
      .employee-leader-card{
        display:grid;
        grid-template-columns:minmax(0,1.1fr) minmax(260px,1fr);
        gap:18px;
        align-items:end;
        padding:14px;
        border:1px solid var(--border-color,#e5e7eb);
        border-radius:12px;
      }
      .employee-leader-current{display:flex;align-items:center;gap:10px}
      .employee-leader-current small,
      .employee-leader-current strong,
      .employee-leader-current span{display:block}
      .employee-leader-current span{margin-top:2px;font-size:10px;color:var(--muted-color,#6b7280)}

      .employee-checkpoint-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
      .employee-checkpoint{
        padding:12px;
        border:1px solid var(--border-color,#e5e7eb);
        border-radius:10px;
      }
      .employee-checkpoint strong,
      .employee-checkpoint small,
      .employee-checkpoint span{display:block}
      .employee-checkpoint small{margin:4px 0;color:var(--muted-color,#6b7280);font-size:9px}
      .employee-checkpoint span{font-size:9px;color:var(--muted-color,#6b7280)}
      .employee-checkpoint.open{border-color:rgba(238,77,45,.25);background:rgba(238,77,45,.035)}
      .employee-checkpoint.overdue{border-color:rgba(220,38,38,.2);background:rgba(220,38,38,.03)}
      .employee-checkpoint.future{opacity:.62}

      .employee-history-list{display:flex;flex-direction:column;gap:9px}
      .employee-history-item{display:flex;gap:10px;padding:11px;border:1px solid var(--border-color,#e5e7eb);border-radius:10px}
      .employee-history-dot{width:9px;height:9px;min-width:9px;margin-top:5px;border-radius:50%;background:#EE4D2D}
      .employee-history-item p{margin:4px 0;font-size:11px;color:var(--muted-color,#6b7280)}
      .employee-history-item small{font-size:9px;color:var(--muted-color,#6b7280)}
      .employee-empty-block{
        padding:20px;
        border:1px dashed var(--border-color,#e5e7eb);
        border-radius:10px;
        text-align:center;
        color:var(--muted-color,#6b7280);
        font-size:12px;
      }

      .employee-modal-actions{
        position:sticky;
        bottom:-22px;
        display:flex;
        justify-content:space-between;
        gap:12px;
        padding:16px 0 0;
        background:var(--card-bg,#fff);
      }
      .employee-modal-actions>div{display:flex;gap:8px;flex-wrap:wrap}
      .employee-primary-action,
      .employee-secondary-action,
      .employee-danger-action{
        min-height:38px;
        padding:8px 13px;
        border-radius:9px;
        font-weight:800;
        cursor:pointer;
      }
      .employee-primary-action{border:1px solid #EE4D2D;background:#EE4D2D;color:#fff}
      .employee-secondary-action{border:1px solid var(--border-color,#e5e7eb);background:transparent;color:inherit}
      .employee-danger-action{border:1px solid rgba(220,38,38,.25);background:rgba(220,38,38,.04);color:#dc2626}
      .employee-primary-action:disabled{opacity:.55;cursor:not-allowed}

      .employees-module-error{
        padding:35px;
        border:1px solid rgba(220,38,38,.18);
        border-radius:14px;
        background:rgba(220,38,38,.03);
      }
      .employees-module-error h2{margin-top:0}
      .employees-module-error p{margin-bottom:0;color:var(--muted-color,#6b7280)}

      @media(max-width:1250px){
        .employees-metrics-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
        .employees-filters{grid-template-columns:repeat(4,minmax(0,1fr))}
        .employees-search-field{grid-column:span 2}
      }
      @media(max-width:850px){
        .employees-metrics-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        .employees-filters{grid-template-columns:repeat(2,minmax(0,1fr))}
        .employees-search-field{grid-column:1/-1}
        .employee-form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        .employee-checkpoint-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
        .employee-leader-card{grid-template-columns:1fr}
      }
      @media(max-width:560px){
        .employees-metrics-grid,
        .employees-filters,
        .employee-form-grid,
        .employee-checkpoint-grid{grid-template-columns:1fr}
        .employee-modal-actions{flex-direction:column}
        .employee-modal-actions>div{width:100%}
        .employees-modal-overlay{padding:8px}
      }
    `;

    document.head.appendChild(style);
  }

  // ============================================================
  // EXPOSIÇÃO
  // ============================================================

  window.loadEmployeesPage = openEmployeesPage;
  window.closeEmployeesModal = closeEmployeesModal;

  console.log('RH Journey: employees.js carregado.');
})();
