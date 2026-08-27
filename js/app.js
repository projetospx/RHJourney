// ============================================================
// SHOPEE JOURNEY
// APP PRINCIPAL
// ============================================================

let currentUser = null;
let currentProfile = null;

let importRows = [];
let selectedImportFile = null;

let regionalsCache = [];
let regionalCurrentPage = 1;

let operationsCache = [];
let operationRegionalsCache = [];
let operationCurrentPage = 1;

let corporateUsersCache = [];
let corporateOperationsCache = [];
let corporateCurrentPage = 1;

const SETTINGS_PAGE_SIZE = 10;


// ============================================================
// ELEMENTOS PRINCIPAIS
// ============================================================

const pageContent =
  document.getElementById('pageContent');

const pageTitle =
  document.getElementById('pageTitle');

const pageSubtitle =
  document.getElementById('pageSubtitle');

const sidebarName =
  document.getElementById('sidebarName');

const sidebarRole =
  document.getElementById('sidebarRole');

const sidebarAvatar =
  document.getElementById('sidebarAvatar');

const logoutButton =
  document.getElementById('logoutButton');

const themeToggleApp =
  document.getElementById('themeToggleApp');

const sidebarToggle =
  document.getElementById('sidebarToggle');

const sidebar =
  document.getElementById('sidebar');


// ============================================================
// INICIALIZAÇÃO
// ============================================================

async function initializeApp() {

  try {

    const {
      data: sessionData
    } =
      await journeySupabase
        .auth
        .getSession();


    if (!sessionData.session) {

      window.location.href =
        'index.html';

      return;

    }


    currentUser =
      sessionData.session.user;


    const {
      data: profile,
      error
    } =
      await journeySupabase
        .from('profiles')
        .select(`
          id,
          full_name,
          role,
          corporate_email,
          must_change_password,
          active
        `)
        .eq(
          'id',
          currentUser.id
        )
        .single();


    if (error) {
      throw error;
    }


    if (!profile) {

      throw new Error(
        'Perfil não encontrado.'
      );

    }


    if (!profile.active) {

      await journeySupabase
        .auth
        .signOut();


      window.location.href =
        'index.html';

      return;

    }


    currentProfile =
      profile;


    sessionStorage.setItem(
      'journey-profile',
      JSON.stringify(profile)
    );


    applyRolePermissions();

    renderUser();

    await loadTheme();

    await loadDashboard();

  }

  catch (error) {

    console.error(
      'Erro ao carregar sistema:',
      error
    );


    pageContent.innerHTML = `

      <div class="system-error">

        <h2>
          Não foi possível carregar o sistema
        </h2>

        <p>
          ${escapeHTML(error.message)}
        </p>

        <button
          id="reloadAppButton"
          class="primary-action-button"
          type="button"
        >
          Tentar novamente
        </button>

      </div>

    `;


    document
      .getElementById(
        'reloadAppButton'
      )
      ?.addEventListener(
        'click',
        () => location.reload()
      );

  }

}


// ============================================================
// PERMISSÕES VISUAIS
// ============================================================

function applyRolePermissions() {

  const role =
    currentProfile.role;


  document
    .querySelectorAll(
      '.admin-only'
    )
    .forEach(
      element => {

        element.style.display =
          role === 'ADMIN_RH'
            ? ''
            : 'none';

      }
    );


  document
    .querySelectorAll(
      '.management-view'
    )
    .forEach(
      element => {

        element.style.display =
          (
            role === 'ADMIN_RH'
            ||
            role === 'HR_MANAGER'
          )
            ? ''
            : 'none';

      }
    );

}


// ============================================================
// USUÁRIO
// ============================================================

function renderUser() {

  sidebarName.textContent =
    currentProfile.full_name;


  const roles = {

    ADMIN_RH:
      'ADM / RH',

    HR_MANAGER:
      'Gestor de RH',

    LEADER:
      'Liderança',

    EMPLOYEE:
      'Colaborador'

  };


  sidebarRole.textContent =
    roles[currentProfile.role]
    ||
    currentProfile.role;


  sidebarAvatar.textContent =
    getInitials(
      currentProfile.full_name
    );

}


function getInitials(name) {

  if (!name) {
    return 'U';
  }


  const parts =
    name
      .trim()
      .split(/\s+/);


  if (parts.length === 1) {

    return parts[0]
      .substring(0, 2)
      .toUpperCase();

  }


  return (
    parts[0][0]
    +
    parts[parts.length - 1][0]
  )
    .toUpperCase();

}


// ============================================================
// DASHBOARD
// ============================================================

async function loadDashboard() {

  setActiveMenu(
    'dashboard'
  );


  pageTitle.textContent =
    'Visão Geral';


  pageSubtitle.textContent =
    (
      currentProfile.role === 'ADMIN_RH'
      ||
      currentProfile.role === 'HR_MANAGER'
    )
      ? 'Acompanhe as jornadas dos novos colaboradores.'
      : 'Acompanhe sua jornada e suas avaliações.';


  showPageLoading();


  if (
    currentProfile.role === 'ADMIN_RH'
    ||
    currentProfile.role === 'HR_MANAGER'
  ) {

    await loadAdminDashboard();

    return;

  }


  if (
    currentProfile.role ===
    'LEADER'
  ) {

    await loadLeaderDashboard();

    return;

  }


  await loadEmployeeDashboard();

}


// ============================================================
// DASHBOARD ADM / GESTOR RH
// ============================================================

async function loadAdminDashboard() {

  try {

    const [
      waitingResult,
      journeyResult,
      completedResult,
      peopleResult
    ] =
      await Promise.all([

        journeySupabase
          .from('employments')
          .select(
            'id',
            {
              count: 'exact',
              head: true
            }
          )
          .eq(
            'status',
            'WAITING'
          ),

        journeySupabase
          .from('employments')
          .select(
            'id',
            {
              count: 'exact',
              head: true
            }
          )
          .eq(
            'status',
            'IN_JOURNEY'
          ),

        journeySupabase
          .from('employments')
          .select(
            'id',
            {
              count: 'exact',
              head: true
            }
          )
          .eq(
            'status',
            'COMPLETED'
          ),

        journeySupabase
          .from('people')
          .select(
            'id',
            {
              count: 'exact',
              head: true
            }
          )

      ]);


    const resultError =
      [
        waitingResult,
        journeyResult,
        completedResult,
        peopleResult
      ]
        .find(
          result => result.error
        )
        ?.error;


    if (resultError) {
      throw resultError;
    }


    const pendingInfo =
      await calculatePendingAssessments();


    renderAdminDashboard({

      waiting:
        waitingResult.count || 0,

      inJourney:
        journeyResult.count || 0,

      completed:
        completedResult.count || 0,

      totalPeople:
        peopleResult.count || 0,

      pending:
        pendingInfo.total

    });


    updatePendingBadge(
      pendingInfo.total
    );

  }

  catch (error) {

    console.error(
      'Erro Dashboard:',
      error
    );


    pageContent.innerHTML = `

      <div class="system-error">

        <h2>
          Erro ao carregar o Dashboard
        </h2>

        <p>
          ${escapeHTML(error.message)}
        </p>

      </div>

    `;

  }

}


function renderAdminDashboard(data) {

  const firstName =
    currentProfile
      .full_name
      .split(' ')[0];


  const isAdmin =
    currentProfile.role ===
    'ADMIN_RH';


  pageContent.innerHTML = `

    <div class="welcome-banner">

      <div>

        <span class="welcome-label">
          SHOPEE JOURNEY
        </span>

        <h2>
          Olá, ${escapeHTML(firstName)} 👋
        </h2>

        <p>
          Aqui está o panorama atual das jornadas
          de novos colaboradores.
        </p>

      </div>

      <div class="welcome-mark">
        Journey
      </div>

    </div>


    <div class="dashboard-section">

      <div class="section-heading">

        <div>

          <h2>
            Acompanhamento
          </h2>

          <p>
            Visão consolidada dos colaboradores.
          </p>

        </div>

      </div>


      <div class="metric-grid">


        <button
          class="metric-card"
          type="button"
          data-open-page="${
            isAdmin
              ? 'new-employees'
              : 'journeys'
          }"
        >

          <div class="metric-card-top">

            <div class="metric-icon blue">
              ＋
            </div>

            <span class="metric-status">
              Aguardando
            </span>

          </div>

          <strong>
            ${data.waiting}
          </strong>

          <span>
            Novos a iniciar
          </span>

        </button>


        <button
          class="metric-card"
          type="button"
          data-open-page="journeys"
        >

          <div class="metric-card-top">

            <div class="metric-icon orange">
              ↗
            </div>

            <span class="metric-status">
              Ativos
            </span>

          </div>

          <strong>
            ${data.inJourney}
          </strong>

          <span>
            Em acompanhamento
          </span>

        </button>


        <button
          class="metric-card"
          type="button"
          data-open-page="pending"
        >

          <div class="metric-card-top">

            <div class="metric-icon red">
              !
            </div>

            <span class="metric-status danger">
              Atenção
            </span>

          </div>

          <strong>
            ${data.pending}
          </strong>

          <span>
            Avaliações pendentes
          </span>

        </button>


        <button
          class="metric-card"
          type="button"
          data-open-page="journeys"
        >

          <div class="metric-card-top">

            <div class="metric-icon green">
              ✓
            </div>

            <span class="metric-status">
              Concluídos
            </span>

          </div>

          <strong>
            ${data.completed}
          </strong>

          <span>
            Jornadas concluídas
          </span>

        </button>

      </div>

    </div>


    <div class="dashboard-columns">


      <section class="dashboard-panel">

        <div class="panel-header">

          <div>

            <h3>
              Avaliações que precisam de atenção
            </h3>

            <p>
              Controle de prazos das jornadas.
            </p>

          </div>

          <button
            class="text-button"
            type="button"
            data-open-page="pending"
          >
            Ver todas
          </button>

        </div>


        ${
          data.pending > 0

          ? `

            <div class="attention-box">

              <div class="attention-icon">
                !
              </div>

              <div>

                <strong>

                  ${data.pending}

                  ${
                    data.pending === 1
                      ? 'avaliação necessita'
                      : 'avaliações necessitam'
                  }

                  de acompanhamento

                </strong>

                <p>
                  Consulte as pendências para identificar
                  líderes e colaboradores.
                </p>

              </div>

            </div>

          `

          : `

            <div class="empty-state">

              <div class="empty-icon">
                ✓
              </div>

              <strong>
                Tudo em dia
              </strong>

              <p>
                Nenhuma avaliação vencida no momento.
              </p>

            </div>

          `
        }

      </section>


      <section class="dashboard-panel">

        <div class="panel-header">

          <div>

            <h3>
              Base de acompanhamento
            </h3>

            <p>
              Pessoas registradas no Journey.
            </p>

          </div>

        </div>


        <div class="base-summary">

          <div>

            <span>
              Colaboradores cadastrados
            </span>

            <strong>
              ${data.totalPeople}
            </strong>

          </div>


          <div>

            <span>
              Jornadas ativas
            </span>

            <strong>
              ${data.inJourney}
            </strong>

          </div>


          <div>

            <span>
              Aguardando início
            </span>

            <strong>
              ${data.waiting}
            </strong>

          </div>

        </div>


        ${
          isAdmin

          ? `

            <button
              class="secondary-button full-button"
              type="button"
              data-open-page="new-employees"
            >
              + Importar novos colaboradores
            </button>

          `

          : ''
        }

      </section>

    </div>

  `;

}


// ============================================================
// EVENTOS DINÂMICOS GERAIS
// ============================================================

pageContent
  .addEventListener(
    'click',
    event => {

      const openPageButton =
        event.target.closest(
          '[data-open-page]'
        );


      if (openPageButton) {

        openPage(
          openPageButton
            .dataset
            .openPage
        );

      }

    }
  );


// ============================================================
// PENDÊNCIAS
// ============================================================

async function calculatePendingAssessments() {

  try {

    const now =
      new Date()
        .toISOString();


    const {
      data: checkpoints,
      error
    } =
      await journeySupabase
        .from(
          'journey_checkpoints'
        )
        .select(`
          id,
          checkpoint,
          opens_at,
          due_at,
          journey_id
        `)
        .lte(
          'due_at',
          now
        );


    if (error) {
      throw error;
    }


    if (
      !checkpoints ||
      checkpoints.length === 0
    ) {

      return {
        total: 0
      };

    }


    let pendingCount = 0;


    for (
      const checkpoint
      of checkpoints
    ) {

      const {
        count,
        error: submissionError
      } =
        await journeySupabase
          .from(
            'assessment_submissions'
          )
          .select(
            'id',
            {
              count: 'exact',
              head: true
            }
          )
          .eq(
            'checkpoint_id',
            checkpoint.id
          )
          .eq(
            'status',
            'SUBMITTED'
          );


      if (submissionError) {

        console.warn(
          submissionError
        );

        continue;

      }


      if (
        (count || 0) < 2
      ) {

        pendingCount +=
          2 - (count || 0);

      }

    }


    return {
      total:
        pendingCount
    };

  }

  catch (error) {

    console.warn(
      'Não foi possível calcular pendências:',
      error
    );


    return {
      total: 0
    };

  }

}


// ============================================================
// DASHBOARD LÍDER
// ============================================================

async function loadLeaderDashboard() {

  pageContent.innerHTML = `

    <div class="welcome-banner">

      <div>

        <span class="welcome-label">
          JORNADA DA EQUIPE
        </span>

        <h2>
          Olá,
          ${escapeHTML(
            currentProfile
              .full_name
              .split(' ')[0]
          )}
          👋
        </h2>

        <p>
          Aqui você acompanhará os novos colaboradores
          das operações vinculadas a você.
        </p>

      </div>

    </div>


    <div class="empty-state large">

      <div class="empty-icon">
        ↗
      </div>

      <strong>
        Jornada da Equipe
      </strong>

      <p>
        Em breve esta área mostrará Todos da Operação,
        A Identificar e Meus Colaboradores.
      </p>

    </div>

  `;

}


// ============================================================
// DASHBOARD COLABORADOR
// ============================================================

async function loadEmployeeDashboard() {

  pageContent.innerHTML = `

    <div class="welcome-banner">

      <div>

        <span class="welcome-label">
          MINHA JORNADA
        </span>

        <h2>
          Olá,
          ${escapeHTML(
            currentProfile
              .full_name
              .split(' ')[0]
          )}
          👋
        </h2>

        <p>
          Acompanhe aqui sua jornada
          de integração.
        </p>

      </div>

    </div>


    <div class="empty-state large">

      <div class="empty-icon">
        ✓
      </div>

      <strong>
        Minha Jornada
      </strong>

      <p>
        Seus checkpoints aparecerão aqui
        automaticamente.
      </p>

    </div>

  `;

}


// ============================================================
// NAVEGAÇÃO
// ============================================================

document
  .querySelectorAll(
    '.menu-item[data-page]'
  )
  .forEach(
    button => {

      button.addEventListener(
        'click',
        () => {

          openPage(
            button.dataset.page
          );

        }
      );

    }
  );


async function openPage(page) {

  setActiveMenu(page);


  switch (page) {


    case 'dashboard':

      await loadDashboard();

      break;


    case 'new-employees':

      if (
        currentProfile.role !==
        'ADMIN_RH'
      ) {

        await loadDashboard();

        return;

      }


      pageTitle.textContent =
        'Novos Colaboradores';


      pageSubtitle.textContent =
        'Importe e prepare colaboradores antes de iniciar o acompanhamento.';


      await loadNewEmployeesPage();

      break;


    case 'journeys':

      pageTitle.textContent =
        'Jornadas';


      pageSubtitle.textContent =
        'Acompanhe o progresso D1 → D90.';


      renderComingSoon(
        'Gestão de Jornadas',
        'Aqui ficarão os colaboradores atualmente em acompanhamento.'
      );

      break;


    case 'assessments':

      pageTitle.textContent =
        'Avaliações';


      pageSubtitle.textContent =
        'Avaliações de colaboradores e lideranças.';


      renderComingSoon(
        'Avaliações',
        'Aqui serão exibidas as avaliações D1, D7, D15, D30, D45 e D90.'
      );

      break;


    case 'pending':

      pageTitle.textContent =
        'Pendências';


      pageSubtitle.textContent =
        'Avaliações próximas do prazo ou atrasadas.';


      renderComingSoon(
        'Central de Pendências',
        'Aqui você verá quem precisa responder e qual avaliação está pendente.'
      );

      break;


    case 'indicators':

      pageTitle.textContent =
        'Indicadores';


      pageSubtitle.textContent =
        'Dados consolidados das jornadas.';


      renderComingSoon(
        'Indicadores',
        'Aqui teremos análises por Regional, Operação, BPO, liderança e período.'
      );

      break;


    case 'settings':

      if (
        currentProfile.role !==
        'ADMIN_RH'
      ) {

        await loadDashboard();

        return;

      }


      pageTitle.textContent =
        'Configurações';


      pageSubtitle.textContent =
        'Estrutura e acessos do Shopee Journey.';


      await loadSettingsHome();

      break;

  }


  if (
    window.innerWidth <=
    900
  ) {

    sidebar.classList
      .remove('open');

  }

}


function setActiveMenu(page) {

  document
    .querySelectorAll(
      '.menu-item'
    )
    .forEach(
      item => {

        item.classList.toggle(
          'active',
          item.dataset.page === page
        );

      }
    );

}


function renderComingSoon(
  title,
  description
) {

  pageContent.innerHTML = `

    <div class="coming-soon">

      <div class="coming-icon">
        J
      </div>

      <h2>
        ${escapeHTML(title)}
      </h2>

      <p>
        ${escapeHTML(description)}
      </p>

      <span>
        Módulo em construção
      </span>

    </div>

  `;

}


// ============================================================
// BADGE PENDÊNCIAS
// ============================================================

function updatePendingBadge(number) {

  const badge =
    document.getElementById(
      'pendingBadge'
    );


  if (!badge) {
    return;
  }


  if (number > 0) {

    badge.textContent =
      number > 99
        ? '99+'
        : number;


    badge.classList
      .remove('hidden');

  }

  else {

    badge.classList
      .add('hidden');

  }

}


// ============================================================
// TEMA
// ============================================================

async function loadTheme() {

  let savedTheme =
    localStorage.getItem(
      'journey-theme'
    )
    ||
    'light';


  if (currentProfile) {

    try {

      const {
        data
      } =
        await journeySupabase
          .from(
            'user_preferences'
          )
          .select('theme')
          .eq(
            'user_id',
            currentProfile.id
          )
          .maybeSingle();


      if (
        data?.theme
      ) {

        savedTheme =
          data.theme;


        localStorage.setItem(
          'journey-theme',
          savedTheme
        );

      }

    }

    catch (error) {

      console.warn(
        'Tema será mantido localmente.',
        error
      );

    }

  }


  document.documentElement
    .setAttribute(
      'data-theme',
      savedTheme
    );


  updateThemeIcon(
    savedTheme
  );

}


themeToggleApp
  .addEventListener(
    'click',
    async () => {

      const currentTheme =
        document.documentElement
          .getAttribute(
            'data-theme'
          );


      const newTheme =
        currentTheme ===
        'dark'
          ? 'light'
          : 'dark';


      document.documentElement
        .setAttribute(
          'data-theme',
          newTheme
        );


      localStorage.setItem(
        'journey-theme',
        newTheme
      );


      updateThemeIcon(
        newTheme
      );


      if (currentProfile) {

        const {
          error
        } =
          await journeySupabase
            .from(
              'user_preferences'
            )
            .upsert({

              user_id:
                currentProfile.id,

              theme:
                newTheme,

              updated_at:
                new Date()
                  .toISOString()

            });


        if (error) {

          console.warn(
            'Tema salvo apenas localmente.',
            error
          );

        }

      }

    }
  );


function updateThemeIcon(theme) {

  themeToggleApp.textContent =
    theme === 'dark'
      ? '☀️'
      : '🌙';

}


// ============================================================
// LOGOUT
// ============================================================

logoutButton
  .addEventListener(
    'click',
    async () => {

      logoutButton.disabled =
        true;


      await journeySupabase
        .auth
        .signOut();


      sessionStorage.removeItem(
        'journey-profile'
      );


      window.location.href =
        'index.html';

    }
  );


// ============================================================
// MENU MOBILE
// ============================================================

sidebarToggle
  .addEventListener(
    'click',
    () => {

      sidebar.classList
        .toggle('open');

    }
  );


// ============================================================
// NOVOS COLABORADORES
// ============================================================

async function loadNewEmployeesPage() {

  if (
    currentProfile.role !==
    'ADMIN_RH'
  ) {
    return;
  }


  pageContent.innerHTML = `

    <div class="module-header">

      <div>

        <h2>
          Novos Colaboradores
        </h2>

        <p>
          Importe colaboradores e prepare
          o início das jornadas.
        </p>

      </div>


      <div class="module-actions">

        <button
          id="downloadEmployeeTemplateButton"
          class="secondary-button"
          type="button"
        >
          ↓ Baixar modelo
        </button>


        <button
          id="openImportModalButton"
          class="primary-action-button"
          type="button"
        >
          + Importar planilha
        </button>

      </div>

    </div>


    <section class="dashboard-panel">

      <div class="panel-header">

        <div>

          <h3>
            Aguardando início
          </h3>

          <p>
            Colaboradores cadastrados que ainda
            não iniciaram a jornada.
          </p>

        </div>

      </div>


      <div id="waitingEmployees">

        <div class="page-loading">
          Carregando colaboradores...
        </div>

      </div>

    </section>


    <div
      id="importModal"
      class="modal-overlay hidden"
    >

      <div class="import-modal">


        <div class="modal-header">

          <div>

            <h2>
              Importar colaboradores
            </h2>

            <p>
              Excel (.xlsx) ou CSV
            </p>

          </div>


          <button
            id="closeImportModalButton"
            class="modal-close"
            type="button"
          >
            ×
          </button>

        </div>


        <div id="importStepUpload">


          <div
            id="uploadArea"
            class="upload-area"
          >

            <div class="upload-icon">
              ↑
            </div>

            <strong>
              Selecione a planilha
            </strong>

            <p>
              Clique aqui para escolher o arquivo
            </p>

            <span>
              XLSX ou CSV
            </span>

          </div>


          <input
            id="employeeFileInput"
            type="file"
            accept=".xlsx,.xls,.csv"
            hidden
          >


          <div class="template-info">

            <div>

              <strong>
                Utilize o modelo oficial
              </strong>

              <p>
                Para evitar erros na importação,
                utilize a planilha padrão do
                Shopee Journey.
              </p>

            </div>


            <button
              id="downloadTemplateInsideModal"
              class="secondary-button"
              type="button"
            >
              ↓ Baixar modelo
            </button>

          </div>

        </div>


        <div
          id="importPreview"
          class="hidden"
        ></div>


      </div>

    </div>

  `;


  document
    .getElementById(
      'downloadEmployeeTemplateButton'
    )
    ?.addEventListener(
      'click',
      downloadEmployeeTemplate
    );


  document
    .getElementById(
      'downloadTemplateInsideModal'
    )
    ?.addEventListener(
      'click',
      downloadEmployeeTemplate
    );


  document
    .getElementById(
      'openImportModalButton'
    )
    ?.addEventListener(
      'click',
      openImportModal
    );


  document
    .getElementById(
      'closeImportModalButton'
    )
    ?.addEventListener(
      'click',
      closeImportModal
    );


  document
    .getElementById(
      'uploadArea'
    )
    ?.addEventListener(
      'click',
      () => {

        document
          .getElementById(
            'employeeFileInput'
          )
          ?.click();

      }
    );


  document
    .getElementById(
      'employeeFileInput'
    )
    ?.addEventListener(
      'change',
      handleEmployeeFile
    );


  await loadWaitingEmployees();

}


// ============================================================
// MODELO DE IMPORTAÇÃO
// ============================================================

function downloadEmployeeTemplate() {

  if (
    typeof XLSX ===
    'undefined'
  ) {

    alert(
      'Biblioteca Excel não carregada.'
    );

    return;

  }


  const importData = [

    [
      'NOME',
      'CPF',
      'DATA DE NASCIMENTO',
      'BPO',
      'DATA DE ADMISSÃO',
      'EMAIL',
      'TELEFONE',
      'HUB/OPERAÇÃO',
      'HORÁRIO/ESCALA'
    ]

  ];


  const importSheet =
    XLSX.utils.aoa_to_sheet(
      importData
    );


  importSheet['!cols'] = [

    { wch: 30 },
    { wch: 16 },
    { wch: 22 },
    { wch: 25 },
    { wch: 20 },
    { wch: 32 },
    { wch: 20 },
    { wch: 25 },
    { wch: 28 }

  ];


  const instructions = [

    [
      'SHOPEE JOURNEY',
      'MODELO DE IMPORTAÇÃO DE NOVOS COLABORADORES'
    ],

    [],

    [
      'CAMPO',
      'ORIENTAÇÃO'
    ],

    [
      'NOME',
      'Nome completo do colaborador.'
    ],

    [
      'CPF',
      'Obrigatório. Informe os 11 números do CPF.'
    ],

    [
      'DATA DE NASCIMENTO',
      'Obrigatório. Preferencialmente DD/MM/AAAA.'
    ],

    [
      'BPO',
      'Nome da BPO responsável pela contratação.'
    ],

    [
      'DATA DE ADMISSÃO',
      'Obrigatório. Preferencialmente DD/MM/AAAA.'
    ],

    [
      'EMAIL',
      'E-mail cadastral do colaborador.'
    ],

    [
      'TELEFONE',
      'Telefone com DDD.'
    ],

    [
      'HUB/OPERAÇÃO',
      'Utilize exatamente o código da Operação cadastrada no Journey.'
    ],

    [
      'HORÁRIO/ESCALA',
      'Informe o horário e/ou escala do colaborador.'
    ],

    [],

    [
      'IMPORTANTE',
      'Não altere os nomes das colunas da aba IMPORTAÇÃO.'
    ],

    [
      'IMPORTANTE',
      'A Operação precisa existir previamente no Shopee Journey.'
    ],

    [
      'IMPORTANTE',
      'A importação não inicia automaticamente a jornada.'
    ]

  ];


  const instructionsSheet =
    XLSX.utils.aoa_to_sheet(
      instructions
    );


  instructionsSheet['!cols'] = [

    { wch: 25 },
    { wch: 85 }

  ];


  const workbook =
    XLSX.utils.book_new();


  XLSX.utils.book_append_sheet(
    workbook,
    importSheet,
    'IMPORTAÇÃO'
  );


  XLSX.utils.book_append_sheet(
    workbook,
    instructionsSheet,
    'INSTRUÇÕES'
  );


  XLSX.writeFile(
    workbook,
    'Modelo_Importacao_Shopee_Journey.xlsx'
  );

}


// ============================================================
// MODAL IMPORTAÇÃO
// ============================================================

function openImportModal() {

  selectedImportFile =
    null;


  importRows =
    [];


  document
    .getElementById(
      'importModal'
    )
    ?.classList
    .remove('hidden');


  document
    .getElementById(
      'importStepUpload'
    )
    ?.classList
    .remove('hidden');


  document
    .getElementById(
      'importPreview'
    )
    ?.classList
    .add('hidden');

}


function closeImportModal() {

  document
    .getElementById(
      'importModal'
    )
    ?.classList
    .add('hidden');

}


// ============================================================
// NORMALIZAÇÃO DA PLANILHA
// ============================================================

function normalizeHeader(value) {

  return String(
    value || ''
  )
    .trim()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .replace(
      /[^A-Z0-9]+/g,
      '_'
    )
    .replace(
      /^_+|_+$/g,
      ''
    );

}


// ============================================================
// CONVERSÃO DE DATA
// ============================================================

function excelDateToISO(value) {

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {

    return '';

  }


  if (
    typeof value ===
    'number'
  ) {

    const parsed =
      XLSX.SSF.parse_date_code(
        value
      );


    if (!parsed) {
      return '';
    }


    return buildValidISODate(
      parsed.y,
      parsed.m,
      parsed.d
    );

  }


  if (
    value instanceof Date
    &&
    !Number.isNaN(
      value.getTime()
    )
  ) {

    return buildValidISODate(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate()
    );

  }


  let text =
    String(value)
      .trim();


  if (!text) {
    return '';
  }


  text =
    text
      .split(' ')[0]
      .split('T')[0];


  const iso =
    text.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    );


  if (iso) {

    return buildValidISODate(
      Number(iso[1]),
      Number(iso[2]),
      Number(iso[3])
    );

  }


  const slash =
    text.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    );


  if (slash) {

    const first =
      Number(slash[1]);

    const second =
      Number(slash[2]);

    const year =
      Number(slash[3]);


    let day;
    let month;


    if (first > 12) {

      day =
        first;

      month =
        second;

    }

    else if (second > 12) {

      month =
        first;

      day =
        second;

    }

    else {

      day =
        first;

      month =
        second;

    }


    return buildValidISODate(
      year,
      month,
      day
    );

  }


  const dash =
    text.match(
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/
    );


  if (dash) {

    return buildValidISODate(
      Number(dash[3]),
      Number(dash[2]),
      Number(dash[1])
    );

  }


  return '';

}


function buildValidISODate(
  year,
  month,
  day
) {

  if (
    !year ||
    !month ||
    !day
  ) {
    return '';
  }


  if (
    month < 1 ||
    month > 12
  ) {
    return '';
  }


  if (
    day < 1 ||
    day > 31
  ) {
    return '';
  }


  const date =
    new Date(
      year,
      month - 1,
      day
    );


  if (
    date.getFullYear() !== year
    ||
    date.getMonth() !== month - 1
    ||
    date.getDate() !== day
  ) {
    return '';
  }


  return (
    String(year)
    +
    '-'
    +
    String(month)
      .padStart(
        2,
        '0'
      )
    +
    '-'
    +
    String(day)
      .padStart(
        2,
        '0'
      )
  );

}


// ============================================================
// LER PLANILHA
// ============================================================

async function handleEmployeeFile(event) {

  const file =
    event
      .target
      .files[0];


  if (!file) {
    return;
  }


  selectedImportFile =
    file;


  try {

    const buffer =
      await file.arrayBuffer();


    const workbook =
      XLSX.read(
        buffer,
        {
          type: 'array',
          cellDates: false
        }
      );


    const firstSheet =
      workbook
        .SheetNames[0];


    const sheet =
      workbook
        .Sheets[firstSheet];


    const rawRows =
      XLSX.utils
        .sheet_to_json(
          sheet,
          {
            defval: ''
          }
        );


    if (
      rawRows.length === 0
    ) {

      throw new Error(
        'A planilha está vazia.'
      );

    }


    importRows =
      rawRows.map(
        mapSpreadsheetRow
      );


    renderImportPreview();

  }

  catch (error) {

    console.error(
      error
    );


    alert(
      error.message
      ||
      'Não foi possível ler a planilha.'
    );

  }

}


// ============================================================
// MAPEAR PLANILHA
// ============================================================

function mapSpreadsheetRow(original) {

  const normalized = {};


  for (
    const [key, value]
    of Object.entries(original)
  ) {

    normalized[
      normalizeHeader(key)
    ] =
      value;

  }


  return {

    nome:
      String(
        normalized.NOME
        ||
        normalized.NOME_COMPLETO
        ||
        ''
      )
        .trim(),


    cpf:
      String(
        normalized.CPF
        ||
        ''
      )
        .replace(
          /\D/g,
          ''
        ),


    data_nascimento:
      excelDateToISO(
        normalized.DATA_DE_NASCIMENTO
        ||
        normalized.DATA_NASCIMENTO
        ||
        normalized.NASCIMENTO
      ),


    bpo:
      String(
        normalized.BPO
        ||
        ''
      )
        .trim(),


    data_admissao:
      excelDateToISO(
        normalized.DATA_DE_ADMISSAO
        ||
        normalized.DATA_ADMISSAO
        ||
        normalized.ADMISSAO
      ),


    email:
      String(
        normalized.EMAIL
        ||
        normalized.E_MAIL
        ||
        ''
      )
        .trim()
        .toLowerCase(),


    telefone:
      String(
        normalized.TELEFONE
        ||
        normalized.CELULAR
        ||
        ''
      )
        .replace(
          /\D/g,
          ''
        ),


    operacao:
      String(
        normalized.HUB_OPERACAO
        ||
        normalized.HUB
        ||
        normalized.OPERACAO
        ||
        ''
      )
        .trim(),


    horario_escala:
      String(
        normalized.HORARIO_ESCALA
        ||
        normalized.HORARIO
        ||
        normalized.ESCALA
        ||
        ''
      )
        .trim()

  };

}


// ============================================================
// VALIDAR IMPORTAÇÃO
// ============================================================

function validateImportRow(row) {

  const errors = [];


  if (!row.nome) {
    errors.push('Nome');
  }


  if (
    !row.cpf ||
    row.cpf.length !== 11
  ) {
    errors.push('CPF');
  }


  if (!row.data_nascimento) {
    errors.push('Nascimento');
  }


  if (!row.bpo) {
    errors.push('BPO');
  }


  if (!row.data_admissao) {
    errors.push('Admissão');
  }


  if (!row.email) {
    errors.push('E-mail');
  }


  if (!row.telefone) {
    errors.push('Telefone');
  }


  if (!row.operacao) {
    errors.push('Operação');
  }


  if (!row.horario_escala) {
    errors.push('Horário/Escala');
  }


  return errors;

}


// ============================================================
// PRÉVIA DA IMPORTAÇÃO
// ============================================================

function renderImportPreview() {

  const preview =
    document.getElementById(
      'importPreview'
    );


  const uploadStep =
    document.getElementById(
      'importStepUpload'
    );


  if (
    !preview ||
    !uploadStep
  ) {
    return;
  }


  uploadStep
    .classList
    .add('hidden');


  preview
    .classList
    .remove('hidden');


  let valid = 0;
  let invalid = 0;


  const rowsHTML =
    importRows
      .map(
        (row, index) => {

          const errors =
            validateImportRow(row);


          const isValid =
            errors.length === 0;


          if (isValid) {
            valid++;
          }

          else {
            invalid++;
          }


          return `

            <tr>

              <td>
                ${index + 2}
              </td>

              <td>
                <strong>
                  ${escapeHTML(
                    row.nome ||
                    'Não informado'
                  )}
                </strong>
              </td>

              <td>
                ${escapeHTML(
                  formatCPF(row.cpf)
                )}
              </td>

              <td>
                ${escapeHTML(row.bpo)}
              </td>

              <td>
                ${escapeHTML(row.operacao)}
              </td>

              <td>

                ${
                  isValid

                  ? `
                    <span class="status-pill success">
                      Válido
                    </span>
                  `

                  : `
                    <span
                      class="status-pill error"
                      title="${escapeHTML(
                        errors.join(', ')
                      )}"
                    >
                      Incompleto
                    </span>
                  `
                }

              </td>

            </tr>

          `;

        }
      )
      .join('');


  preview.innerHTML = `

    <div class="import-summary">

      <div>

        <span>
          Registros
        </span>

        <strong>
          ${importRows.length}
        </strong>

      </div>


      <div class="summary-valid">

        <span>
          Válidos
        </span>

        <strong>
          ${valid}
        </strong>

      </div>


      <div class="summary-error">

        <span>
          Com problemas
        </span>

        <strong>
          ${invalid}
        </strong>

      </div>

    </div>


    <div class="import-file-name">

      <span>
        Arquivo:
      </span>

      <strong>
        ${escapeHTML(
          selectedImportFile?.name || ''
        )}
      </strong>

    </div>


    <div class="table-wrapper">

      <table class="journey-table">

        <thead>

          <tr>
            <th>Linha</th>
            <th>Nome</th>
            <th>CPF</th>
            <th>BPO</th>
            <th>HUB</th>
            <th>Validação</th>
          </tr>

        </thead>


        <tbody>
          ${rowsHTML}
        </tbody>

      </table>

    </div>


    <div class="import-actions">

      <button
        id="resetImportButton"
        class="secondary-button"
        type="button"
      >
        Escolher outro arquivo
      </button>


      <button
        id="confirmImportButton"
        class="primary-action-button"
        type="button"
        ${
          valid === 0
            ? 'disabled'
            : ''
        }
      >
        Confirmar importação
      </button>

    </div>

  `;


  document
    .getElementById(
      'resetImportButton'
    )
    ?.addEventListener(
      'click',
      resetImport
    );


  document
    .getElementById(
      'confirmImportButton'
    )
    ?.addEventListener(
      'click',
      confirmEmployeeImport
    );

}


// ============================================================
// RESET IMPORTAÇÃO
// ============================================================

function resetImport() {

  importRows = [];

  selectedImportFile =
    null;


  const input =
    document.getElementById(
      'employeeFileInput'
    );


  if (input) {
    input.value = '';
  }


  document
    .getElementById(
      'importPreview'
    )
    ?.classList
    .add('hidden');


  document
    .getElementById(
      'importStepUpload'
    )
    ?.classList
    .remove('hidden');

}


// ============================================================
// CONFIRMAR IMPORTAÇÃO
// ============================================================

async function confirmEmployeeImport() {

  const button =
    document.getElementById(
      'confirmImportButton'
    );


  const validRows =
    importRows.filter(
      row =>
        validateImportRow(row)
          .length === 0
    );


  if (!validRows.length) {

    alert(
      'Nenhum registro válido para importar.'
    );

    return;

  }


  if (button) {

    button.disabled =
      true;

    button.textContent =
      'Importando...';

  }


  try {

    const {
      data,
      error
    } =
      await journeySupabase
        .functions
        .invoke(
          'import-employees',
          {
            body: {

              fileName:
                selectedImportFile?.name
                ||
                'planilha',

              rows:
                validRows

            }
          }
        );


    if (error) {

      throw new Error(
        await readEdgeFunctionError(
          error,
          'Erro ao importar colaboradores.'
        )
      );

    }


    if (
      !data ||
      data.success !== true
    ) {

      throw new Error(
        data?.error
        ||
        data?.message
        ||
        'A importação não foi concluída.'
      );

    }


    renderImportResult(
      data
    );

  }

  catch (error) {

    console.error(
      'Erro de importação:',
      error
    );


    alert(
      error.message
      ||
      'Erro ao importar colaboradores.'
    );


    if (button) {

      button.disabled =
        false;

      button.textContent =
        'Confirmar importação';

    }

  }

}


// ============================================================
// RESULTADO DA IMPORTAÇÃO
// ============================================================

function renderImportResult(result) {

  const preview =
    document.getElementById(
      'importPreview'
    );


  if (!preview) {
    return;
  }


  const errorRows =
    (
      result.results
      ||
      []
    )
      .filter(
        item =>
          item.status ===
          'ERROR'
      );


  preview.innerHTML = `

    <div class="import-result">

      <div
        class="result-icon ${
          result.errors > 0
            ? 'warning'
            : 'success'
        }"
      >
        ${
          result.errors > 0
            ? '!'
            : '✓'
        }
      </div>


      <h2>
        Importação concluída
      </h2>


      <div class="result-stats">

        <div>
          <span>Importados</span>
          <strong>
            ${result.imported}
          </strong>
        </div>

        <div>
          <span>Erros</span>
          <strong>
            ${result.errors}
          </strong>
        </div>

      </div>


      ${
        errorRows.length

        ? `

          <div class="import-errors">

            <strong>
              Registros não importados
            </strong>

            ${
              errorRows
                .map(
                  item => `

                    <div class="import-error-row">

                      <span>
                        Linha ${item.row}
                      </span>

                      <strong>
                        ${escapeHTML(
                          item.name
                          ||
                          'Sem nome'
                        )}
                      </strong>

                      <p>
                        ${escapeHTML(
                          item.error
                        )}
                      </p>

                    </div>

                  `
                )
                .join('')
            }

          </div>

        `

        : ''
      }


      <button
        id="finishImportButton"
        class="primary-action-button"
        type="button"
      >
        Concluir
      </button>

    </div>

  `;


  document
    .getElementById(
      'finishImportButton'
    )
    ?.addEventListener(
      'click',
      finishImport
    );

}


async function finishImport() {

  closeImportModal();

  await loadNewEmployeesPage();

}


// ============================================================
// LISTAR COLABORADORES AGUARDANDO
// ============================================================

async function loadWaitingEmployees() {

  const container =
    document.getElementById(
      'waitingEmployees'
    );


  if (!container) {
    return;
  }


  const {
    data,
    error
  } =
    await journeySupabase
      .from(
        'employments'
      )
      .select(`
        id,
        admission_date,
        work_schedule,
        status,
        leader_id,

        people (
          id,
          full_name,
          cpf,
          email,
          phone
        ),

        bpos (
          id,
          name
        ),

        operations (
          id,
          name,
          regional_id,

          regionals (
            id,
            name
          )
        ),

        leader:profiles!employments_leader_id_fkey (
          id,
          full_name
        )
      `)
      .eq(
        'status',
        'WAITING'
      )
      .order(
        'admission_date',
        {
          ascending: false
        }
      );


  if (error) {

    console.error(error);


    container.innerHTML = `

      <div class="system-error">

        <p>
          ${escapeHTML(
            error.message
          )}
        </p>

      </div>

    `;

    return;

  }


  if (
    !data ||
    data.length === 0
  ) {

    container.innerHTML = `

      <div class="empty-state">

        <div class="empty-icon">
          +
        </div>

        <strong>
          Nenhum colaborador aguardando
        </strong>

        <p>
          Importe uma planilha para começar.
        </p>

      </div>

    `;

    return;

  }


  container.innerHTML = `

    <div class="table-wrapper">

      <table class="journey-table">

        <thead>

          <tr>
            <th>Colaborador</th>
            <th>CPF</th>
            <th>Regional</th>
            <th>Operação</th>
            <th>BPO</th>
            <th>Admissão</th>
            <th>Horário / Escala</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>

        </thead>


        <tbody>

          ${
            data
              .map(
                item => `

                  <tr>

                    <td>

                      <strong>
                        ${escapeHTML(
                          item.people
                            ?.full_name
                          ||
                          ''
                        )}
                      </strong>

                      <span class="table-subtext">
                        ${escapeHTML(
                          item.people
                            ?.email
                          ||
                          ''
                        )}
                      </span>

                    </td>


                    <td>
                      ${escapeHTML(
                        formatCPF(
                          item.people?.cpf
                        )
                      )}
                    </td>


                    <td>

                      ${
                        escapeHTML(
                          item.operations
                            ?.regionals
                            ?.name
                          ||
                          'Sem Regional'
                        )
                      }

                    </td>


                    <td>
                      ${escapeHTML(
                        item.operations
                          ?.name
                        ||
                        '-'
                      )}
                    </td>


                    <td>
                      ${escapeHTML(
                        item.bpos
                          ?.name
                        ||
                        '-'
                      )}
                    </td>


                    <td>
                      ${escapeHTML(
                        formatDateBR(
                          item.admission_date
                        )
                      )}
                    </td>


                    <td>
                      ${escapeHTML(
                        item.work_schedule
                        ||
                        '-'
                      )}
                    </td>


                    <td>

                      <span class="status-pill waiting">
                        Aguardando início
                      </span>

                    </td>


                    <td>

                      <button
                        class="danger-text-button delete-waiting-employee"
                        type="button"
                        data-employment-id="${item.id}"
                        data-employee-name="${escapeHTML(
                          item.people?.full_name || ''
                        )}"
                      >
                        Excluir
                      </button>

                    </td>

                  </tr>

                `
              )
              .join('')
          }

        </tbody>

      </table>

    </div>

  `;


  container
    .querySelectorAll(
      '.delete-waiting-employee'
    )
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () => {

            deleteEmployee(
              button.dataset.employmentId,
              button.dataset.employeeName
            );

          }
        );

      }
    );

}


// ============================================================
// EXCLUIR COLABORADOR
// ============================================================

async function deleteEmployee(
  employmentId,
  employeeName
) {

  if (
    currentProfile.role !==
    'ADMIN_RH'
  ) {
    return;
  }


  const confirmed =
    confirm(
      `Excluir definitivamente ${employeeName}?\n\n` +
      `Esta ação poderá remover jornada, avaliações, respostas e acesso do colaborador.\n\n` +
      `A ação não pode ser desfeita.`
    );


  if (!confirmed) {
    return;
  }


  try {

    const {
      data,
      error
    } =
      await journeySupabase
        .functions
        .invoke(
          'delete-employee',
          {
            body: {
              employmentId
            }
          }
        );


    if (error) {

      throw new Error(
        await readEdgeFunctionError(
          error,
          'Erro ao excluir colaborador.'
        )
      );

    }


    if (
      !data?.success
    ) {

      throw new Error(
        data?.error
        ||
        'Não foi possível excluir o colaborador.'
      );

    }


    alert(
      `${employeeName} foi excluído com sucesso.`
    );


    await loadWaitingEmployees();

  }

  catch (error) {

    console.error(error);

    alert(
      error.message
      ||
      'Erro ao excluir colaborador.'
    );

  }

}


// ============================================================
// CONFIGURAÇÕES - HOME
// ============================================================

async function loadSettingsHome() {

  if (
    currentProfile.role !==
    'ADMIN_RH'
  ) {

    await loadDashboard();
    return;

  }


  try {

    const [
      regionalsResult,
      operationsResult,
      usersResult,
      checkpointsResult
    ] =
      await Promise.all([

        journeySupabase
          .from('regionals')
          .select(
            'id',
            {
              count: 'exact',
              head: true
            }
          ),

        journeySupabase
          .from('operations')
          .select(
            'id',
            {
              count: 'exact',
              head: true
            }
          ),

        journeySupabase
          .from('profiles')
          .select(
            'id',
            {
              count: 'exact',
              head: true
            }
          )
          .in(
            'role',
            [
              'LEADER',
              'HR_MANAGER'
            ]
          ),

        journeySupabase
          .from('checkpoint_rules')
          .select(
            'checkpoint',
            {
              count: 'exact',
              head: true
            }
          )

      ]);


    pageContent.innerHTML = `

      <div class="module-header">

        <div>

          <h2>
            Configurações
          </h2>

          <p>
            Gerencie a estrutura e os acessos
            do Shopee Journey.
          </p>

        </div>

      </div>


      <div
        id="settingsHomeGrid"
        class="settings-home-grid"
      >


        <button
          class="settings-home-card"
          type="button"
          data-settings-action="regionals"
        >

          <div class="settings-home-icon">
            🌎
          </div>

          <div>

            <strong>
              Regionais
            </strong>

            <span>
              ${regionalsResult.count || 0}
              cadastradas
            </span>

          </div>

          <b>
            Gerenciar →
          </b>

        </button>


        <button
          class="settings-home-card"
          type="button"
          data-settings-action="operations"
        >

          <div class="settings-home-icon">
            📍
          </div>

          <div>

            <strong>
              Operações / HUBs
            </strong>

            <span>
              ${operationsResult.count || 0}
              cadastradas
            </span>

          </div>

          <b>
            Gerenciar →
          </b>

        </button>


        <button
          class="settings-home-card"
          type="button"
          data-settings-action="corporate-users"
        >

          <div class="settings-home-icon">
            👥
          </div>

          <div>

            <strong>
              Acessos Corporativos
            </strong>

            <span>
              ${usersResult.count || 0}
              cadastrados
            </span>

          </div>

          <b>
            Gerenciar →
          </b>

        </button>


        <button
          class="settings-home-card"
          type="button"
          data-settings-action="checkpoints"
        >

          <div class="settings-home-icon">
            ⚙️
          </div>

          <div>

            <strong>
              Checkpoints
            </strong>

            <span>
              ${checkpointsResult.count || 0}
              configurados
            </span>

          </div>

          <b>
            Gerenciar →
          </b>

        </button>


      </div>

    `;


    document
      .getElementById(
        'settingsHomeGrid'
      )
      ?.addEventListener(
        'click',
        async event => {

          const card =
            event.target.closest(
              '[data-settings-action]'
            );


          if (!card) {
            return;
          }


          const action =
            card.dataset.settingsAction;


          switch (action) {

            case 'regionals':

              await loadRegionalsManager();

              break;


            case 'operations':

              await loadOperationsManager();

              break;


            case 'corporate-users':

              await loadCorporateUsersManager();

              break;


            case 'checkpoints':

              openCheckpointSettings();

              break;

          }

        }
      );

  }

  catch (error) {

    console.error(
      'Erro ao carregar Configurações:',
      error
    );


    pageContent.innerHTML = `

      <div class="system-error">

        <h2>
          Erro ao carregar Configurações
        </h2>

        <p>
          ${escapeHTML(error.message)}
        </p>

      </div>

    `;

  }

}


// ============================================================
// CONFIGURAÇÕES - REGIONAIS
// ============================================================

async function loadRegionalsManager() {

  const {
    data,
    error
  } =
    await journeySupabase
      .from('regionals')
      .select(`
        id,
        name,
        active
      `)
      .order(
        'name'
      );


  if (error) {

    alert(
      error.message
    );

    return;

  }


  regionalsCache =
    data || [];


  regionalCurrentPage =
    1;


  pageContent.innerHTML = `

    <div class="settings-manager-header">

      <button
        id="backFromRegionals"
        class="back-button"
        type="button"
      >
        ← Voltar
      </button>


      <div>

        <h2>
          Regionais
        </h2>

        <p>
          Organize as operações por Regional.
        </p>

      </div>

    </div>


    <section class="dashboard-panel">


      <form
        id="regionalCreateForm"
        class="compact-create-form"
      >

        <input
          id="newRegionalName"
          type="text"
          placeholder="Ex.: REGIONAL NORTE"
          required
        >

        <button
          class="primary-action-button"
          type="submit"
        >
          + Nova Regional
        </button>

      </form>


      <div class="settings-toolbar">

        <input
          id="regionalSearch"
          type="search"
          placeholder="Buscar Regional..."
        >

      </div>


      <div id="regionalManagerList"></div>

    </section>

  `;


  document
    .getElementById(
      'backFromRegionals'
    )
    ?.addEventListener(
      'click',
      loadSettingsHome
    );


  document
    .getElementById(
      'regionalCreateForm'
    )
    ?.addEventListener(
      'submit',
      createRegional
    );


  document
    .getElementById(
      'regionalSearch'
    )
    ?.addEventListener(
      'input',
      () => {

        regionalCurrentPage =
          1;

        renderRegionalsManager();

      }
    );


  renderRegionalsManager();

}


function renderRegionalsManager() {

  const container =
    document.getElementById(
      'regionalManagerList'
    );


  if (!container) {
    return;
  }


  const search =
    (
      document
        .getElementById(
          'regionalSearch'
        )
        ?.value
      ||
      ''
    )
      .trim()
      .toLowerCase();


  const filtered =
    regionalsCache.filter(
      regional =>

        !search
        ||
        regional.name
          .toLowerCase()
          .includes(search)

    );


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filtered.length
        /
        SETTINGS_PAGE_SIZE
      )
    );


  if (
    regionalCurrentPage >
    totalPages
  ) {

    regionalCurrentPage =
      totalPages;

  }


  const start =
    (
      regionalCurrentPage - 1
    )
    *
    SETTINGS_PAGE_SIZE;


  const pageRows =
    filtered.slice(
      start,
      start + SETTINGS_PAGE_SIZE
    );


  if (!pageRows.length) {

    container.innerHTML = `

      <div class="empty-state">

        <strong>
          Nenhuma Regional encontrada
        </strong>

      </div>

    `;

    return;

  }


  container.innerHTML = `

    <div class="compact-settings-list">

      ${
        pageRows
          .map(
            regional => `

              <div class="compact-settings-row">

                <div>

                  <strong>
                    ${escapeHTML(
                      regional.name
                    )}
                  </strong>

                  <span>
                    ${
                      regional.active
                        ? 'Ativa'
                        : 'Inativa'
                    }
                  </span>

                </div>


                <div class="row-actions">

                  <button
                    class="regional-edit"
                    type="button"
                    data-id="${regional.id}"
                  >
                    Editar
                  </button>


                  <button
                    class="regional-toggle"
                    type="button"
                    data-id="${regional.id}"
                    data-active="${regional.active}"
                  >
                    ${
                      regional.active
                        ? 'Inativar'
                        : 'Ativar'
                    }
                  </button>


                  <button
                    class="danger-action regional-delete"
                    type="button"
                    data-id="${regional.id}"
                    data-name="${escapeHTML(
                      regional.name
                    )}"
                  >
                    Excluir
                  </button>

                </div>

              </div>

            `
          )
          .join('')
      }

    </div>


    ${renderPaginationHTML(
      regionalCurrentPage,
      totalPages,
      'regional-pagination'
    )}

  `;


  container
    .querySelectorAll(
      '.regional-edit'
    )
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () => {

            editRegional(
              button.dataset.id
            );

          }
        );

      }
    );


  container
    .querySelectorAll(
      '.regional-toggle'
    )
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () => {

            toggleRegional(
              button.dataset.id,
              button.dataset.active
              !== 'true'
            );

          }
        );

      }
    );


  container
    .querySelectorAll(
      '.regional-delete'
    )
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () => {

            deleteRegional(
              button.dataset.id,
              button.dataset.name
            );

          }
        );

      }
    );


  bindPagination(
    container,
    'regional-pagination',
    page => {

      regionalCurrentPage =
        page;

      renderRegionalsManager();

    }
  );

}


async function createRegional(event) {

  event.preventDefault();


  const input =
    document.getElementById(
      'newRegionalName'
    );


  const name =
    input.value
      .trim()
      .toUpperCase();


  if (!name) {
    return;
  }


  const {
    error
  } =
    await journeySupabase
      .from('regionals')
      .insert({
        name
      });


  if (error) {

    alert(
      error.code === '23505'
        ? 'Esta Regional já existe.'
        : error.message
    );

    return;

  }


  await loadRegionalsManager();

}


async function editRegional(id) {

  const regional =
    regionalsCache.find(
      item =>
        item.id === id
    );


  if (!regional) {
    return;
  }


  const newName =
    prompt(
      'Novo nome da Regional:',
      regional.name
    );


  if (
    !newName ||
    !newName.trim()
  ) {
    return;
  }


  const {
    error
  } =
    await journeySupabase
      .from('regionals')
      .update({

        name:
          newName
            .trim()
            .toUpperCase(),

        updated_at:
          new Date()
            .toISOString()

      })
      .eq(
        'id',
        id
      );


  if (error) {

    alert(
      error.message
    );

    return;

  }


  await loadRegionalsManager();

}


async function toggleRegional(
  id,
  active
) {

  const {
    error
  } =
    await journeySupabase
      .from('regionals')
      .update({

        active,

        updated_at:
          new Date()
            .toISOString()

      })
      .eq(
        'id',
        id
      );


  if (error) {

    alert(
      error.message
    );

    return;

  }


  await loadRegionalsManager();

}


async function deleteRegional(
  id,
  name
) {

  if (
    !confirm(
      `Excluir a Regional ${name}?`
    )
  ) {
    return;
  }


  const {
    error
  } =
    await journeySupabase
      .from('regionals')
      .delete()
      .eq(
        'id',
        id
      );


  if (error) {

    alert(
      'Não é possível excluir uma Regional que possui operações vinculadas. Use Inativar.'
    );

    return;

  }


  await loadRegionalsManager();

}


// ============================================================
// CONFIGURAÇÕES - OPERAÇÕES
// ============================================================

async function loadOperationsManager() {

  const [
    operationsResult,
    regionalsResult
  ] =
    await Promise.all([

      journeySupabase
        .from('operations')
        .select(`
          id,
          name,
          active,
          regional_id,

          regionals (
            id,
            name
          )
        `)
        .order('name'),

      journeySupabase
        .from('regionals')
        .select(`
          id,
          name,
          active
        `)
        .order('name')

    ]);


  if (
    operationsResult.error
    ||
    regionalsResult.error
  ) {

    alert(
      operationsResult.error?.message
      ||
      regionalsResult.error?.message
    );

    return;

  }


  operationsCache =
    operationsResult.data
    ||
    [];


  operationRegionalsCache =
    regionalsResult.data
    ||
    [];


  operationCurrentPage =
    1;


  pageContent.innerHTML = `

    <div class="settings-manager-header">

      <button
        id="backFromOperations"
        class="back-button"
        type="button"
      >
        ← Voltar
      </button>


      <div>

        <h2>
          Operações / HUBs
        </h2>

        <p>
          Organize as operações dentro
          de suas Regionais.
        </p>

      </div>

    </div>


    <section class="dashboard-panel">


      <form
        id="operationCreateForm"
        class="compact-create-form operation-create-form"
      >

        <select
          id="newOperationRegional"
          required
        >

          <option value="">
            Selecione a Regional
          </option>

          ${
            operationRegionalsCache
              .filter(
                regional =>
                  regional.active
              )
              .map(
                regional => `

                  <option
                    value="${regional.id}"
                  >
                    ${escapeHTML(
                      regional.name
                    )}
                  </option>

                `
              )
              .join('')
          }

        </select>


        <input
          id="newOperationName"
          type="text"
          placeholder="Ex.: HUB-LPA-03"
          required
        >


        <button
          class="primary-action-button"
          type="submit"
        >
          + Nova Operação
        </button>

      </form>


      <div class="settings-toolbar">


        <input
          id="operationSearch"
          type="search"
          placeholder="Buscar operação..."
        >


        <select
          id="operationRegionalFilter"
        >

          <option value="">
            Todas as Regionais
          </option>

          ${
            operationRegionalsCache
              .map(
                regional => `

                  <option
                    value="${regional.id}"
                  >
                    ${escapeHTML(
                      regional.name
                    )}
                  </option>

                `
              )
              .join('')
          }

        </select>

      </div>


      <div id="operationsManagerList"></div>

    </section>

  `;


  document
    .getElementById(
      'backFromOperations'
    )
    ?.addEventListener(
      'click',
      loadSettingsHome
    );


  document
    .getElementById(
      'operationCreateForm'
    )
    ?.addEventListener(
      'submit',
      createOperationWithRegional
    );


  document
    .getElementById(
      'operationSearch'
    )
    ?.addEventListener(
      'input',
      () => {

        operationCurrentPage =
          1;

        renderOperationsManager();

      }
    );


  document
    .getElementById(
      'operationRegionalFilter'
    )
    ?.addEventListener(
      'change',
      () => {

        operationCurrentPage =
          1;

        renderOperationsManager();

      }
    );


  renderOperationsManager();

}


function renderOperationsManager() {

  const container =
    document.getElementById(
      'operationsManagerList'
    );


  if (!container) {
    return;
  }


  const search =
    (
      document
        .getElementById(
          'operationSearch'
        )
        ?.value
      ||
      ''
    )
      .trim()
      .toLowerCase();


  const regional =
    document
      .getElementById(
        'operationRegionalFilter'
      )
      ?.value
    ||
    '';


  const filtered =
    operationsCache.filter(
      operation => {

        const searchOk =
          !search
          ||
          operation.name
            .toLowerCase()
            .includes(search);


        const regionalOk =
          !regional
          ||
          operation.regional_id ===
          regional;


        return (
          searchOk
          &&
          regionalOk
        );

      }
    );


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filtered.length
        /
        SETTINGS_PAGE_SIZE
      )
    );


  if (
    operationCurrentPage >
    totalPages
  ) {

    operationCurrentPage =
      totalPages;

  }


  const start =
    (
      operationCurrentPage - 1
    )
    *
    SETTINGS_PAGE_SIZE;


  const pageRows =
    filtered.slice(
      start,
      start + SETTINGS_PAGE_SIZE
    );


  container.innerHTML = `

    <div class="table-wrapper">

      <table class="journey-table">

        <thead>

          <tr>
            <th>Regional</th>
            <th>Operação</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>

        </thead>


        <tbody>

          ${
            pageRows.length

            ? pageRows
                .map(
                  operation => `

                    <tr>

                      <td>

                        ${
                          operation.regionals?.name

                          ? escapeHTML(
                              operation.regionals.name
                            )

                          : `

                              <span class="status-pill warning">
                                Sem Regional
                              </span>

                            `
                        }

                      </td>


                      <td>

                        <strong>
                          ${escapeHTML(
                            operation.name
                          )}
                        </strong>

                      </td>


                      <td>

                        <span
                          class="status-pill ${
                            operation.active
                              ? 'success'
                              : 'error'
                          }"
                        >
                          ${
                            operation.active
                              ? 'Ativa'
                              : 'Inativa'
                          }
                        </span>

                      </td>


                      <td>

                        <div class="row-actions">

                          <button
                            class="operation-edit"
                            type="button"
                            data-id="${operation.id}"
                          >
                            Editar
                          </button>


                          <button
                            class="operation-toggle"
                            type="button"
                            data-id="${operation.id}"
                            data-active="${operation.active}"
                          >
                            ${
                              operation.active
                                ? 'Inativar'
                                : 'Ativar'
                            }
                          </button>


                          <button
                            class="danger-action operation-delete"
                            type="button"
                            data-id="${operation.id}"
                            data-name="${escapeHTML(
                              operation.name
                            )}"
                          >
                            Excluir
                          </button>

                        </div>

                      </td>

                    </tr>

                  `
                )
                .join('')

            : `

                <tr>
                  <td colspan="4">
                    Nenhuma operação encontrada.
                  </td>
                </tr>

              `
          }

        </tbody>

      </table>

    </div>


    ${renderPaginationHTML(
      operationCurrentPage,
      totalPages,
      'operation-pagination'
    )}

  `;


  container
    .querySelectorAll(
      '.operation-edit'
    )
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () => {

            openOperationEditModal(
              button.dataset.id
            );

          }
        );

      }
    );


  container
    .querySelectorAll(
      '.operation-toggle'
    )
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () => {

            toggleOperationStatus(
              button.dataset.id,
              button.dataset.active
              !== 'true'
            );

          }
        );

      }
    );


  container
    .querySelectorAll(
      '.operation-delete'
    )
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () => {

            deleteOperationRecord(
              button.dataset.id,
              button.dataset.name
            );

          }
        );

      }
    );


  bindPagination(
    container,
    'operation-pagination',
    page => {

      operationCurrentPage =
        page;

      renderOperationsManager();

    }
  );

}


async function createOperationWithRegional(
  event
) {

  event.preventDefault();


  const regionalId =
    document
      .getElementById(
        'newOperationRegional'
      )
      .value;


  const name =
    document
      .getElementById(
        'newOperationName'
      )
      .value
      .trim()
      .toUpperCase();


  if (
    !regionalId ||
    !name
  ) {
    return;
  }


  const {
    error
  } =
    await journeySupabase
      .from('operations')
      .insert({

        name,

        regional_id:
          regionalId,

        active:
          true

      });


  if (error) {

    alert(
      error.code === '23505'
        ? 'Esta operação já existe.'
        : error.message
    );

    return;

  }


  await loadOperationsManager();

}


function openOperationEditModal(id) {

  const operation =
    operationsCache.find(
      item =>
        item.id === id
    );


  if (!operation) {
    return;
  }


  openGenericModal(`

    <div class="modal-header">

      <div>
        <h2>Editar Operação</h2>
        <p>Atualize a Regional e o código do HUB.</p>
      </div>

      <button
        id="closeGenericModalButton"
        class="modal-close"
        type="button"
      >
        ×
      </button>

    </div>


    <form
      id="editOperationForm"
      style="padding: 24px;"
    >

      <div class="form-group">

        <label>
          Regional
        </label>

        <select
          id="editOperationRegional"
          required
        >

          ${
            operationRegionalsCache
              .map(
                regional => `

                  <option
                    value="${regional.id}"
                    ${
                      operation.regional_id ===
                      regional.id
                        ? 'selected'
                        : ''
                    }
                  >
                    ${escapeHTML(
                      regional.name
                    )}
                  </option>

                `
              )
              .join('')
          }

        </select>

      </div>


      <div class="form-group">

        <label>
          Operação / HUB
        </label>

        <input
          id="editOperationName"
          type="text"
          value="${escapeHTML(
            operation.name
          )}"
          required
        >

      </div>


      <button
        class="primary-action-button full-button"
        type="submit"
      >
        Salvar alterações
      </button>

    </form>

  `);


  document
    .getElementById(
      'editOperationForm'
    )
    ?.addEventListener(
      'submit',
      async event => {

        event.preventDefault();


        const regionalId =
          document
            .getElementById(
              'editOperationRegional'
            )
            .value;


        const name =
          document
            .getElementById(
              'editOperationName'
            )
            .value
            .trim()
            .toUpperCase();


        const {
          error
        } =
          await journeySupabase
            .from('operations')
            .update({

              name,

              regional_id:
                regionalId

            })
            .eq(
              'id',
              id
            );


        if (error) {

          alert(
            error.message
          );

          return;

        }


        closeGenericModal();

        await loadOperationsManager();

      }
    );

}


async function toggleOperationStatus(
  id,
  active
) {

  const {
    error
  } =
    await journeySupabase
      .from('operations')
      .update({
        active
      })
      .eq(
        'id',
        id
      );


  if (error) {

    alert(
      error.message
    );

    return;

  }


  await loadOperationsManager();

}


async function deleteOperationRecord(
  id,
  name
) {

  if (
    !confirm(
      `Excluir a operação ${name}?`
    )
  ) {
    return;
  }


  const {
    error
  } =
    await journeySupabase
      .from('operations')
      .delete()
      .eq(
        'id',
        id
      );


  if (error) {

    alert(
      'Esta operação já possui vínculos. Use Inativar para preservar o histórico.'
    );

    return;

  }


  await loadOperationsManager();

}


// ============================================================
// CONFIGURAÇÕES - ACESSOS CORPORATIVOS
// ============================================================

async function loadCorporateUsersManager() {

  pageContent.innerHTML = `

    <div class="settings-manager-header">

      <button
        id="backFromCorporateUsers"
        class="back-button"
        type="button"
      >
        ← Voltar
      </button>


      <div>

        <h2>
          Acessos Corporativos
        </h2>

        <p>
          Lideranças e Gestores de RH.
        </p>

      </div>


      <button
        id="newCorporateUserButton"
        class="primary-action-button"
        type="button"
        style="margin-left:auto;"
      >
        + Novo acesso
      </button>

    </div>


    <section class="dashboard-panel">


      <div class="settings-toolbar">

        <input
          id="corporateUserSearch"
          type="search"
          placeholder="Buscar por nome ou e-mail..."
        >


        <select
          id="corporateRoleFilter"
        >

          <option value="">
            Todos os perfis
          </option>

          <option value="LEADER">
            Liderança
          </option>

          <option value="HR_MANAGER">
            Gestor de RH
          </option>

        </select>


        <select
          id="corporateRegionalFilter"
        >
          <option value="">
            Todas as Regionais
          </option>
        </select>


        <select
          id="corporateOperationFilter"
        >
          <option value="">
            Todas as Operações
          </option>
        </select>

      </div>


      <div id="corporateUsersManagerList">

        <div class="page-loading">
          Carregando acessos...
        </div>

      </div>

    </section>

  `;


  document
    .getElementById(
      'backFromCorporateUsers'
    )
    ?.addEventListener(
      'click',
      loadSettingsHome
    );


  document
    .getElementById(
      'newCorporateUserButton'
    )
    ?.addEventListener(
      'click',
      openCorporateUserCreateModal
    );


  document
    .getElementById(
      'corporateUserSearch'
    )
    ?.addEventListener(
      'input',
      () => {

        corporateCurrentPage =
          1;

        renderCorporateUsersManager();

      }
    );


  document
    .getElementById(
      'corporateRoleFilter'
    )
    ?.addEventListener(
      'change',
      () => {

        corporateCurrentPage =
          1;

        renderCorporateUsersManager();

      }
    );


  document
    .getElementById(
      'corporateRegionalFilter'
    )
    ?.addEventListener(
      'change',
      () => {

        corporateCurrentPage =
          1;

        updateCorporateOperationFilter();

        renderCorporateUsersManager();

      }
    );


  document
    .getElementById(
      'corporateOperationFilter'
    )
    ?.addEventListener(
      'change',
      () => {

        corporateCurrentPage =
          1;

        renderCorporateUsersManager();

      }
    );


  await fetchCorporateUsersManager();

}


async function fetchCorporateUsersManager() {

  const [
    usersResult,
    operationsResult
  ] =
    await Promise.all([

      journeySupabase
        .from('profiles')
        .select(`
          id,
          full_name,
          role,
          corporate_email,
          active,

          leader_operations (
            operation_id,

            operations (
              id,
              name,
              regional_id,

              regionals (
                id,
                name
              )
            )
          )
        `)
        .in(
          'role',
          [
            'LEADER',
            'HR_MANAGER'
          ]
        )
        .order(
          'full_name'
        ),


      journeySupabase
        .from('operations')
        .select(`
          id,
          name,
          active,
          regional_id,

          regionals (
            id,
            name,
            active
          )
        `)
        .order(
          'name'
        )

    ]);


  if (
    usersResult.error
    ||
    operationsResult.error
  ) {

    const container =
      document.getElementById(
        'corporateUsersManagerList'
      );


    if (container) {

      container.innerHTML = `

        <div class="system-error">

          <p>
            ${escapeHTML(
              usersResult.error?.message
              ||
              operationsResult.error?.message
            )}
          </p>

        </div>

      `;

    }

    return;

  }


  corporateUsersCache =
    usersResult.data
    ||
    [];


  corporateOperationsCache =
    operationsResult.data
    ||
    [];


  corporateCurrentPage =
    1;


  populateCorporateRegionalFilter();

  updateCorporateOperationFilter();

  renderCorporateUsersManager();

}


function populateCorporateRegionalFilter() {

  const select =
    document.getElementById(
      'corporateRegionalFilter'
    );


  if (!select) {
    return;
  }


  const regionals =
    [
      ...new Map(
        corporateOperationsCache
          .filter(
            operation =>
              operation.regionals
          )
          .map(
            operation => [

              operation.regionals.id,

              operation.regionals

            ]
          )
      )
      .values()
    ];


  select.innerHTML = `

    <option value="">
      Todas as Regionais
    </option>

    ${
      regionals
        .map(
          regional => `

            <option value="${regional.id}">
              ${escapeHTML(
                regional.name
              )}
            </option>

          `
        )
        .join('')
    }

  `;

}


function updateCorporateOperationFilter() {

  const regionalSelect =
    document.getElementById(
      'corporateRegionalFilter'
    );


  const operationSelect =
    document.getElementById(
      'corporateOperationFilter'
    );


  if (
    !regionalSelect
    ||
    !operationSelect
  ) {
    return;
  }


  const regionalId =
    regionalSelect.value;


  const operations =
    corporateOperationsCache
      .filter(
        operation =>

          !regionalId
          ||
          operation.regional_id ===
          regionalId

      );


  operationSelect.innerHTML = `

    <option value="">
      Todas as Operações
    </option>

    ${
      operations
        .map(
          operation => `

            <option value="${operation.id}">
              ${escapeHTML(
                operation.name
              )}
            </option>

          `
        )
        .join('')
    }

  `;

}


function renderCorporateUsersManager() {

  const container =
    document.getElementById(
      'corporateUsersManagerList'
    );


  if (!container) {
    return;
  }


  const search =
    (
      document
        .getElementById(
          'corporateUserSearch'
        )
        ?.value
      ||
      ''
    )
      .trim()
      .toLowerCase();


  const role =
    document
      .getElementById(
        'corporateRoleFilter'
      )
      ?.value
    ||
    '';


  const regionalId =
    document
      .getElementById(
        'corporateRegionalFilter'
      )
      ?.value
    ||
    '';


  const operationId =
    document
      .getElementById(
        'corporateOperationFilter'
      )
      ?.value
    ||
    '';


  const filtered =
    corporateUsersCache.filter(
      user => {

        const links =
          user.leader_operations
          ||
          [];


        const searchOk =
          !search
          ||
          user.full_name
            ?.toLowerCase()
            .includes(search)
          ||
          user.corporate_email
            ?.toLowerCase()
            .includes(search);


        const roleOk =
          !role
          ||
          user.role ===
          role;


        let regionalOk =
          true;


        let operationOk =
          true;


        if (
          user.role ===
          'LEADER'
        ) {

          regionalOk =
            !regionalId
            ||
            links.some(
              link =>
                link.operations
                  ?.regional_id ===
                regionalId
            );


          operationOk =
            !operationId
            ||
            links.some(
              link =>
                link.operation_id ===
                operationId
            );

        }

        else {

          regionalOk =
            !regionalId;

          operationOk =
            !operationId;

        }


        return (
          searchOk
          &&
          roleOk
          &&
          regionalOk
          &&
          operationOk
        );

      }
    );


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filtered.length
        /
        SETTINGS_PAGE_SIZE
      )
    );


  if (
    corporateCurrentPage >
    totalPages
  ) {

    corporateCurrentPage =
      totalPages;

  }


  const start =
    (
      corporateCurrentPage - 1
    )
    *
    SETTINGS_PAGE_SIZE;


  const pageRows =
    filtered.slice(
      start,
      start + SETTINGS_PAGE_SIZE
    );


  container.innerHTML = `

    <div class="table-wrapper">

      <table class="journey-table">

        <thead>

          <tr>
            <th>Usuário</th>
            <th>Perfil</th>
            <th>Regional</th>
            <th>Operações</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>

        </thead>


        <tbody>

          ${
            pageRows.length

            ? pageRows
                .map(
                  user => {

                    const links =
                      user.leader_operations
                      ||
                      [];


                    const operations =
                      links
                        .map(
                          link =>
                            link.operations
                              ?.name
                        )
                        .filter(Boolean);


                    const regionals =
                      [
                        ...new Set(
                          links
                            .map(
                              link =>
                                link.operations
                                  ?.regionals
                                  ?.name
                            )
                            .filter(Boolean)
                        )
                      ];


                    return `

                      <tr>

                        <td>

                          <strong>
                            ${escapeHTML(
                              user.full_name
                            )}
                          </strong>

                          <span class="table-subtext">
                            ${escapeHTML(
                              user.corporate_email
                              ||
                              ''
                            )}
                          </span>

                        </td>


                        <td>

                          <span class="status-pill waiting">

                            ${
                              user.role ===
                              'LEADER'
                                ? 'Liderança'
                                : 'Gestor de RH'
                            }

                          </span>

                        </td>


                        <td>

                          ${
                            user.role ===
                            'HR_MANAGER'

                            ? 'Visão geral'

                            : (
                                regionals.length
                                  ? escapeHTML(
                                      regionals.join(', ')
                                    )
                                  : '-'
                              )
                          }

                        </td>


                        <td>

                          ${
                            user.role ===
                            'HR_MANAGER'

                            ? 'Todas'

                            : (
                                operations.length
                                  ? escapeHTML(
                                      operations.join(', ')
                                    )
                                  : '-'
                              )
                          }

                        </td>


                        <td>

                          <span
                            class="status-pill ${
                              user.active
                                ? 'success'
                                : 'error'
                            }"
                          >

                            ${
                              user.active
                                ? 'Ativo'
                                : 'Inativo'
                            }

                          </span>

                        </td>


                        <td>

                          <div class="row-actions">

                            <button
                              class="corporate-edit"
                              type="button"
                              data-id="${user.id}"
                            >
                              Editar
                            </button>


                            <button
                              class="corporate-toggle"
                              type="button"
                              data-id="${user.id}"
                              data-active="${user.active}"
                            >
                              ${
                                user.active
                                  ? 'Inativar'
                                  : 'Ativar'
                              }
                            </button>

                          </div>

                        </td>

                      </tr>

                    `;

                  }
                )
                .join('')

            : `

                <tr>
                  <td colspan="6">
                    Nenhum acesso encontrado.
                  </td>
                </tr>

              `
          }

        </tbody>

      </table>

    </div>


    ${renderPaginationHTML(
      corporateCurrentPage,
      totalPages,
      'corporate-pagination'
    )}

  `;


  container
    .querySelectorAll(
      '.corporate-edit'
    )
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () => {

            openCorporateUserEditModal(
              button.dataset.id
            );

          }
        );

      }
    );


  container
    .querySelectorAll(
      '.corporate-toggle'
    )
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () => {

            toggleCorporateUserStatus(
              button.dataset.id,
              button.dataset.active
              !== 'true'
            );

          }
        );

      }
    );


  bindPagination(
    container,
    'corporate-pagination',
    page => {

      corporateCurrentPage =
        page;

      renderCorporateUsersManager();

    }
  );

}


// ============================================================
// NOVO ACESSO CORPORATIVO
// ============================================================

function openCorporateUserCreateModal() {

  const activeOperations =
    corporateOperationsCache
      .filter(
        operation =>
          operation.active
      );


  openGenericModal(`

    <div class="modal-header">

      <div>

        <h2>
          Novo Acesso Corporativo
        </h2>

        <p>
          Cadastre uma Liderança ou Gestor de RH.
        </p>

      </div>

      <button
        id="closeGenericModalButton"
        class="modal-close"
        type="button"
      >
        ×
      </button>

    </div>


    <form
      id="newCorporateUserForm"
      style="padding: 24px;"
    >


      <div class="form-group">

        <label>
          Nome completo
        </label>

        <input
          id="newCorporateName"
          type="text"
          required
        >

      </div>


      <div class="form-group">

        <label>
          E-mail Shopee
        </label>

        <input
          id="newCorporateEmail"
          type="email"
          placeholder="nome@shopee.com"
          required
        >

      </div>


      <div class="form-group">

        <label>
          Perfil
        </label>

        <select
          id="newCorporateRole"
          required
        >

          <option value="">
            Selecione
          </option>

          <option value="LEADER">
            Líder
          </option>

          <option value="HR_MANAGER">
            Gestor de RH
          </option>

        </select>

      </div>


      <div class="form-group">

        <label>
          Senha inicial
        </label>

        <input
          id="newCorporatePassword"
          type="password"
          minlength="8"
          required
        >

      </div>


      <div
        id="newCorporateOperationsField"
        class="form-group hidden"
      >

        <label>
          Operações da liderança
        </label>

        <div class="operations-checkbox-list">

          ${
            activeOperations
              .map(
                operation => `

                  <label class="operation-checkbox">

                    <input
                      type="checkbox"
                      name="newCorporateOperation"
                      value="${operation.id}"
                    >

                    <span>

                      ${
                        escapeHTML(
                          operation.regionals
                            ?.name
                          ||
                          'Sem Regional'
                        )
                      }
                      ·
                      ${
                        escapeHTML(
                          operation.name
                        )
                      }

                    </span>

                  </label>

                `
              )
              .join('')
          }

        </div>

      </div>


      <button
        id="createCorporateUserButton"
        class="primary-action-button full-button"
        type="submit"
      >
        Criar usuário
      </button>

    </form>

  `);


  document
    .getElementById(
      'newCorporateRole'
    )
    ?.addEventListener(
      'change',
      event => {

        document
          .getElementById(
            'newCorporateOperationsField'
          )
          ?.classList
          .toggle(
            'hidden',
            event.target.value !==
            'LEADER'
          );

      }
    );


  document
    .getElementById(
      'newCorporateUserForm'
    )
    ?.addEventListener(
      'submit',
      createCorporateUserFromModal
    );

}


async function createCorporateUserFromModal(
  event
) {

  event.preventDefault();


  const fullName =
    document
      .getElementById(
        'newCorporateName'
      )
      .value
      .trim();


  const email =
    document
      .getElementById(
        'newCorporateEmail'
      )
      .value
      .trim()
      .toLowerCase();


  const role =
    document
      .getElementById(
        'newCorporateRole'
      )
      .value;


  const password =
    document
      .getElementById(
        'newCorporatePassword'
      )
      .value;


  const operationIds =
    Array.from(
      document.querySelectorAll(
        'input[name="newCorporateOperation"]:checked'
      )
    )
      .map(
        item =>
          item.value
      );


  if (
    !email.endsWith(
      '@shopee.com'
    )
  ) {

    alert(
      'Utilize um e-mail corporativo @shopee.com.'
    );

    return;

  }


  if (
    role === 'LEADER'
    &&
    operationIds.length === 0
  ) {

    alert(
      'Selecione pelo menos uma operação para o líder.'
    );

    return;

  }


  const button =
    document.getElementById(
      'createCorporateUserButton'
    );


  button.disabled =
    true;


  button.textContent =
    'Criando usuário...';


  try {

    const {
      data,
      error
    } =
      await journeySupabase
        .functions
        .invoke(
          'create-corporate-user',
          {
            body: {

              fullName,
              email,
              password,
              role,
              operationIds

            }
          }
        );


    if (error) {

      throw new Error(
        await readEdgeFunctionError(
          error,
          'Não foi possível criar o usuário.'
        )
      );

    }


    if (
      !data?.success
    ) {

      throw new Error(
        data?.error
        ||
        'Não foi possível criar o usuário.'
      );

    }


    closeGenericModal();


    alert(
      'Usuário criado com sucesso.'
    );


    await fetchCorporateUsersManager();

  }

  catch (error) {

    console.error(error);

    alert(
      error.message
    );

  }

  finally {

    if (button) {

      button.disabled =
        false;

      button.textContent =
        'Criar usuário';

    }

  }

}


// ============================================================
// EDITAR ACESSO CORPORATIVO
// ============================================================

function openCorporateUserEditModal(
  id
) {

  const user =
    corporateUsersCache.find(
      item =>
        item.id === id
    );


  if (!user) {
    return;
  }


  const selectedOperations =
    new Set(
      (
        user.leader_operations
        ||
        []
      )
        .map(
          link =>
            link.operation_id
        )
    );


  openGenericModal(`

    <div class="modal-header">

      <div>

        <h2>
          Editar Acesso
        </h2>

        <p>
          ${escapeHTML(
            user.corporate_email || ''
          )}
        </p>

      </div>

      <button
        id="closeGenericModalButton"
        class="modal-close"
        type="button"
      >
        ×
      </button>

    </div>


    <form
      id="editCorporateUserForm"
      style="padding:24px;"
    >


      <div class="form-group">

        <label>
          Nome
        </label>

        <input
          id="editCorporateName"
          type="text"
          value="${escapeHTML(
            user.full_name
          )}"
          required
        >

      </div>


      <div class="form-group">

        <label>
          Perfil
        </label>

        <input
          type="text"
          value="${
            user.role === 'LEADER'
              ? 'Liderança'
              : 'Gestor de RH'
          }"
          disabled
        >

      </div>


      ${
        user.role ===
        'LEADER'

        ? `

          <div class="form-group">

            <label>
              Operações
            </label>

            <div class="operations-checkbox-list">

              ${
                corporateOperationsCache
                  .filter(
                    operation =>
                      operation.active
                      ||
                      selectedOperations
                        .has(operation.id)
                  )
                  .map(
                    operation => `

                      <label class="operation-checkbox">

                        <input
                          type="checkbox"
                          name="editCorporateOperation"
                          value="${operation.id}"
                          ${
                            selectedOperations
                              .has(operation.id)
                              ? 'checked'
                              : ''
                          }
                        >

                        <span>

                          ${escapeHTML(
                            operation.regionals
                              ?.name
                            ||
                            'Sem Regional'
                          )}
                          ·
                          ${escapeHTML(
                            operation.name
                          )}

                        </span>

                      </label>

                    `
                  )
                  .join('')
              }

            </div>

          </div>

        `

        : ''
      }


      <button
        class="primary-action-button full-button"
        type="submit"
      >
        Salvar alterações
      </button>

    </form>

  `);


  document
    .getElementById(
      'editCorporateUserForm'
    )
    ?.addEventListener(
      'submit',
      async event => {

        event.preventDefault();


        const name =
          document
            .getElementById(
              'editCorporateName'
            )
            .value
            .trim();


        try {

          const {
            error: profileError
          } =
            await journeySupabase
              .from('profiles')
              .update({
                full_name: name
              })
              .eq(
                'id',
                id
              );


          if (profileError) {
            throw profileError;
          }


          if (
            user.role ===
            'LEADER'
          ) {

            const operationIds =
              Array.from(
                document.querySelectorAll(
                  'input[name="editCorporateOperation"]:checked'
                )
              )
                .map(
                  item =>
                    item.value
                );


            if (!operationIds.length) {

              alert(
                'O líder precisa possuir pelo menos uma operação.'
              );

              return;

            }


            const {
              error: deleteError
            } =
              await journeySupabase
                .from(
                  'leader_operations'
                )
                .delete()
                .eq(
                  'leader_id',
                  id
                );


            if (deleteError) {
              throw deleteError;
            }


            const {
              error: insertError
            } =
              await journeySupabase
                .from(
                  'leader_operations'
                )
                .insert(
                  operationIds.map(
                    operationId => ({

                      leader_id:
                        id,

                      operation_id:
                        operationId

                    })
                  )
                );


            if (insertError) {
              throw insertError;
            }

          }


          closeGenericModal();


          await fetchCorporateUsersManager();

        }

        catch (error) {

          console.error(error);

          alert(
            error.message
          );

        }

      }
    );

}


async function toggleCorporateUserStatus(
  id,
  active
) {

  const {
    error
  } =
    await journeySupabase
      .from('profiles')
      .update({
        active
      })
      .eq(
        'id',
        id
      );


  if (error) {

    alert(
      error.message
    );

    return;

  }


  await fetchCorporateUsersManager();

}


// ============================================================
// CHECKPOINTS
// ============================================================

function openCheckpointSettings() {

  alert(
    'Configuração dos checkpoints será a próxima etapa.'
  );

}


// ============================================================
// MODAL GENÉRICO
// ============================================================

function openGenericModal(content) {

  closeGenericModal();


  const wrapper =
    document.createElement(
      'div'
    );


  wrapper.id =
    'genericModalOverlay';


  wrapper.className =
    'modal-overlay';


  wrapper.innerHTML = `

    <div class="import-modal">
      ${content}
    </div>

  `;


  document.body
    .appendChild(
      wrapper
    );


  document
    .getElementById(
      'closeGenericModalButton'
    )
    ?.addEventListener(
      'click',
      closeGenericModal
    );


  wrapper.addEventListener(
    'click',
    event => {

      if (
        event.target ===
        wrapper
      ) {

        closeGenericModal();

      }

    }
  );

}


function closeGenericModal() {

  document
    .getElementById(
      'genericModalOverlay'
    )
    ?.remove();

}


// ============================================================
// PAGINAÇÃO
// ============================================================

function renderPaginationHTML(
  currentPage,
  totalPages,
  className
) {

  if (
    totalPages <= 1
  ) {
    return '';
  }


  return `

    <div
      class="settings-pagination ${className}"
      style="
        display:flex;
        align-items:center;
        justify-content:flex-end;
        gap:6px;
        margin-top:16px;
      "
    >

      <button
        type="button"
        data-page="${
          Math.max(
            1,
            currentPage - 1
          )
        }"
        ${
          currentPage === 1
            ? 'disabled'
            : ''
        }
      >
        ‹
      </button>


      <span
        style="
          font-size:10px;
          color:var(--text-secondary);
        "
      >
        Página ${currentPage}
        de ${totalPages}
      </span>


      <button
        type="button"
        data-page="${
          Math.min(
            totalPages,
            currentPage + 1
          )
        }"
        ${
          currentPage === totalPages
            ? 'disabled'
            : ''
        }
      >
        ›
      </button>

    </div>

  `;

}


function bindPagination(
  container,
  className,
  callback
) {

  container
    .querySelectorAll(
      `.${className} button[data-page]`
    )
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () => {

            if (
              button.disabled
            ) {
              return;
            }


            callback(
              Number(
                button.dataset.page
              )
            );

          }
        );

      }
    );

}


// ============================================================
// EDGE FUNCTION ERROR
// ============================================================

async function readEdgeFunctionError(
  error,
  fallback
) {

  let message =
    error?.message
    ||
    fallback;


  if (
    error?.context
  ) {

    try {

      const body =
        await error.context
          .clone()
          .json();


      message =
        body?.error
        ||
        body?.message
        ||
        message;

    }

    catch (_) {

      try {

        const text =
          await error.context
            .clone()
            .text();


        if (text) {
          message = text;
        }

      }

      catch (_) {}

    }

  }


  return message;

}


// ============================================================
// HELPERS
// ============================================================

function showPageLoading() {

  pageContent.innerHTML = `

    <div class="page-loading">
      Carregando...
    </div>

  `;

}


function escapeHTML(value) {

  if (
    value === null
    ||
    value === undefined
  ) {
    return '';
  }


  return String(value)

    .replace(
      /&/g,
      '&amp;'
    )

    .replace(
      /</g,
      '&lt;'
    )

    .replace(
      />/g,
      '&gt;'
    )

    .replace(
      /"/g,
      '&quot;'
    )

    .replace(
      /'/g,
      '&#039;'
    );

}


function formatCPF(cpf) {

  const value =
    String(
      cpf || ''
    )
      .replace(
        /\D/g,
        ''
      );


  if (
    value.length !== 11
  ) {
    return value;
  }


  return value.replace(
    /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
    '$1.$2.$3-$4'
  );

}


function formatDateBR(value) {

  if (!value) {
    return '-';
  }


  const parts =
    String(value)
      .split('-');


  if (
    parts.length !== 3
  ) {
    return value;
  }


  return (
    parts[2]
    +
    '/'
    +
    parts[1]
    +
    '/'
    +
    parts[0]
  );

}


// ============================================================
// START
// ============================================================

initializeApp();
