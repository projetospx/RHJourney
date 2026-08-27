// ============================================================
// SHOPEE JOURNEY
// APP PRINCIPAL
// ============================================================

let currentUser = null;
let currentProfile = null;


// ============================================================
// ELEMENTOS
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


    // --------------------------------------------------------
    // BUSCAR PERFIL
    // --------------------------------------------------------

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

    loadTheme();

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

  const adminElements =
    document.querySelectorAll(
      '.admin-only'
    );


  if (
    currentProfile.role !==
    'ADMIN_RH'
  ) {

    adminElements.forEach(
      element => {
        element.style.display =
          'none';
      }
    );

  }

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

    LEADER:
      'Liderança',

    EMPLOYEE:
      'Colaborador'

  };


  sidebarRole.textContent =
    roles[currentProfile.role]
    || currentProfile.role;


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
    name.trim().split(/\s+/);


  if (parts.length === 1) {

    return parts[0]
      .substring(0, 2)
      .toUpperCase();

  }


  return (
    parts[0][0]
    +
    parts[parts.length - 1][0]
  ).toUpperCase();

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
    currentProfile.role === 'ADMIN_RH'
      ? 'Acompanhe os novos colaboradores e as jornadas em andamento.'
      : 'Acompanhe sua jornada e suas avaliações.';


  showPageLoading();


  if (
    currentProfile.role ===
    'ADMIN_RH'
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
    new Date().toISOString();


  const {
    data: checkpoints,
    error
  } =
    await journeySupabase
      .from('journey_checkpoints')
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


  if (!checkpoints) {

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
      error:
        submissionError
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
      continue;
    }


    // Esperamos:
    // 1 resposta do colaborador
    // 1 resposta do líder
    //
    // Portanto, menos de 2 = pendência
    if ((count || 0) < 2) {

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
// LEADER DASHBOARD - BASE
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
          )} 👋
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
// EMPLOYEE DASHBOARD - BASE
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
          )} 👋
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
        'Parâmetros administrativos do Shopee Journey.';

      renderComingSoon(
        'Configurações',
        'Aqui você poderá gerenciar líderes, BPOs, HUBs, perguntas e regras dos checkpoints.'
      );

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

        item.classList
          .toggle(
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
// PENDING BADGE
// ============================================================

function updatePendingBadge(
  number
) {

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

function loadTheme() {

  const savedTheme =
    localStorage.getItem(
      'journey-theme'
    ) || 'light';


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

        try {

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

        }

        catch (error) {

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


// ============================================================
// START
// ============================================================

// ============================================================
// NOVOS COLABORADORES
// ============================================================

let importRows = [];
let selectedImportFile = null;


// ============================================================
// CARREGAR TELA
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
          Importe colaboradores e prepare o início
          das jornadas.
        </p>

      </div>

      <button
        class="primary-action-button"
        onclick="openImportModal()"
      >
        + Importar planilha
      </button>

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

            <strong>
              Colunas esperadas
            </strong>

            <p>
              NOME · CPF · DATA DE NASCIMENTO · BPO ·
              DATA DE ADMISSÃO · EMAIL · TELEFONE ·
              HUB/OPERAÇÃO · HORÁRIO/ESCALA
            </p>

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


  fileInput.addEventListener(
    'change',
    handleEmployeeFile
  );


  await loadWaitingEmployees();

}


// ============================================================
// MODAL
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
    .classList
    .remove('hidden');


  document
    .getElementById(
      'importStepUpload'
    )
    .classList
    .remove('hidden');


  document
    .getElementById(
      'importPreview'
    )
    .classList
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
// NORMALIZAR CABEÇALHOS
// ============================================================

function normalizeHeader(
  value
) {

  return String(value || '')
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
// CONVERTER DATAS
// ============================================================

function excelDateToISO(
  value
) {

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '';
  }


  // Excel serial
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


    return (
      String(parsed.y)
      +
      '-'
      +
      String(parsed.m)
        .padStart(2, '0')
      +
      '-'
      +
      String(parsed.d)
        .padStart(2, '0')
    );

  }


  const text =
    String(value)
      .trim();


  // YYYY-MM-DD
  if (
    /^\d{4}-\d{2}-\d{2}$/
      .test(text)
  ) {
    return text;
  }


  // DD/MM/YYYY
  const br =
    text.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    );


  if (br) {

    return (
      br[3]
      +
      '-'
      +
      br[2].padStart(
        2,
        '0'
      )
      +
      '-'
      +
      br[1].padStart(
        2,
        '0'
      )
    );

  }


  return '';

}


// ============================================================
// LER PLANILHA
// ============================================================

async function handleEmployeeFile(
  event
) {

  const file =
    event.target.files[0];


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
          type:
            'array',

          cellDates:
            false
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
            defval:
              ''
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

    alert(
      error.message ||
      'Não foi possível ler a planilha.'
    );

  }

}


// ============================================================
// MAPEAR LINHA
// ============================================================

function mapSpreadsheetRow(
  original
) {

  const normalized = {};


  for (
    const [key, value]
    of Object.entries(
      original
    )
  ) {

    normalized[
      normalizeHeader(key)
    ] =
      value;

  }


  return {

    nome:
      normalized.NOME
      ||
      normalized.NOME_COMPLETO
      ||
      '',


    cpf:
      String(
        normalized.CPF
        ||
        ''
      )
        .replace(
          /\D/g,
          ''
        )
        .padStart(
          11,
          '0'
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
// VALIDAR LINHA NO FRONT
// ============================================================

function validateImportRow(
  row
) {

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
// PRÉVIA
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
    importRows.map(
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
                  row.nome ||
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
          selectedImportFile?.name
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
// RESET
// ============================================================

function resetImport() {

  importRows =
    [];

  selectedImportFile =
    null;


  document
    .getElementById(
      'employeeFileInput'
    )
    .value =
      '';


  document
    .getElementById(
      'importPreview'
    )
    .classList
    .add('hidden');


  document
    .getElementById(
      'importStepUpload'
    )
    .classList
    .remove('hidden');

}


// ============================================================
// IMPORTAR
// ============================================================

async function confirmEmployeeImport() {

  const button =
    document.getElementById(
      'confirmImportButton'
    );


  const validRows =
    importRows.filter(
      row =>
        validateImportRow(
          row
        ).length === 0
    );


  if (
    validRows.length === 0
  ) {

    alert(
      'Nenhum registro válido para importar.'
    );

    return;

  }


  button.disabled =
    true;


  button.textContent =
    'Importando...';


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
                selectedImportFile
                  ?.name
                ||
                'planilha',

              rows:
                validRows

            }
          }
        );


    if (error) {
      throw error;
    }


    if (
      !data ||
      data.success !== true
    ) {

      throw new Error(
        data?.error ||
        'A importação não foi concluída.'
      );

    }


    renderImportResult(
      data
    );

  }

  catch (error) {

    console.error(
      error
    );


    alert(
      error.message ||
      'Erro ao importar colaboradores.'
    );


    button.disabled =
      false;


    button.textContent =
      'Confirmar importação';

  }

}


// ============================================================
// RESULTADO DA IMPORTAÇÃO
// ============================================================

function renderImportResult(
  result
) {

  const preview =
    document.getElementById(
      'importPreview'
    );


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
              errorRows.map(
                item => `

                  <div class="import-error-row">

                    <span>
                      Linha
                      ${item.row}
                    </span>

                    <strong>
                      ${escapeHTML(
                        item.name ||
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

  await loadDashboardCountsSilently();

}


// ============================================================
// CARREGAR AGUARDANDO INÍCIO
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

        profiles:leader_id (
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
          ascending:
            false
        }
      );


  if (error) {

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
            data.map(
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
                    ${formatCPF(
                      item.people
                        ?.cpf
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
                    ${formatDateBR(
                      item.admission_date
                    )}
                  </td>


                  <td>
                    ${escapeHTML(
                      item.work_schedule
                    )}
                  </td>


                  <td>

                    ${
                      item.profiles
                        ?.full_name

                      ? escapeHTML(
                          item.profiles
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

function formatCPF(
  cpf
) {

  const value =
    String(cpf || '')
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


function formatDateBR(
  value
) {

  if (!value) {
    return '-';
  }


  const parts =
    value.split('-');


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


async function loadDashboardCountsSilently() {

  // usado apenas para futura atualização
  // automática dos cards
}

initializeApp();
