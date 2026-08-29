// ============================================================
// SHOPEE JOURNEY
// GESTÃO DE USUÁRIOS CORPORATIVOS
// Arquivo completo: js/users.js
// ============================================================

(function () {
  'use strict';

  const STATE = {
    profile: null,
    users: [],
    operations: [],
    periods: [],
    search: '',
    role: 'ALL',
    status: 'ALL'
  };

  document.addEventListener('DOMContentLoaded', initializeUsersModule);

  async function initializeUsersModule() {
    bindNavigationCapture();

    try {
      await loadIdentity();
      updateMenuVisibility();
      setTimeout(updateMenuVisibility, 300);
      setTimeout(updateMenuVisibility, 1000);
    } catch (error) {
      console.warn('Shopee Journey / Usuários: identidade ainda não disponível.', error);
    }
  }

  async function loadIdentity() {
    const { data: sessionData, error: sessionError } = await journeySupabase.auth.getSession();
    if (sessionError) throw sessionError;

    const user = sessionData?.session?.user || null;
    if (!user) return;

    const { data: profile, error: profileError } = await journeySupabase
      .from('profiles')
      .select('id, full_name, role, corporate_email, active')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;
    STATE.profile = profile;
  }

  function canManageUsers() {
    return STATE.profile?.role === 'ADMIN_RH';
  }

  function updateMenuVisibility() {
    const menu = document.querySelector('[data-page="users"]');
    if (!menu) return;
    menu.style.display = canManageUsers() ? '' : 'none';
  }

  function bindNavigationCapture() {
    document.addEventListener(
      'click',
      event => {
        const target = event.target.closest('[data-page="users"]');
        if (!target) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        openUsersPage();
      },
      true
    );
  }

  async function openUsersPage() {
    try {
      if (!STATE.profile) await loadIdentity();
      if (!canManageUsers()) return;

      document.querySelectorAll('[data-page]').forEach(item => {
        item.classList.toggle('active', item.dataset.page === 'users');
      });

      const title = document.getElementById('pageTitle');
      const subtitle = document.getElementById('pageSubtitle');
      if (title) title.textContent = 'Usuários e Acessos';
      if (subtitle) subtitle.textContent = 'Perfis, e-mails, senhas temporárias e responsabilidade por operação.';

      const host = getHost();
      if (!host) return;
      host.innerHTML = '<div class="page-loading">Carregando usuários...</div>';

      await loadUsersData();
      renderUsersPage();
    } catch (error) {
      console.error('Erro ao abrir Usuários:', error);
      const host = getHost();
      if (host) {
        host.innerHTML = `
          <div class="users-error">
            <h2>Não foi possível carregar os usuários.</h2>
            <p>${escapeHTML(error.message || 'Erro desconhecido.')}</p>
          </div>
        `;
      }
    }
  }

  function getHost() {
    return document.getElementById('pageContent') || document.querySelector('.page-content');
  }

  async function invokeUsersFunction(body) {
    const { data, error } = await journeySupabase.functions.invoke('manage-corporate-users', { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function loadUsersData() {
    const data = await invokeUsersFunction({ action: 'list' });
    STATE.users = data?.users || [];
    STATE.operations = data?.operations || [];
    STATE.periods = data?.periods || [];
  }

  function renderUsersPage() {
    const host = getHost();
    if (!host) return;

    const active = STATE.users.filter(user => user.active !== false).length;
    const leaders = STATE.users.filter(user => user.role === 'LEADER').length;
    const managers = STATE.users.filter(user => user.role === 'HR_MANAGER').length;

    host.innerHTML = `
      <div class="users-metrics-grid">
        ${metric('Acessos', STATE.users.length, 'Usuários corporativos')}
        ${metric('Ativos', active, 'Com acesso liberado')}
        ${metric('Lideranças', leaders, 'Perfis LEADER')}
        ${metric('Gestores de RH', managers, 'Visão gerencial')}
      </div>

      <section class="users-panel">
        <div class="users-panel-head">
          <div>
            <h2>Usuários Corporativos</h2>
            <p>Abra um usuário para alterar dados, redefinir senha ou vincular operações.</p>
          </div>

          <button id="usersNewButton" class="users-primary-button" type="button">
            + Novo acesso
          </button>
        </div>

        <div class="users-toolbar">
          <label class="users-search">
            <span>Buscar</span>
            <input id="usersSearch" type="search" placeholder="Nome ou e-mail..." value="${escapeHTML(STATE.search)}">
          </label>

          <label>
            <span>Perfil</span>
            <select id="usersRoleFilter">
              <option value="ALL">Todos</option>
              ${option('ADMIN_RH', 'ADMIN / RH', STATE.role)}
              ${option('HR_MANAGER', 'GESTOR DE RH', STATE.role)}
              ${option('LEADER', 'LIDERANÇA', STATE.role)}
            </select>
          </label>

          <label>
            <span>Status</span>
            <select id="usersStatusFilter">
              <option value="ALL">Todos</option>
              ${option('ACTIVE', 'Ativos', STATE.status)}
              ${option('INACTIVE', 'Inativos', STATE.status)}
            </select>
          </label>
        </div>

        <div id="usersTableHost"></div>
      </section>
    `;

    document.getElementById('usersNewButton')?.addEventListener('click', () => openUserModal(null));

    document.getElementById('usersSearch')?.addEventListener('input', event => {
      STATE.search = event.target.value;
      renderUsersTable();
    });

    document.getElementById('usersRoleFilter')?.addEventListener('change', event => {
      STATE.role = event.target.value;
      renderUsersTable();
    });

    document.getElementById('usersStatusFilter')?.addEventListener('change', event => {
      STATE.status = event.target.value;
      renderUsersTable();
    });

    renderUsersTable();
  }

  function metric(label, value, description) {
    return `
      <article class="users-metric">
        <small>${escapeHTML(label)}</small>
        <strong>${escapeHTML(value)}</strong>
        <span>${escapeHTML(description)}</span>
      </article>
    `;
  }

  function filteredUsers() {
    const search = normalize(STATE.search);

    return STATE.users.filter(user => {
      const blob = normalize(`${user.full_name || ''} ${user.corporate_email || ''}`);
      if (search && !blob.includes(search)) return false;
      if (STATE.role !== 'ALL' && user.role !== STATE.role) return false;
      if (STATE.status === 'ACTIVE' && user.active === false) return false;
      if (STATE.status === 'INACTIVE' && user.active !== false) return false;
      return true;
    });
  }

  function renderUsersTable() {
    const host = document.getElementById('usersTableHost');
    if (!host) return;

    const rows = filteredUsers();

    host.innerHTML = `
      <div class="users-table-wrap">
        <table class="users-table">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>E-mail</th>
              <th>Perfil</th>
              <th>Operações</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map(renderUserRow).join('') : `
              <tr><td colspan="6" class="users-empty">Nenhum usuário encontrado.</td></tr>
            `}
          </tbody>
        </table>
      </div>
    `;

    host.querySelectorAll('[data-manage-user]').forEach(button => {
      button.addEventListener('click', () => {
        const user = STATE.users.find(item => item.id === button.dataset.manageUser);
        openUserModal(user || null);
      });
    });
  }

  function renderUserRow(user) {
    const operationNames = (user.operation_ids || [])
      .map(id => STATE.operations.find(op => op.id === id)?.name)
      .filter(Boolean);

    return `
      <tr>
        <td>
          <div class="users-person-cell">
            <span class="users-avatar">${escapeHTML(initials(user.full_name || '?'))}</span>
            <div>
              <strong>${escapeHTML(user.full_name || '-')}</strong>
              <small>${escapeHTML(roleLabel(user.role))}</small>
            </div>
          </div>
        </td>
        <td>${escapeHTML(user.corporate_email || '-')}</td>
        <td><span class="users-role-badge ${String(user.role || '').toLowerCase()}">${escapeHTML(roleLabel(user.role))}</span></td>
        <td>
          ${user.role === 'LEADER'
            ? (operationNames.length
              ? operationNames.map(name => `<span class="users-operation-chip">${escapeHTML(name)}</span>`).join(' ')
              : '<span class="users-warning-text">⚠ Sem operação vinculada</span>')
            : '<span class="users-muted">Acesso por perfil</span>'}
        </td>
        <td>${user.active === false ? '<span class="users-status inactive">Inativo</span>' : '<span class="users-status active">Ativo</span>'}</td>
        <td><button type="button" class="users-secondary-button" data-manage-user="${escapeHTML(user.id)}">Gerenciar</button></td>
      </tr>
    `;
  }

  function openUserModal(user) {
    closeUserModal();

    const isNew = !user;
    const selectedRole = user?.role || 'LEADER';
    const selectedOperations = new Set(user?.operation_ids || []);
    const selectedPeriods = new Set(user?.period_ids || []);

    const overlay = document.createElement('div');
    overlay.id = 'usersModuleModal';
    overlay.className = 'users-modal-overlay';
    overlay.innerHTML = `
      <div class="users-modal">
        <div class="users-modal-header">
          <div>
            <small>${isNew ? 'NOVO ACESSO' : 'USUÁRIO CORPORATIVO'}</small>
            <h2>${isNew ? 'Cadastrar usuário' : escapeHTML(user.full_name || '-')}</h2>
            <p>${isNew ? 'A senha inicial será gerada automaticamente.' : 'Edite o perfil sem precisar recriar a conta.'}</p>
          </div>
          <button type="button" class="users-modal-close" data-close-users-modal>×</button>
        </div>

        <form id="usersManagementForm" class="users-form">
          <div class="users-form-grid">
            <label class="users-field">
              <span>Nome completo *</span>
              <input id="userEditName" type="text" required value="${escapeHTML(user?.full_name || '')}">
            </label>

            <label class="users-field">
              <span>E-mail corporativo *</span>
              <input id="userEditEmail" type="email" required value="${escapeHTML(user?.corporate_email || '')}" placeholder="nome@shopee.com">
            </label>

            <label class="users-field">
              <span>Perfil *</span>
              <select id="userEditRole" required>
                ${option('LEADER', 'LIDERANÇA', selectedRole)}
                ${option('HR_MANAGER', 'GESTOR DE RH', selectedRole)}
                ${option('ADMIN_RH', 'ADMIN / RH', selectedRole)}
              </select>
            </label>

            <label class="users-field">
              <span>Status</span>
              <select id="userEditStatus" ${isNew ? 'disabled' : ''}>
                <option value="ACTIVE" ${user?.active === false ? '' : 'selected'}>Ativo</option>
                <option value="INACTIVE" ${user?.active === false ? 'selected' : ''}>Inativo</option>
              </select>
            </label>
          </div>

          <section id="leaderResponsibilitySection" class="users-responsibility-section">
            <div class="users-section-head">
              <div>
                <small>RESPONSABILIDADE DA LIDERANÇA</small>
                <h3>Operações e turnos</h3>
              </div>
              <span>O líder pode atuar em uma ou mais operações.</span>
            </div>

            <div id="userOperationsList" class="users-operations-list">
              ${STATE.operations.map(operation => renderOperationBox(operation, selectedOperations, selectedPeriods)).join('')}
            </div>

            <div class="users-note">
              Quando a operação usa filtro por turno, marque também o(s) turno(s) em que este líder atua. Se a operação não usa esse filtro, basta selecionar a operação.
            </div>
          </section>

          <div id="usersTempPasswordHost"></div>

          <div class="users-modal-footer">
            <div>
              ${!isNew ? '<button id="userResetPasswordButton" type="button" class="users-secondary-button">Gerar nova senha temporária</button>' : ''}
            </div>
            <div class="users-footer-actions">
              <button type="button" class="users-secondary-button" data-close-users-modal>Cancelar</button>
              <button id="userSaveButton" type="submit" class="users-primary-button">${isNew ? 'Criar acesso' : 'Salvar alterações'}</button>
            </div>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelectorAll('[data-close-users-modal]').forEach(button => {
      button.addEventListener('click', closeUserModal);
    });

    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeUserModal();
    });

    const roleSelect = document.getElementById('userEditRole');
    roleSelect?.addEventListener('change', syncLeaderSection);
    syncLeaderSection();

    overlay.querySelectorAll('[data-operation-check]').forEach(input => {
      input.addEventListener('change', () => syncOperationPeriods(input.dataset.operationCheck));
    });

    overlay.querySelectorAll('[data-operation-period]').forEach(input => {
      input.addEventListener('change', event => {
        if (event.target.checked) {
          const operationId = event.target.dataset.periodOperation;
          const opInput = document.querySelector(`[data-operation-check="${cssEscape(operationId)}"]`);
          if (opInput) opInput.checked = true;
          syncOperationPeriods(operationId);
        }
      });
    });

    document.getElementById('usersManagementForm')?.addEventListener('submit', event => saveUser(event, user));
    document.getElementById('userResetPasswordButton')?.addEventListener('click', () => resetPassword(user));
  }

  function renderOperationBox(operation, selectedOperations, selectedPeriods) {
    const periods = STATE.periods.filter(period => period.operation_id === operation.id);
    const checked = selectedOperations.has(operation.id);
    const regionalName = operation.regional_name || '';

    return `
      <div class="users-operation-box">
        <label class="users-operation-main">
          <input type="checkbox" data-operation-check="${escapeHTML(operation.id)}" ${checked ? 'checked' : ''}>
          <span>
            <strong>${escapeHTML(operation.name)}</strong>
            <small>${escapeHTML(regionalName)}${operation.use_period_filter ? ' · usa filtro por turno' : ''}</small>
          </span>
        </label>

        ${operation.use_period_filter ? `
          <div class="users-period-list" data-period-list-for="${escapeHTML(operation.id)}" ${checked ? '' : 'hidden'}>
            ${periods.length ? periods.map(period => `
              <label>
                <input
                  type="checkbox"
                  data-operation-period="${escapeHTML(period.id)}"
                  data-period-operation="${escapeHTML(operation.id)}"
                  ${selectedPeriods.has(period.id) ? 'checked' : ''}
                >
                <span>${escapeHTML(period.name)}</span>
              </label>
            `).join('') : '<span class="users-warning-text">⚠ Esta operação está configurada para usar turno, mas ainda não possui turnos cadastrados.</span>'}
          </div>
        ` : ''}
      </div>
    `;
  }

  function syncLeaderSection() {
    const section = document.getElementById('leaderResponsibilitySection');
    const role = document.getElementById('userEditRole')?.value;
    if (section) section.hidden = role !== 'LEADER';
  }

  function syncOperationPeriods(operationId) {
    const input = document.querySelector(`[data-operation-check="${cssEscape(operationId)}"]`);
    const list = document.querySelector(`[data-period-list-for="${cssEscape(operationId)}"]`);
    if (list) list.hidden = !input?.checked;
  }

  function collectResponsibility() {
    const operationIds = [...document.querySelectorAll('[data-operation-check]:checked')]
      .map(input => input.dataset.operationCheck)
      .filter(Boolean);

    const periodIds = [...document.querySelectorAll('[data-operation-period]:checked')]
      .filter(input => operationIds.includes(input.dataset.periodOperation))
      .map(input => input.dataset.operationPeriod)
      .filter(Boolean);

    return { operationIds: [...new Set(operationIds)], periodIds: [...new Set(periodIds)] };
  }

  async function saveUser(event, currentUser) {
    event.preventDefault();

    const button = document.getElementById('userSaveButton');
    setBusy(button, true, currentUser ? 'Salvando...' : 'Criando...');

    try {
      const fullName = value('userEditName');
      const email = value('userEditEmail').toLowerCase();
      const role = value('userEditRole');
      const active = value('userEditStatus') !== 'INACTIVE';
      const { operationIds, periodIds } = collectResponsibility();

      if (!fullName) throw new Error('Informe o nome completo.');
      if (!email.endsWith('@shopee.com')) throw new Error('Use um e-mail corporativo @shopee.com.');

      if (role === 'LEADER' && !operationIds.length) {
        throw new Error('Vincule o líder a pelo menos uma operação.');
      }

      for (const operationId of operationIds) {
        const operation = STATE.operations.find(item => item.id === operationId);
        if (operation?.use_period_filter) {
          const operationPeriods = STATE.periods.filter(item => item.operation_id === operationId);
          const selected = operationPeriods.some(item => periodIds.includes(item.id));
          if (operationPeriods.length && !selected) {
            throw new Error(`Selecione ao menos um turno para ${operation.name}.`);
          }
        }
      }

      const result = await invokeUsersFunction({
        action: currentUser ? 'update' : 'create',
        user_id: currentUser?.id || null,
        full_name: fullName,
        email,
        role,
        active,
        operation_ids: role === 'LEADER' ? operationIds : [],
        period_ids: role === 'LEADER' ? periodIds : []
      });

      if (result?.temporary_password) {
        showTemporaryPassword(result.temporary_password, email);
        await loadUsersData();
        renderUsersPage();
        return;
      }

      alert('Usuário atualizado com sucesso.');
      closeUserModal();
      await loadUsersData();
      renderUsersPage();
    } catch (error) {
      console.error(error);
      alert(error.message || 'Não foi possível salvar o usuário.');
    } finally {
      setBusy(button, false, currentUser ? 'Salvar alterações' : 'Criar acesso');
    }
  }

  async function resetPassword(user) {
    if (!user?.id) return;
    if (!confirm(`Gerar uma nova senha temporária para ${user.full_name}?`)) return;

    const button = document.getElementById('userResetPasswordButton');
    setBusy(button, true, 'Gerando...');

    try {
      const result = await invokeUsersFunction({ action: 'reset-password', user_id: user.id });
      showTemporaryPassword(result.temporary_password, result.email || user.corporate_email);
      await loadUsersData();
    } catch (error) {
      console.error(error);
      alert(error.message || 'Não foi possível redefinir a senha.');
    } finally {
      setBusy(button, false, 'Gerar nova senha temporária');
    }
  }

  function showTemporaryPassword(password, email) {
    const host = document.getElementById('usersTempPasswordHost');
    if (!host) return;

    host.innerHTML = `
      <div class="users-temp-password">
        <small>SENHA TEMPORÁRIA GERADA</small>
        <strong>${escapeHTML(password || '')}</strong>
        <span>${escapeHTML(email || '')}</span>
        <p>Copie agora. No próximo acesso o usuário deverá trocar a senha.</p>
        <button id="copyTemporaryPassword" type="button" class="users-secondary-button">Copiar senha</button>
      </div>
    `;

    document.getElementById('copyTemporaryPassword')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(password || '');
        alert('Senha copiada.');
      } catch (_) {
        alert(`Senha temporária: ${password}`);
      }
    });
  }

  function closeUserModal() {
    document.getElementById('usersModuleModal')?.remove();
  }

  function value(id) {
    return String(document.getElementById(id)?.value || '').trim();
  }

  function setBusy(button, busy, text) {
    if (!button) return;
    button.disabled = !!busy;
    button.textContent = text;
  }

  function option(value, label, selected) {
    return `<option value="${escapeHTML(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${escapeHTML(label)}</option>`;
  }

  function roleLabel(role) {
    return {
      ADMIN_RH: 'ADMIN / RH',
      HR_MANAGER: 'GESTOR DE RH',
      LEADER: 'LIDERANÇA',
      EMPLOYEE: 'COLABORADOR'
    }[role] || role || '-';
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

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return CSS.escape(value);
    return String(value || '').replace(/(["\\])/g, '\\$1');
  }

  const style = document.createElement('style');
  style.id = 'usersModuleStyles';
  style.textContent = `
    .users-metrics-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px}
    .users-metric{background:#fff;border:1px solid #e6e7eb;border-radius:14px;padding:18px}
    .users-metric small,.users-metric span{display:block;color:#6b7280}.users-metric strong{display:block;font-size:28px;margin:5px 0}
    .users-panel{background:#fff;border:1px solid #e6e7eb;border-radius:14px;padding:20px}
    .users-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}.users-panel-head h2{margin:0 0 4px}.users-panel-head p{margin:0;color:#6b7280}
    .users-primary-button,.users-secondary-button{border-radius:9px;padding:9px 14px;font-weight:700;cursor:pointer}.users-primary-button{border:1px solid #EE4D2D;background:#EE4D2D;color:#fff}.users-secondary-button{border:1px solid #e1e4e8;background:#fff;color:#222}.users-secondary-button:disabled,.users-primary-button:disabled{opacity:.55;cursor:not-allowed}
    .users-toolbar{display:grid;grid-template-columns:minmax(240px,2fr) minmax(170px,1fr) minmax(170px,1fr);gap:12px;margin-bottom:16px}.users-toolbar label>span,.users-field>span{display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:#6b7280}.users-toolbar input,.users-toolbar select,.users-field input,.users-field select{width:100%;box-sizing:border-box;padding:10px;border:1px solid #dfe2e7;border-radius:9px;background:#fff;color:#111}
    .users-table-wrap{overflow:auto}.users-table{width:100%;border-collapse:collapse}.users-table th{text-align:left;font-size:10px;letter-spacing:.04em;color:#6b7280;padding:11px;border-bottom:1px solid #e7e9ed}.users-table td{padding:12px 11px;border-bottom:1px solid #eceef1;vertical-align:middle}.users-empty{text-align:center;padding:35px!important;color:#6b7280}
    .users-person-cell{display:flex;align-items:center;gap:10px}.users-avatar{width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(238,77,45,.12);color:#EE4D2D;font-weight:800}.users-person-cell strong,.users-person-cell small{display:block}.users-person-cell small{color:#6b7280;margin-top:3px}
    .users-role-badge,.users-status,.users-operation-chip{display:inline-flex;border-radius:999px;padding:5px 8px;font-size:10px;font-weight:800}.users-role-badge{background:#f3f4f6;color:#4b5563}.users-role-badge.leader,.users-operation-chip{background:rgba(238,77,45,.09);color:#EE4D2D}.users-status.active{background:rgba(22,155,80,.1);color:#169b50}.users-status.inactive{background:rgba(107,114,128,.1);color:#6b7280}.users-operation-chip{margin:2px}.users-warning-text{color:#dc4b3e;font-size:11px}.users-muted{color:#8a9099;font-size:11px}
    .users-modal-overlay{position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:20px}.users-modal{width:min(920px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb}.users-modal-header{display:flex;justify-content:space-between;gap:20px;padding:22px;border-bottom:1px solid #eceef1}.users-modal-header small{color:#EE4D2D;font-weight:800;letter-spacing:.08em}.users-modal-header h2{margin:5px 0}.users-modal-header p{margin:0;color:#6b7280}.users-modal-close{border:0;background:transparent;font-size:26px;cursor:pointer;color:inherit}.users-form{padding:22px}.users-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.users-responsibility-section{margin-top:22px}.users-section-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;margin-bottom:10px}.users-section-head small{color:#EE4D2D;font-weight:800}.users-section-head h3{margin:3px 0}.users-section-head>span{font-size:11px;color:#6b7280}.users-operations-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.users-operation-box{border:1px solid #e5e7eb;border-radius:11px;padding:12px;background:#fafafa}.users-operation-main{display:flex;gap:10px;align-items:flex-start}.users-operation-main span strong,.users-operation-main span small{display:block}.users-operation-main span small{color:#6b7280;margin-top:3px}.users-period-list{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0 0 26px}.users-period-list label{display:flex;align-items:center;gap:5px;padding:6px 8px;border:1px solid #e2e5ea;border-radius:8px;font-size:11px}.users-note{margin-top:10px;padding:10px;border:1px solid #e5e7eb;border-radius:9px;background:#fafafa;font-size:11px;color:#6b7280}.users-temp-password{margin-top:18px;padding:14px;border:1px solid rgba(238,77,45,.25);border-radius:11px;background:rgba(238,77,45,.05)}.users-temp-password small,.users-temp-password strong,.users-temp-password span{display:block}.users-temp-password small{color:#EE4D2D;font-weight:800}.users-temp-password strong{font-size:20px;margin:5px 0;letter-spacing:.04em}.users-temp-password p{font-size:11px;color:#6b7280}.users-modal-footer{display:flex;justify-content:space-between;gap:12px;border-top:1px solid #eceef1;margin-top:22px;padding-top:18px}.users-footer-actions{display:flex;gap:8px}.users-error{padding:30px;border:1px solid rgba(220,38,38,.2);border-radius:14px}
    @media(max-width:900px){.users-metrics-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.users-toolbar,.users-form-grid,.users-operations-list{grid-template-columns:1fr}}@media(max-width:560px){.users-metrics-grid{grid-template-columns:1fr}.users-panel-head,.users-modal-footer,.users-section-head{flex-direction:column;align-items:stretch}.users-footer-actions{flex-direction:column}}
  `;
  document.head.appendChild(style);

  window.loadUsersPage = openUsersPage;
  window.closeUsersModal = closeUserModal;

  console.log('Shopee Journey: users.js carregado.');
})();
