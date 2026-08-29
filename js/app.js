// ============================================================
// SHOPEE JOURNEY
// APP PRINCIPAL
// ============================================================

let currentUser = null;
let currentProfile = null;

let importRows = [];
let selectedImportFile = null;

let journeysCache = [];
let journeyLeaderContext = null;
let journeyCurrentTab = 'all';


// ============================================================
// ELEMENTOS
// ============================================================

const pageContent =
  document.getElementById(
    'pageContent'
  );

const pageTitle =
  document.getElementById(
    'pageTitle'
  );

const pageSubtitle =
  document.getElementById(
    'pageSubtitle'
  );

const sidebarName =
  document.getElementById(
    'sidebarName'
  );

const sidebarRole =
  document.getElementById(
    'sidebarRole'
  );

const sidebarAvatar =
  document.getElementById(
    'sidebarAvatar'
  );

const logoutButton =
  document.getElementById(
    'logoutButton'
  );

const themeToggleApp =
  document.getElementById(
    'themeToggleApp'
  );

const sidebarToggle =
  document.getElementById(
    'sidebarToggle'
  );

const sidebar =
  document.getElementById(
    'sidebar'
  );


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


    if (
      !sessionData.session
    ) {

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
          ${escapeHTML(
            error.message
          )}
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
        () =>
          location.reload()
      );

  }

}


// ============================================================
// PERMISSÕES
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
          role ===
          'ADMIN_RH'

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
            role ===
            'ADMIN_RH'
            ||
            role ===
            'HR_MANAGER'
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
    roles[
      currentProfile.role
    ]
    ||
    currentProfile.role;


  sidebarAvatar.textContent =
    getInitials(
      currentProfile.full_name
    );

}


// ============================================================
// INICIAIS
// ============================================================

function getInitials(
  name
) {

  if (!name) {
    return 'U';
  }


  const parts =
    name
      .trim()
      .split(
        /\s+/
      );


  if (
    parts.length ===
    1
  ) {

    return parts[0]
      .substring(
        0,
        2
      )
      .toUpperCase();

  }


  return (
    parts[0][0]
    +
    parts[
      parts.length - 1
    ][0]
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


  if (
    currentProfile.role ===
    'EMPLOYEE'
  ) {

    pageSubtitle.textContent =
      'Acompanhe sua jornada e suas avaliações.';


    await loadEmployeeDashboard();

    return;

  }


  if (
    currentProfile.role ===
    'LEADER'
  ) {

    pageSubtitle.textContent =
      'Acompanhe os colaboradores das suas operações.';


    await loadLeaderDashboard();

    return;

  }


  pageSubtitle.textContent =
    currentProfile.role ===
    'HR_MANAGER'

    ? 'Visão gerencial do Shopee Journey.'

    : 'Acompanhe os novos colaboradores e as jornadas em andamento.';


  await loadAdminDashboard();

}


// ============================================================
// DASHBOARD ADM / HR MANAGER
// ============================================================

async function loadAdminDashboard() {

  showPageLoading();


  try {

    const [
      waitingResult,
      journeyResult,
      completedResult,
      peopleResult,
      withoutLeaderResult
    ] =
      await Promise.all([

        journeySupabase
          .from('employments')
          .select(
            'id',
            {
              count:
                'exact',

              head:
                true
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
              count:
                'exact',

              head:
                true
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
              count:
                'exact',

              head:
                true
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
              count:
                'exact',

              head:
                true
            }
          ),


        journeySupabase
          .from('employments')
          .select(
            'id',
            {
              count:
                'exact',

              head:
                true
            }
          )
          .is(
            'leader_id',
            null
          )
          .in(
            'status',
            [
              'WAITING',
              'IN_JOURNEY'
            ]
          )

      ]);


    const failed =
      [
        waitingResult,
        journeyResult,
        completedResult,
        peopleResult,
        withoutLeaderResult
      ]
        .find(
          result =>
            result.error
        );


    if (
      failed?.error
    ) {

      throw failed.error;

    }


    renderAdminDashboard({

      waiting:
        waitingResult.count ||
        0,

      inJourney:
        journeyResult.count ||
        0,

      completed:
        completedResult.count ||
        0,

      totalPeople:
        peopleResult.count ||
        0,

      withoutLeader:
        withoutLeaderResult.count ||
        0

    });

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
          ${escapeHTML(
            error.message
          )}
        </p>

      </div>

    `;

  }

}


// ============================================================
// RENDER DASHBOARD
// ============================================================

function renderAdminDashboard(
  data
) {

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
          Olá,
          ${escapeHTML(
            firstName
          )}
          👋
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
          data-open-page="assessments"
        >

          <div class="metric-card-top">

            <div class="metric-icon red">
              ✓
            </div>

            <span class="metric-status danger">
              Avaliações
            </span>

          </div>

          <strong>
            Abrir
          </strong>

          <span>
            Acompanhar avaliações
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
              Pontos que exigem atuação
            </h3>

            <p>
              Rastreabilidade do acompanhamento.
            </p>

          </div>

        </div>


        <div class="base-summary">

          <div>

            <span>
              Sem liderança definida
            </span>

            <strong>
              ${data.withoutLeader}
            </strong>

          </div>

        </div>


        <button
          class="secondary-button full-button"
          type="button"
          data-open-page="journeys"
        >
          Ver Jornadas
        </button>

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
// DASHBOARD LÍDER
// ============================================================

async function loadLeaderDashboard() {

  showPageLoading();


  try {

    const {
      data,
      error
    } =
      await journeySupabase
        .from('employments')
        .select(`
          id,
          leader_id,
          status
        `);


    if (error) {
      throw error;
    }


    const mine =
      (
        data ||
        []
      )
        .filter(
          item =>
            item.leader_id ===
            currentProfile.id
        );


    const firstName =
      currentProfile
        .full_name
        .split(' ')[0];


    pageContent.innerHTML = `

      <div class="welcome-banner">

        <div>

          <span class="welcome-label">
            JORNADA DA EQUIPE
          </span>

          <h2>
            Olá,
            ${escapeHTML(
              firstName
            )}
            👋
          </h2>

          <p>
            Acompanhe sua equipe e as avaliações pendentes.
          </p>

        </div>

      </div>


      <div class="metric-grid">

        <button
          class="metric-card"
          type="button"
          data-open-page="journeys"
        >

          <strong>
            ${mine.length}
          </strong>

          <span>
            Meus colaboradores
          </span>

        </button>


        <button
          class="metric-card"
          type="button"
          data-open-page="assessments"
        >

          <strong>
            Abrir
          </strong>

          <span>
            Avaliações da equipe
          </span>

        </button>

      </div>

    `;

  }

  catch (error) {

    pageContent.innerHTML = `

      <div class="system-error">

        <p>
          ${escapeHTML(
            error.message
          )}
        </p>

      </div>

    `;

  }

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
          Acompanhe sua Jornada e responda
          suas avaliações.
        </p>

      </div>

    </div>


    <div class="metric-grid">

      <button
        class="metric-card"
        type="button"
        data-open-page="journeys"
      >

        <strong>
          ↗
        </strong>

        <span>
          Minha Jornada
        </span>

      </button>


      <button
        class="metric-card"
        type="button"
        data-open-page="assessments"
      >

        <strong>
          ✓
        </strong>

        <span>
          Minhas Avaliações
        </span>

      </button>

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


pageContent
  .addEventListener(
    'click',
    event => {

      const button =
        event.target.closest(
          '[data-open-page]'
        );


      if (!button) {
        return;
      }


      openPage(
        button.dataset.openPage
      );

    }
  );


// ============================================================
// ABRIR PÁGINA
// ============================================================

async function openPage(
  page
) {

  setActiveMenu(
    page
  );


  switch (
    page
  ) {


    case 'dashboard':

      await loadDashboard();

      break;


// ============================================================
// NOVOS COLABORADORES
// ============================================================

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
        'Importe e inicie o acompanhamento dos novos colaboradores.';


      await loadNewEmployeesPage();

      break;


// ============================================================
// JORNADAS
// ============================================================

    case 'journeys':

      pageTitle.textContent =
        currentProfile.role ===
        'EMPLOYEE'

        ? 'Minha Jornada'

        : 'Jornadas';


      pageSubtitle.textContent =
        currentProfile.role ===
        'EMPLOYEE'

        ? 'Acompanhe seu progresso do D1 ao D90.'

        : 'Acompanhe o progresso dos novos colaboradores.';


      await loadJourneysPage();

      break;


// ============================================================
// AVALIAÇÕES
// ============================================================

    case 'assessments':

      pageTitle.textContent =
        currentProfile.role ===
        'EMPLOYEE'

        ? 'Minhas Avaliações'

        : 'Avaliações';


      if (
        currentProfile.role ===
        'EMPLOYEE'
      ) {

        pageSubtitle.textContent =
          'Responda seus checkpoints ao longo da Jornada.';

      }

      else if (
        currentProfile.role ===
        'LEADER'
      ) {

        pageSubtitle.textContent =
          'Avalie os colaboradores sob sua responsabilidade.';

      }

      else {

        pageSubtitle.textContent =
          'Avaliações de colaboradores e lideranças.';

      }


      if (
        typeof loadAssessmentsPage !==
        'function'
      ) {

        pageContent.innerHTML = `

          <div class="system-error">

            <h2>
              Módulo de Avaliações não carregado
            </h2>

            <p>
              Verifique se o arquivo
              js/assessments.js está publicado.
            </p>

          </div>

        `;

        return;

      }


      await loadAssessmentsPage();

      break;


// ============================================================
// PENDÊNCIAS
// ============================================================

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


// ============================================================
// INDICADORES
// ============================================================

    case 'indicators':

      if (
        currentProfile.role !==
        'ADMIN_RH'
        &&
        currentProfile.role !==
        'HR_MANAGER'
      ) {

        await loadDashboard();

        return;

      }


      pageTitle.textContent =
        'Indicadores';


      pageSubtitle.textContent =
        'Dados consolidados das jornadas.';


      renderComingSoon(
        'Indicadores',
        'Aqui teremos análises por Regional, Operação, BPO, liderança e período.'
      );

      break;


// ============================================================
// CONFIGURAÇÕES
// ============================================================

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


      renderComingSoon(
        'Configurações',
        'As configurações existentes podem continuar no seu módulo atual.'
      );

      break;

  }


// ============================================================
// FECHAR MENU MOBILE
// ============================================================

  if (
    window.innerWidth <=
    900
  ) {

    sidebar.classList
      .remove(
        'open'
      );

  }

}


// ============================================================
// MENU ATIVO
// ============================================================

function setActiveMenu(
  page
) {

  document
    .querySelectorAll(
      '.menu-item'
    )
    .forEach(
      item => {

        item.classList.toggle(
          'active',
          item.dataset.page ===
          page
        );

      }
    );

}


// ============================================================
// EM CONSTRUÇÃO
// ============================================================

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
        ${escapeHTML(
          title
        )}
      </h2>

      <p>
        ${escapeHTML(
          description
        )}
      </p>

      <span>
        Módulo em construção
      </span>

    </div>

  `;

}


// ============================================================
// NOVOS COLABORADORES
// ============================================================

async function loadNewEmployeesPage() {

  pageContent.innerHTML = `

    <div class="module-header">

      <div>

        <h2>
          Novos Colaboradores
        </h2>

        <p>
          Importe colaboradores e inicie suas Jornadas.
        </p>

      </div>

    </div>


    <section class="dashboard-panel">

      <div id="waitingEmployees">

        <div class="page-loading">
          Carregando colaboradores...
        </div>

      </div>

    </section>

  `;


  await loadWaitingEmployees();

}


// ============================================================
// AGUARDANDO INÍCIO
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
      .from('employments')
      .select(`
        id,
        admission_date,
        work_schedule,
        status,

        people (
          full_name,
          cpf
        ),

        bpos (
          name
        ),

        operations (
          id,
          name,

          regionals (
            name
          )
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

        ${escapeHTML(
          error.message
        )}

      </div>

    `;

    return;

  }


  if (
    !data?.length
  ) {

    container.innerHTML = `

      <div class="empty-state">

        <strong>
          Nenhum colaborador aguardando início
        </strong>

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
            <th>Regional</th>
            <th>Operação</th>
            <th>BPO</th>
            <th>Admissão</th>
            <th>Ação</th>

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
                          formatCPF(
                            item.people
                              ?.cpf
                          )
                        )}

                      </span>

                    </td>


                    <td>

                      ${escapeHTML(
                        item.operations
                          ?.regionals
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
                        item.bpos
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

                      <button
                        class="primary-action-button start-waiting-journey"
                        type="button"
                        data-id="${item.id}"
                        data-name="${escapeHTML(
                          item.people
                            ?.full_name
                          ||
                          ''
                        )}"
                      >
                        ▶ Iniciar Jornada
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
      '.start-waiting-journey'
    )
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () => {

            startEmployeeJourney(
              button.dataset.id,
              button.dataset.name
            );

          }
        );

      }
    );

}


// ============================================================
// INICIAR JORNADA
// ============================================================

async function startEmployeeJourney(
  employmentId,
  employeeName
) {

  if (
    !confirm(
      `Iniciar a Jornada de ${employeeName}?`
    )
  ) {
    return;
  }


  try {

    const {
      error
    } =
      await journeySupabase
        .rpc(
          'start_journey',
          {
            p_employment_id:
              employmentId
          }
        );


    if (error) {
      throw error;
    }


    alert(
      `Jornada de ${employeeName} iniciada com sucesso.`
    );


    await loadNewEmployeesPage();

  }

  catch (error) {

    alert(
      error.message
      ||
      'Não foi possível iniciar a Jornada.'
    );

  }

}


// ============================================================
// JORNADAS
// ============================================================

async function loadJourneysPage() {

  showPageLoading();


  try {

    const {
      data,
      error
    } =
      await journeySupabase
        .from('employments')
        .select(`
          id,
          person_id,
          operation_id,
          bpo_id,
          leader_id,
          period_id,
          admission_date,
          work_schedule,
          status,

          people (
            id,
            auth_user_id,
            full_name,
            cpf,
            email
          ),

          bpos (
            id,
            name
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
            name
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
        .order(
          'admission_date',
          {
            ascending:
              false
          }
        );


    if (error) {
      throw error;
    }


    journeysCache =
      data ||
      [];


    if (
      currentProfile.role ===
      'EMPLOYEE'
    ) {

      renderEmployeeJourney();

      return;

    }


    if (
      currentProfile.role ===
      'LEADER'
    ) {

      renderSimpleLeaderJourneys();

      return;

    }


    renderSimpleManagementJourneys();

  }

  catch (error) {

    pageContent.innerHTML = `

      <div class="system-error">

        <h2>
          Não foi possível carregar as Jornadas
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


// ============================================================
// JORNADA DO COLABORADOR
// ============================================================

function renderEmployeeJourney() {

  const employment =
    journeysCache[0];


  if (!employment) {

    pageContent.innerHTML = `

      <div class="empty-state">

        <strong>
          Nenhuma Jornada encontrada
        </strong>

      </div>

    `;

    return;

  }


  const journey =
    (
      employment.journeys
      ||
      []
    )
      .find(
        item =>
          item.status ===
          'ACTIVE'
      )
    ||
    (
      employment.journeys
      ||
      []
    )[0];


  if (!journey) {

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

          </h2>

          <p>
            Seu cadastro já está no Shopee Journey.
          </p>

        </div>

      </div>


      <div class="empty-state large">

        <strong>
          Jornada aguardando início
        </strong>

        <p>
          Assim que sua Jornada for iniciada,
          seus checkpoints aparecerão aqui.
        </p>

      </div>

    `;

    return;

  }


  const checkpoints =
    (
      journey
        .journey_checkpoints
      ||
      []
    )
      .slice()
      .sort(
        (
          a,
          b
        ) =>
          new Date(
            a.opens_at
          )
          -
          new Date(
            b.opens_at
          )
      );


  pageContent.innerHTML = `

    <div class="welcome-banner">

      <div>

        <span class="welcome-label">
          MINHA JORNADA
        </span>

        <h2>
          Sua Jornada está em andamento 🧡
        </h2>

        <p>
          Acompanhe seu progresso do D1 ao D90.
        </p>

      </div>

    </div>


    <section class="dashboard-panel">

      <div class="panel-header">

        <div>

          <h3>
            Linha do tempo
          </h3>

          <p>
            Seus checkpoints.
          </p>

        </div>

      </div>


      <div class="compact-settings-list">

        ${
          checkpoints
            .map(
              checkpoint => `

                <div class="compact-settings-row">

                  <div>

                    <strong>

                      ${escapeHTML(
                        checkpoint.checkpoint
                      )}

                    </strong>

                    <span>

                      Disponível em

                      ${formatDateTimeBR(
                        checkpoint.opens_at
                      )}

                    </span>

                  </div>

                </div>

              `
            )
            .join('')
        }

      </div>


      <button
        class="primary-action-button"
        type="button"
        data-open-page="assessments"
        style="margin-top:18px;"
      >
        Abrir minhas Avaliações
      </button>

    </section>

  `;

}


// ============================================================
// JORNADAS ADM
// ============================================================

function renderSimpleManagementJourneys() {

  const filtered =
    journeysCache.filter(
      item =>
        item.status ===
        'IN_JOURNEY'
        ||
        item.status ===
        'COMPLETED'
    );


  pageContent.innerHTML = `

    <section class="dashboard-panel">

      <div class="panel-header">

        <div>

          <h3>
            Jornadas
          </h3>

          <p>
            Colaboradores em acompanhamento.
          </p>

        </div>

      </div>


      ${
        filtered.length

        ? `

          <div class="table-wrapper">

            <table class="journey-table">

              <thead>

                <tr>

                  <th>Colaborador</th>
                  <th>Regional</th>
                  <th>Operação</th>
                  <th>BPO</th>
                  <th>Líder</th>
                  <th>Status</th>

                </tr>

              </thead>


              <tbody>

                ${
                  filtered
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

                          </td>


                          <td>

                            ${escapeHTML(
                              item.operations
                                ?.regionals
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
                              item.bpos
                                ?.name
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

                              : 'Não identificado'
                            }

                          </td>


                          <td>

                            ${escapeHTML(
                              item.status
                            )}

                          </td>

                        </tr>

                      `
                    )
                    .join('')
                }

              </tbody>

            </table>

          </div>

        `

        : `

            <div class="empty-state">

              <strong>
                Nenhuma Jornada encontrada
              </strong>

            </div>

          `
      }

    </section>

  `;

}


// ============================================================
// JORNADAS LÍDER
// ============================================================

function renderSimpleLeaderJourneys() {

  const rows =
    journeysCache.filter(
      item =>
        item.leader_id ===
        currentProfile.id
        ||
        !item.leader_id
    );


  pageContent.innerHTML = `

    <section class="dashboard-panel">

      <div class="panel-header">

        <div>

          <h3>
            Jornadas da Operação
          </h3>

          <p>
            Colaboradores disponíveis para acompanhamento.
          </p>

        </div>

      </div>


      ${
        rows.length

        ? `

          <div class="table-wrapper">

            <table class="journey-table">

              <thead>

                <tr>

                  <th>Colaborador</th>
                  <th>Operação</th>
                  <th>Liderança</th>

                </tr>

              </thead>

              <tbody>

                ${
                  rows
                    .map(
                      item => `

                        <tr>

                          <td>

                            ${escapeHTML(
                              item.people
                                ?.full_name
                              ||
                              ''
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

                            ${
                              item.leader_id ===
                              currentProfile.id

                              ? 'Meu colaborador'

                              : 'A identificar'
                            }

                          </td>

                        </tr>

                      `
                    )
                    .join('')
                }

              </tbody>

            </table>

          </div>

        `

        : `

            <div class="empty-state">

              Nenhum colaborador encontrado.

            </div>

          `
      }

    </section>

  `;

}


// ============================================================
// TEMA
// ============================================================

async function loadTheme() {

  const savedTheme =
    localStorage.getItem(
      'journey-theme'
    )
    ||
    'light';


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


      if (
        currentProfile
      ) {

        await journeySupabase
          .from(
            'user_preferences'
          )
          .upsert({
            user_id:
              currentProfile.id,

            theme:
              newTheme
          });

      }

    }
  );


// ============================================================
// ÍCONE TEMA
// ============================================================

function updateThemeIcon(
  theme
) {

  themeToggleApp.textContent =
    theme ===
    'dark'

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

      await journeySupabase
        .auth
        .signOut();


      sessionStorage
        .removeItem(
          'journey-profile'
        );


      window.location.href =
        'index.html';

    }
  );


// ============================================================
// MOBILE
// ============================================================

sidebarToggle
  .addEventListener(
    'click',
    () => {

      sidebar.classList
        .toggle(
          'open'
        );

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


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(
  value
) {

  if (
    value ===
    null
    ||
    value ===
    undefined
  ) {

    return '';

  }


  return String(
    value
  )
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
// CPF
// ============================================================

function formatCPF(
  cpf
) {

  const value =
    String(
      cpf ||
      ''
    )
      .replace(
        /\D/g,
        ''
      );


  if (
    value.length !==
    11
  ) {

    return value;

  }


  return value.replace(
    /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
    '$1.$2.$3-$4'
  );

}


// ============================================================
// DATA BR
// ============================================================

function formatDateBR(
  value
) {

  if (!value) {
    return '-';
  }


  const text =
    String(
      value
    );


  if (
    /^\d{4}-\d{2}-\d{2}$/
      .test(
        text
      )
  ) {

    const [
      year,
      month,
      day
    ] =
      text.split(
        '-'
      );


    return `${day}/${month}/${year}`;

  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return value;

  }


  return date
    .toLocaleDateString(
      'pt-BR'
    );

}


// ============================================================
// DATA/HORA
// ============================================================

function formatDateTimeBR(
  value
) {

  if (!value) {
    return '-';
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return value;

  }


  return date
    .toLocaleDateString(
      'pt-BR'
    );

}


// ============================================================
// START
// ============================================================

initializeApp();
