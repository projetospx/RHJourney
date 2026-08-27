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

      renderComingSoon(
        'Novos Colaboradores',
        'Aqui faremos a importação por planilha e a vinculação das lideranças.'
      );

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

initializeApp();
