// ============================================================
// SHOPEE JOURNEY
// APP PRINCIPAL
// ============================================================

let currentUser = null;
let currentProfile = null;

let importRows = [];
let selectedImportFile = null;


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


    // ========================================================
    // BUSCAR PERFIL
    // ========================================================

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
      JSON.stringify(
        profile
      )
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
          class="primary-button small-button"
          onclick="location.reload()"
        >
          Tentar novamente
        </button>

      </div>

    `;

  }

}


// ============================================================
// PERMISSÕES VISUAIS
// ============================================================

function applyRolePermissions() {

  const role =
    currentProfile.role;


  // Recursos exclusivamente administrativos
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


  // Recursos gerenciais:
  // ADM/RH + Gestor RH
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
    currentProfile.role ===
    'ADMIN_RH'
      ? 'Acompanhe os novos colaboradores e as jornadas em andamento.'
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
// DASHBOARD ADM/RH
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


    const waiting =
      waitingResult.count || 0;


    const inJourney =
      journeyResult.count || 0;


    const completed =
      completedResult.count || 0;


    const totalPeople =
      peopleResult.count || 0;


    const pendingInfo =
      await calculatePendingAssessments();


    renderAdminDashboard({
      waiting,
      inJourney,
      completed,
      totalPeople,
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


// ============================================================
// RENDER DASHBOARD ADM/RH
// ============================================================

function renderAdminDashboard(data) {

  const firstName =
    currentProfile
      .full_name
      .split(' ')[0];


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
          onclick="openPage('new-employees')"
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
          onclick="openPage('journeys')"
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
          onclick="openPage('pending')"
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
          onclick="openPage('journeys')"
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
            onclick="openPage('pending')"
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


        <button
          class="secondary-button full-button"
          onclick="openPage('new-employees')"
        >
          + Importar novos colaboradores
        </button>

      </section>

    </div>

  `;

}


// ============================================================
// PENDÊNCIAS
// ============================================================

async function calculatePendingAssessments() {

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
          sob sua responsabilidade.
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
        O painel da liderança será carregado
        com os colaboradores vinculados a este usuário.
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
          Acompanhe aqui sua jornada de integração.
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
        'Aqui ficarão todos os colaboradores atualmente em acompanhamento.'
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
        'Aqui você verá exatamente quem precisa ser cobrado e qual avaliação está pendente.'
      );

      break;


    case 'indicators':

      pageTitle.textContent =
        'Indicadores';


      pageSubtitle.textContent =
        'Dados consolidados das jornadas.';


      renderComingSoon(
        'Indicadores',
        'Aqui entraremos com aderência, evolução, BPO, operação, turma e liderança.'
      );

      break;


    case 'settings':

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
        'Não foi possível buscar tema no banco.',
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
          class="secondary-button"
          onclick="downloadEmployeeTemplate()"
        >
          ↓ Baixar modelo
        </button>


        <button
          class="primary-action-button"
          onclick="openImportModal()"
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
            class="modal-close"
            onclick="closeImportModal()"
            type="button"
          >
            ×
          </button>

        </div>


        <div id="importStepUpload">


          <div
            id="uploadArea"
            class="upload-area"
            onclick="
              document
                .getElementById('employeeFileInput')
                .click()
            "
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
              class="secondary-button"
              onclick="downloadEmployeeTemplate()"
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


  const fileInput =
    document.getElementById(
      'employeeFileInput'
    );


  if (fileInput) {

    fileInput.addEventListener(
      'change',
      handleEmployeeFile
    );

  }


  await loadWaitingEmployees();

}


// ============================================================
// BAIXAR MODELO DE IMPORTAÇÃO
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
      'Obrigatório. Utilizar o formato DD/MM/AAAA.'
    ],

    [
      'BPO',
      'Nome da BPO responsável pela contratação.'
    ],

    [
      'DATA DE ADMISSÃO',
      'Obrigatório. Utilizar o formato DD/MM/AAAA.'
    ],

    [
      'EMAIL',
      'E-mail pessoal ou cadastral do colaborador.'
    ],

    [
      'TELEFONE',
      'Telefone com DDD.'
    ],

    [
      'HUB/OPERAÇÃO',
      'Nome ou código da operação onde o colaborador atuará.'
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
      'O líder será vinculado posteriormente dentro do Shopee Journey.'
    ],

    [
      'IMPORTANTE',
      'A importação não inicia automaticamente a jornada do colaborador.'
    ],

    [
      'IMPORTANTE',
      'Após a importação, o colaborador ficará com status AGUARDANDO INÍCIO.'
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
// MODAL DE IMPORTAÇÃO
// ============================================================

function openImportModal() {

  selectedImportFile =
    null;


  importRows =
    [];


  const modal =
    document.getElementById(
      'importModal'
    );


  const upload =
    document.getElementById(
      'importStepUpload'
    );


  const preview =
    document.getElementById(
      'importPreview'
    );


  if (!modal) {

    return;

  }


  modal.classList
    .remove('hidden');


  upload
    ?.classList
    .remove('hidden');


  preview
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
// NORMALIZAR CABEÇALHO
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
      /[^A-Z0-9]/g,
      '_'
    )
    .replace(
      /_+/g,
      '_'
    )
    .replace(
      /^_|_$/g,
      ''
    );

}


// ============================================================
// CONVERTER DATA
// ============================================================

// ============================================================
// CONVERTER DATA PARA YYYY-MM-DD
// Aceita:
// - Data serial do Excel
// - Objeto Date
// - DD/MM/YYYY
// - MM/DD/YYYY
// - YYYY-MM-DD
// ============================================================

function excelDateToISO(value) {

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '';
  }


  // ==========================================================
  // 1. DATA SERIAL DO EXCEL
  // ==========================================================

  if (
    typeof value === 'number'
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


  // ==========================================================
  // 2. OBJETO DATE
  // ==========================================================

  if (
    value instanceof Date &&
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


  // Remove hora caso venha junto
  text =
    text.split(' ')[0]
      .split('T')[0];


  // ==========================================================
  // 3. FORMATO ISO
  // YYYY-MM-DD
  // ==========================================================

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


  // ==========================================================
  // 4. FORMATO COM /
  // Pode ser:
  //
  // DD/MM/YYYY
  // MM/DD/YYYY
  //
  // Regras:
  //
  // 14/05/1990
  // Primeiro > 12
  // => DD/MM
  //
  // 05/14/1990
  // Segundo > 12
  // => MM/DD
  //
  // 05/06/1990
  // Ambíguo
  // => assume padrão brasileiro DD/MM
  // ==========================================================

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


    // Exemplo:
    // 14/05/1990
    if (first > 12) {

      day =
        first;

      month =
        second;

    }

    // Exemplo:
    // 05/14/1990
    else if (second > 12) {

      month =
        first;

      day =
        second;

    }

    // Ambíguo:
    // 05/06/1990
    // Assume padrão brasileiro
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


  // ==========================================================
  // 5. FORMATO COM -
  // DD-MM-YYYY
  // ==========================================================

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


// ============================================================
// VALIDAR E CONSTRUIR DATA ISO
// ============================================================

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


  // Evita coisas como 31/02
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
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
        .Sheets[
          firstSheet
        ];


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
// MAPEAR LINHA DA PLANILHA
// ============================================================

function mapSpreadsheetRow(original) {

  const normalized = {};


  for (
    const [key, value]
    of Object.entries(
      original
    )
  ) {

    normalized[
      normalizeHeader(
        key
      )
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
// VALIDAR LINHA
// ============================================================

function validateImportRow(row) {

  const errors = [];


  if (!row.nome) {

    errors.push(
      'Nome'
    );

  }


  if (
    !row.cpf ||
    row.cpf.length !== 11
  ) {

    errors.push(
      'CPF'
    );

  }


  if (
    !row.data_nascimento
  ) {

    errors.push(
      'Nascimento'
    );

  }


  if (!row.bpo) {

    errors.push(
      'BPO'
    );

  }


  if (
    !row.data_admissao
  ) {

    errors.push(
      'Admissão'
    );

  }


  if (!row.email) {

    errors.push(
      'E-mail'
    );

  }


  if (!row.telefone) {

    errors.push(
      'Telefone'
    );

  }


  if (!row.operacao) {

    errors.push(
      'Operação'
    );

  }


  if (
    !row.horario_escala
  ) {

    errors.push(
      'Horário/Escala'
    );

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


  let valid =
    0;


  let invalid =
    0;


  const rowsHTML =
    importRows
      .map(
        (row, index) => {

          const errors =
            validateImportRow(
              row
            );


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
                    row.nome
                    ||
                    'Não informado'
                  )}
                </strong>

              </td>


              <td>
                ${escapeHTML(
                  formatCPF(
                    row.cpf
                  )
                )}
              </td>


              <td>
                ${escapeHTML(
                  row.bpo
                )}
              </td>


              <td>
                ${escapeHTML(
                  row.operacao
                )}
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
          selectedImportFile
            ?.name
          ||
          ''
        )}
      </strong>

    </div>


    <div class="table-wrapper">

      <table class="journey-table">

        <thead>

          <tr>

            <th>
              Linha
            </th>

            <th>
              Nome
            </th>

            <th>
              CPF
            </th>

            <th>
              BPO
            </th>

            <th>
              HUB
            </th>

            <th>
              Validação
            </th>

          </tr>

        </thead>


        <tbody>
          ${rowsHTML}
        </tbody>

      </table>

    </div>


    <div class="import-actions">

      <button
        class="secondary-button"
        onclick="resetImport()"
      >
        Escolher outro arquivo
      </button>


      <button
        id="confirmImportButton"
        class="primary-action-button"
        onclick="confirmEmployeeImport()"
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

}


// ============================================================
// RESET IMPORTAÇÃO
// ============================================================

function resetImport() {

  importRows =
    [];


  selectedImportFile =
    null;


  const input =
    document.getElementById(
      'employeeFileInput'
    );


  const preview =
    document.getElementById(
      'importPreview'
    );


  const upload =
    document.getElementById(
      'importStepUpload'
    );


  if (input) {

    input.value =
      '';

  }


  preview
    ?.classList
    .add('hidden');


  upload
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
        validateImportRow(row).length === 0
    );


  if (!validRows.length) {

    alert(
      'Nenhum registro válido para importar.'
    );

    return;

  }


  if (button) {

    button.disabled = true;

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


    // ========================================================
    // ERRO DA EDGE FUNCTION
    // ========================================================

    if (error) {

      console.error(
        'Erro bruto da Edge Function:',
        error
      );


      let detailedMessage =
        error.message
        ||
        'Erro ao chamar a função.';


      // FunctionsHttpError costuma trazer
      // o Response dentro de error.context
      if (error.context) {

        try {

          const responseBody =
            await error.context.clone().json();


          console.error(
            'Resposta da Edge Function:',
            responseBody
          );


          detailedMessage =
            responseBody?.error
            ||
            responseBody?.message
            ||
            detailedMessage;

        }

        catch (jsonError) {

          try {

            const responseText =
              await error.context.clone().text();


            if (responseText) {

              detailedMessage =
                responseText;

            }

          }

          catch (_) {

            // mantém a mensagem original

          }

        }

      }


      throw new Error(
        detailedMessage
      );

    }


    console.log(
      'Resposta da importação:',
      data
    );


    if (!data) {

      throw new Error(
        'A Edge Function não retornou dados.'
      );

    }


    if (data.success !== true) {

      throw new Error(
        data.error
        ||
        data.message
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
      'ERRO FINAL DA IMPORTAÇÃO:',
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
        class="result-icon
        ${
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

          <span>
            Importados
          </span>

          <strong>
            ${result.imported}
          </strong>

        </div>


        <div>

          <span>
            Erros
          </span>

          <strong>
            ${result.errors}
          </strong>

        </div>


      </div>


      ${
        errorRows.length > 0

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
        class="primary-action-button"
        onclick="finishImport()"
      >
        Concluir
      </button>

    </div>

  `;

}


// ============================================================
// FINALIZAR IMPORTAÇÃO
// ============================================================

async function finishImport() {

  closeImportModal();


  await loadNewEmployeesPage();

}


// ============================================================
// CARREGAR COLABORADORES AGUARDANDO
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
          name
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

    console.error(
      error
    );


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

            <th>
              Colaborador
            </th>

            <th>
              CPF
            </th>

            <th>
              BPO
            </th>

            <th>
              HUB
            </th>

            <th>
              Admissão
            </th>

            <th>
              Horário / Escala
            </th>

            <th>
              Liderança
            </th>

            <th>
              Status
            </th>

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
                          item.people
                            ?.cpf
                        )
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
                        item.operations
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

                      ${
                        item.leader
                          ?.full_name

                        ? escapeHTML(
                            item.leader
                              .full_name
                          )

                        : `

                          <span class="status-pill warning">
                            Não definido
                          </span>

                        `
                      }

                    </td>


                    <td>

                      <span class="status-pill waiting">
                        Aguardando início
                      </span>

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
    value === null ||
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

// ============================================================
// CONFIGURAÇÕES
// ============================================================

async function loadSettingsPage() {

  if (
    currentProfile.role !==
    'ADMIN_RH'
  ) {

    await loadDashboard();

    return;

  }


  pageContent.innerHTML = `

    <div class="module-header">

      <div>

        <h2>
          Configurações
        </h2>

        <p>
          Gerencie operações, lideranças
          e acessos corporativos.
        </p>

      </div>

    </div>


    <div class="settings-grid">


      <!-- ==================================================
           OPERAÇÕES
      =================================================== -->

      <section class="dashboard-panel">

        <div class="panel-header">

          <div>

            <h3>
              Operações / HUBs
            </h3>

            <p>
              Cadastre as operações utilizadas
              no acompanhamento.
            </p>

          </div>

        </div>


        <form
          id="operationForm"
          class="inline-form"
        >

          <input
            id="operationName"
            type="text"
            placeholder="Ex.: HUB-LPA-03"
            required
          >


          <button
            type="submit"
            class="primary-action-button"
          >
            + Cadastrar
          </button>

        </form>


        <div id="operationsList">

          <div class="page-loading">
            Carregando operações...
          </div>

        </div>

      </section>


      <!-- ==================================================
           USUÁRIOS CORPORATIVOS
      =================================================== -->

      <section class="dashboard-panel">

        <div class="panel-header">

          <div>

            <h3>
              Usuários corporativos
            </h3>

            <p>
              Cadastre Lideranças e
              Gestores de RH.
            </p>

          </div>

        </div>


        <form
          id="corporateUserForm"
          class="settings-form"
        >


          <div class="form-group">

            <label>
              Nome completo
            </label>

            <input
              id="corporateUserName"
              type="text"
              placeholder="Nome completo"
              required
            >

          </div>


          <div class="form-group">

            <label>
              E-mail Shopee
            </label>

            <input
              id="corporateUserEmail"
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
              id="corporateUserRole"
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
              id="corporateUserPassword"
              type="password"
              minlength="8"
              placeholder="Mínimo 8 caracteres"
              required
            >

            <span class="form-help">
              O usuário deverá alterar a senha
              no primeiro acesso.
            </span>

          </div>


          <div
            id="leaderOperationsField"
            class="form-group hidden"
          >

            <label>
              Operações da liderança
            </label>

            <div
              id="leaderOperationsOptions"
              class="operations-checkbox-list"
            ></div>

          </div>


          <button
            id="createCorporateUserButton"
            class="primary-action-button full-button"
            type="submit"
          >
            Criar usuário
          </button>

        </form>


        <div class="settings-section-divider"></div>


        <div class="panel-header">

          <div>

            <h3>
              Acessos cadastrados
            </h3>

          </div>

        </div>


        <div id="corporateUsersList">

          <div class="page-loading">
            Carregando usuários...
          </div>

        </div>

      </section>

    </div>

  `;


  document
    .getElementById(
      'operationForm'
    )
    .addEventListener(
      'submit',
      createOperation
    );


  document
    .getElementById(
      'corporateUserForm'
    )
    .addEventListener(
      'submit',
      createCorporateUser
    );


  document
    .getElementById(
      'corporateUserRole'
    )
    .addEventListener(
      'change',
      handleCorporateRoleChange
    );


  await loadOperations();

  await loadCorporateUsers();

}


// ============================================================
// OPERAÇÕES
// ============================================================

async function loadOperations() {

  const {
    data,
    error
  } =
    await journeySupabase
      .from('operations')
      .select(`
        id,
        name,
        active
      `)
      .order(
        'name'
      );


  const list =
    document.getElementById(
      'operationsList'
    );


  const options =
    document.getElementById(
      'leaderOperationsOptions'
    );


  if (error) {

    if (list) {

      list.innerHTML =
        escapeHTML(
          error.message
        );

    }

    return;

  }


  if (list) {

    if (
      !data ||
      data.length === 0
    ) {

      list.innerHTML = `

        <div class="empty-state">

          <strong>
            Nenhuma operação cadastrada
          </strong>

          <p>
            Cadastre seu primeiro HUB.
          </p>

        </div>

      `;

    }

    else {

      list.innerHTML =
        data.map(
          operation => `

            <div class="settings-list-item">

              <div>

                <strong>
                  ${escapeHTML(
                    operation.name
                  )}
                </strong>

                <span>
                  ${
                    operation.active
                      ? 'Ativa'
                      : 'Inativa'
                  }
                </span>

              </div>

            </div>

          `
        )
        .join('');

    }

  }


  if (options) {

    options.innerHTML =
      (
        data || []
      )
        .filter(
          operation =>
            operation.active
        )
        .map(
          operation => `

            <label class="operation-checkbox">

              <input
                type="checkbox"
                name="leaderOperation"
                value="${operation.id}"
              >

              <span>
                ${escapeHTML(
                  operation.name
                )}
              </span>

            </label>

          `
        )
        .join('');

  }

}


// ============================================================
// CADASTRAR OPERAÇÃO
// ============================================================

async function createOperation(event) {

  event.preventDefault();


  const input =
    document.getElementById(
      'operationName'
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
      .from('operations')
      .insert({
        name,
        active: true
      });


  if (error) {

    if (
      error.code ===
      '23505'
    ) {

      alert(
        'Esta operação já está cadastrada.'
      );

    }

    else {

      alert(
        error.message
      );

    }

    return;

  }


  input.value = '';


  await loadOperations();

}


// ============================================================
// ALTERAR PERFIL DO CADASTRO
// ============================================================

function handleCorporateRoleChange() {

  const role =
    document.getElementById(
      'corporateUserRole'
    )
    .value;


  const field =
    document.getElementById(
      'leaderOperationsField'
    );


  if (
    role ===
    'LEADER'
  ) {

    field.classList
      .remove('hidden');

  }

  else {

    field.classList
      .add('hidden');


    document
      .querySelectorAll(
        'input[name="leaderOperation"]'
      )
      .forEach(
        checkbox => {

          checkbox.checked =
            false;

        }
      );

  }

}


// ============================================================
// CRIAR USUÁRIO CORPORATIVO
// ============================================================

async function createCorporateUser(event) {

  event.preventDefault();


  const fullName =
    document
      .getElementById(
        'corporateUserName'
      )
      .value
      .trim();


  const email =
    document
      .getElementById(
        'corporateUserEmail'
      )
      .value
      .trim()
      .toLowerCase();


  const role =
    document
      .getElementById(
        'corporateUserRole'
      )
      .value;


  const password =
    document
      .getElementById(
        'corporateUserPassword'
      )
      .value;


  const operationIds =
    Array.from(
      document.querySelectorAll(
        'input[name="leaderOperation"]:checked'
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

      let message =
        error.message;


      if (
        error.context
      ) {

        try {

          const body =
            await error.context
              .clone()
              .json();


          message =
            body?.error
            ||
            message;

        }

        catch (_) {}

      }


      throw new Error(
        message
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


    alert(
      'Usuário criado com sucesso.'
    );


    document
      .getElementById(
        'corporateUserForm'
      )
      .reset();


    handleCorporateRoleChange();


    await loadCorporateUsers();

  }

  catch (error) {

    console.error(
      error
    );


    alert(
      error.message
    );

  }

  finally {

    button.disabled =
      false;


    button.textContent =
      'Criar usuário';

  }

}


// ============================================================
// LISTAR USUÁRIOS CORPORATIVOS
// ============================================================

async function loadCorporateUsers() {

  const container =
    document.getElementById(
      'corporateUsersList'
    );


  if (!container) {

    return;

  }


  const {
    data,
    error
  } =
    await journeySupabase
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
            name
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
      );


  if (error) {

    container.innerHTML = `

      <p>
        ${escapeHTML(
          error.message
        )}
      </p>

    `;

    return;

  }


  if (
    !data ||
    data.length === 0
  ) {

    container.innerHTML = `

      <div class="empty-state">

        <strong>
          Nenhum acesso cadastrado
        </strong>

        <p>
          Cadastre uma liderança ou
          Gestor de RH acima.
        </p>

      </div>

    `;

    return;

  }


  container.innerHTML =
    data.map(
      user => {

        const roleLabel =
          user.role ===
          'LEADER'
            ? 'Liderança'
            : 'Gestor de RH';


        const operations =
          (
            user.leader_operations
            ||
            []
          )
            .map(
              link =>
                link.operations
                  ?.name
            )
            .filter(
              Boolean
            );


        return `

          <div class="corporate-user-card">

            <div class="corporate-user-avatar">

              ${getInitials(
                user.full_name
              )}

            </div>


            <div class="corporate-user-info">

              <strong>
                ${escapeHTML(
                  user.full_name
                )}
              </strong>

              <span>
                ${escapeHTML(
                  user.corporate_email
                  ||
                  ''
                )}
              </span>


              <div class="corporate-user-tags">

                <span class="status-pill waiting">
                  ${roleLabel}
                </span>


                ${
                  operations.map(
                    operation => `

                      <span class="operation-tag">
                        ${escapeHTML(
                          operation
                        )}
                      </span>

                    `
                  )
                  .join('')
                }

              </div>

            </div>

          </div>

        `;

      }
    )
    .join('');

}

// ============================================================
// HOME DE CONFIGURAÇÕES
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


      <div class="settings-home-grid">


        <button
          id="settingsRegionalsCard"
          class="settings-home-card"
          type="button"
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
          id="settingsOperationsCard"
          class="settings-home-card"
          type="button"
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
          id="settingsCorporateUsersCard"
          class="settings-home-card"
          type="button"
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
          id="settingsCheckpointsCard"
          class="settings-home-card"
          type="button"
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


    // ========================================================
    // EVENTOS DOS CARDS
    // ========================================================

    document
      .getElementById(
        'settingsRegionalsCard'
      )
      ?.addEventListener(
        'click',
        async () => {

          await loadRegionalsManager();

        }
      );


    document
      .getElementById(
        'settingsOperationsCard'
      )
      ?.addEventListener(
        'click',
        async () => {

          await loadOperationsManager();

        }
      );


    document
      .getElementById(
        'settingsCorporateUsersCard'
      )
      ?.addEventListener(
        'click',
        () => {

          loadCorporateUsersManager();

        }
      );


    document
      .getElementById(
        'settingsCheckpointsCard'
      )
      ?.addEventListener(
        'click',
        () => {

          openCheckpointSettings();

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
          ${escapeHTML(
            error.message
          )}
        </p>

      </div>

    `;

  }

}
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
      .order('name');


  if (error) {

    alert(error.message);
    return;

  }


  pageContent.innerHTML = `

    <div class="settings-manager-header">

      <button
        class="back-button"
        onclick="loadSettingsHome()"
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
          oninput="filterRegionalRows()"
        >

      </div>


      <div
        id="regionalRows"
        class="compact-settings-list"
      >

        ${
          data.length

          ? data.map(
              regional => `

                <div
                  class="compact-settings-row regional-row"
                  data-search="${escapeHTML(
                    regional.name.toLowerCase()
                  )}"
                >

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
                      onclick="
                        editRegional(
                          '${regional.id}',
                          '${escapeJS(
                            regional.name
                          )}'
                        )
                      "
                    >
                      Editar
                    </button>


                    <button
                      onclick="
                        toggleRegional(
                          '${regional.id}',
                          ${!regional.active}
                        )
                      "
                    >
                      ${
                        regional.active
                          ? 'Inativar'
                          : 'Ativar'
                      }
                    </button>


                    <button
                      class="danger-action"
                      onclick="
                        deleteRegional(
                          '${regional.id}',
                          '${escapeJS(
                            regional.name
                          )}'
                        )
                      "
                    >
                      Excluir
                    </button>

                  </div>

                </div>

              `
            ).join('')

          : `

              <div class="empty-state">

                <strong>
                  Nenhuma Regional cadastrada
                </strong>

              </div>

            `
        }

      </div>

    </section>

  `;


  document
    .getElementById(
      'regionalCreateForm'
    )
    .addEventListener(
      'submit',
      createRegional
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


async function editRegional(
  id,
  oldName
) {

  const newName =
    prompt(
      'Novo nome da Regional:',
      oldName
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

    alert(error.message);
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

    alert(error.message);
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


function filterRegionalRows() {

  const value =
    document
      .getElementById(
        'regionalSearch'
      )
      .value
      .toLowerCase();


  document
    .querySelectorAll(
      '.regional-row'
    )
    .forEach(
      row => {

        row.style.display =
          row.dataset.search.includes(
            value
          )
            ? ''
            : 'none';

      }
    );

}

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
          name
        `)
        .eq(
          'active',
          true
        )
        .order('name')

    ]);


  if (
    operationsResult.error ||
    regionalsResult.error
  ) {

    alert(
      operationsResult.error?.message
      ||
      regionalsResult.error?.message
    );

    return;

  }


  const operations =
    operationsResult.data || [];


  const regionals =
    regionalsResult.data || [];


  pageContent.innerHTML = `

    <div class="settings-manager-header">

      <button
        class="back-button"
        onclick="loadSettingsHome()"
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
            regionals.map(
              regional => `

                <option value="${regional.id}">
                  ${escapeHTML(
                    regional.name
                  )}
                </option>

              `
            ).join('')
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
          oninput="filterOperationsTable()"
        >


        <select
          id="operationRegionalFilter"
          onchange="filterOperationsTable()"
        >

          <option value="">
            Todas as Regionais
          </option>

          ${
            regionals.map(
              regional => `

                <option
                  value="${regional.id}"
                >
                  ${escapeHTML(
                    regional.name
                  )}
                </option>

              `
            ).join('')
          }

        </select>

      </div>


      <div class="table-wrapper">

        <table class="journey-table">

          <thead>

            <tr>

              <th>
                Regional
              </th>

              <th>
                Operação
              </th>

              <th>
                Status
              </th>

              <th>
                Ações
              </th>

            </tr>

          </thead>


          <tbody id="operationsTableBody">

            ${
              operations.map(
                operation => `

                  <tr
                    class="operation-row"

                    data-name="${escapeHTML(
                      operation.name
                        .toLowerCase()
                    )}"

                    data-regional="${
                      operation.regional_id || ''
                    }"
                  >

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
                          onclick="
                            editOperationName(
                              '${operation.id}',
                              '${escapeJS(
                                operation.name
                              )}'
                            )
                          "
                        >
                          Editar
                        </button>


                        <button
                          onclick="
                            toggleOperationStatus(
                              '${operation.id}',
                              ${!operation.active}
                            )
                          "
                        >
                          ${
                            operation.active
                              ? 'Inativar'
                              : 'Ativar'
                          }
                        </button>


                        <button
                          class="danger-action"
                          onclick="
                            deleteOperationRecord(
                              '${operation.id}',
                              '${escapeJS(
                                operation.name
                              )}'
                            )
                          "
                        >
                          Excluir
                        </button>

                      </div>

                    </td>

                  </tr>

                `
              ).join('')
            }

          </tbody>

        </table>

      </div>

    </section>

  `;


  document
    .getElementById(
      'operationCreateForm'
    )
    .addEventListener(
      'submit',
      createOperationWithRegional
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


async function editOperationName(
  id,
  oldName
) {

  const newName =
    prompt(
      'Novo nome/código da operação:',
      oldName
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
      .from('operations')
      .update({

        name:
          newName
            .trim()
            .toUpperCase()

      })
      .eq(
        'id',
        id
      );


  if (error) {

    alert(error.message);
    return;

  }


  await loadOperationsManager();

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

    alert(error.message);
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


function filterOperationsTable() {

  const search =
    document
      .getElementById(
        'operationSearch'
      )
      .value
      .toLowerCase();


  const regional =
    document
      .getElementById(
        'operationRegionalFilter'
      )
      .value;


  document
    .querySelectorAll(
      '.operation-row'
    )
    .forEach(
      row => {

        const nameOk =
          row.dataset.name.includes(
            search
          );


        const regionalOk =
          !regional
          ||
          row.dataset.regional ===
          regional;


        row.style.display =
          (
            nameOk &&
            regionalOk
          )
            ? ''
            : 'none';

      }
    );

}

function loadCorporateUsersManager() {

  pageContent.innerHTML = `

    <div class="settings-manager-header">

      <button
        class="back-button"
        onclick="loadSettingsHome()"
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

    </div>


    <section class="dashboard-panel">

      <div class="empty-state large">

        <strong>
          Gestão de Acessos
        </strong>

        <p>
          Vamos trazer o cadastro atual para
          uma tabela compacta com busca,
          filtros, edição e paginação.
        </p>

      </div>

    </section>

  `;

}


function openCheckpointSettings() {

  alert(
    'Configuração dos checkpoints será implementada na próxima etapa.'
  );

}

initializeApp();
