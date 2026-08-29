// ============================================================
// SHOPEE JOURNEY
// APP PRINCIPAL
// ============================================================

let currentUser = null;
let currentProfile = null;

let journeysCache = [];


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
// HELPERS DE RELACIONAMENTO SUPABASE
// ============================================================

function relationArray(value) {

  if (!value) {
    return [];
  }

  if (
    Array.isArray(value)
  ) {
    return value;
  }

  return [value];

}


function relationObject(value) {

  if (!value) {
    return null;
  }

  if (
    Array.isArray(value)
  ) {

    return value[0]
      ||
      null;

  }

  return value;

}


// ============================================================
// INICIALIZAÇÃO
// ============================================================

async function initializeApp() {

  try {

    const {
      data: sessionData,
      error: sessionError
    } =
      await journeySupabase
        .auth
        .getSession();


    if (sessionError) {
      throw sessionError;
    }


    if (
      !sessionData.session
    ) {

      window.location.href =
        'index.html';

      return;

    }


    currentUser =
      sessionData
        .session
        .user;


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


    if (
      !profile
      ||
      !profile.active
    ) {

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
      'Erro inicial:',
      error
    );


    pageContent.innerHTML = `

      <div class="system-error">

        <h2>
          Não foi possível carregar o Shopee Journey
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

  const roleLabels = {

    ADMIN_RH:
      'ADM / RH',

    HR_MANAGER:
      'Gestor de RH',

    LEADER:
      'Liderança',

    EMPLOYEE:
      'Colaborador'

  };


  sidebarName.textContent =
    currentProfile.full_name;


  sidebarRole.textContent =
    roleLabels[
      currentProfile.role
    ]
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
    String(name)
      .trim()
      .split(/\s+/);


  if (
    parts.length === 1
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
        'Importe e inicie as Jornadas dos novos colaboradores.';


      renderComingSoon(
        'Novos Colaboradores',
        'A tela administrativa será reintegrada após estabilizarmos Jornadas e Avaliações.'
      );

      break;


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
          : 'Acompanhe os colaboradores em Jornada.';


      await loadJourneysPage();

      break;


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
          'Acompanhe avaliações de colaboradores e lideranças.';

      }


      if (
        typeof window.loadAssessmentsPage
        !==
        'function'
      ) {

        pageContent.innerHTML = `

          <div class="system-error">

            <h2>
              Módulo de Avaliações não carregado
            </h2>

            <p>
              O arquivo js/assessments.js
              não foi executado pelo navegador.
            </p>

          </div>

        `;

        return;

      }


      await window
        .loadAssessmentsPage();

      break;


    case 'pending':

      pageTitle.textContent =
        'Pendências';


      pageSubtitle.textContent =
        'Avaliações e ações que exigem atenção.';


      renderComingSoon(
        'Central de Pendências',
        'Será construída após concluirmos o motor de Avaliações.'
      );

      break;


    case 'indicators':

      pageTitle.textContent =
        'Indicadores';


      pageSubtitle.textContent =
        'Dados consolidados das Jornadas.';


      renderComingSoon(
        'Indicadores',
        'Será alimentado pelos dados das Jornadas e Avaliações.'
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
        'Estrutura do Shopee Journey.';


      renderComingSoon(
        'Configurações',
        'A tela completa será reintegrada após os testes de Avaliações.'
      );

      break;

  }


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

function setActiveMenu(page) {

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
      'Acompanhe sua Jornada e suas avaliações.';


    renderEmployeeDashboard();

    return;

  }


  if (
    currentProfile.role ===
    'LEADER'
  ) {

    pageSubtitle.textContent =
      'Acompanhe sua equipe e as Jornadas.';


    renderLeaderDashboard();

    return;

  }


  pageSubtitle.textContent =
    'Acompanhe as Jornadas dos novos colaboradores.';


  await renderManagementDashboard();

}


// ============================================================
// DASHBOARD COLABORADOR
// ============================================================

function renderEmployeeDashboard() {

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
          Olá,
          ${escapeHTML(firstName)}
          👋
        </h2>

        <p>
          Acompanhe sua experiência durante
          os seus primeiros 90 dias.
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
// DASHBOARD LÍDER
// ============================================================

function renderLeaderDashboard() {

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
          Olá,
          ${escapeHTML(firstName)}
          👋
        </h2>

        <p>
          Acompanhe sua equipe e responda
          às avaliações da liderança.
        </p>

      </div>

    </div>


    <div class="metric-grid">

      <button
        class="metric-card"
        type="button"
        data-open-page="journeys"
      >

        <strong>↗</strong>

        <span>
          Jornadas
        </span>

      </button>


      <button
        class="metric-card"
        type="button"
        data-open-page="assessments"
      >

        <strong>✓</strong>

        <span>
          Avaliações
        </span>

      </button>

    </div>

  `;

}


// ============================================================
// DASHBOARD GESTÃO
// ============================================================

async function renderManagementDashboard() {

  showPageLoading();


  try {

    const [
      waitingResult,
      activeResult,
      completedResult,
      noLeaderResult
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
          .from('employments')
          .select(
            'id',
            {
              count: 'exact',
              head: true
            }
          )
          .is(
            'leader_id',
            null
          )
          .eq(
            'status',
            'IN_JOURNEY'
          )

      ]);


    pageContent.innerHTML = `

      <div class="welcome-banner">

        <div>

          <span class="welcome-label">
            SHOPEE JOURNEY
          </span>

          <h2>
            Jornada de Novos Contratados
          </h2>

          <p>
            Visão consolidada do acompanhamento.
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
            ${activeResult.count || 0}
          </strong>

          <span>
            Jornadas Ativas
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
            Avaliações
          </span>

        </button>


        <button
          class="metric-card"
          type="button"
          data-open-page="journeys"
        >

          <strong>
            ${noLeaderResult.count || 0}
          </strong>

          <span>
            Sem liderança
          </span>

        </button>


        <button
          class="metric-card"
          type="button"
          data-open-page="journeys"
        >

          <strong>
            ${completedResult.count || 0}
          </strong>

          <span>
            Concluídas
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
            ascending: false
          }
        );


    if (error) {
      throw error;
    }


    journeysCache =
      data || [];


    if (
      currentProfile.role ===
      'EMPLOYEE'
    ) {

      renderEmployeeJourney();

      return;

    }


    renderManagementJourneys();

  }

  catch (error) {

    console.error(
      'Erro Jornadas:',
      error
    );


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
          Nenhum cadastro encontrado
        </strong>

      </div>

    `;

    return;

  }


  const journeys =
    relationArray(
      employment.journeys
    );


  const journey =
    journeys.find(
      item =>
        item.status ===
        'ACTIVE'
    )
    ||
    journeys[0]
    ||
    null;


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

      </div>

    `;

    return;

  }


  const checkpoints =
    relationArray(
      journey
        .journey_checkpoints
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
            Checkpoints da sua Jornada.
          </p>

        </div>

      </div>


      ${
        checkpoints.length

        ? `

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
                          ${getSimpleCheckpointLabel(
                            checkpoint
                          )}
                        </span>

                      </div>

                    </div>

                  `
                )
                .join('')
            }

          </div>

        `

        : `

            <div class="empty-state">

              <strong>
                Nenhum checkpoint foi criado
              </strong>

            </div>

          `
      }


      <button
        class="primary-action-button"
        data-open-page="assessments"
        type="button"
        style="margin-top:18px;"
      >
        Abrir Avaliações
      </button>

    </section>

  `;

}


// ============================================================
// JORNADAS GESTÃO / LÍDER
// ============================================================

function renderManagementJourneys() {

  const rows =
    journeysCache.filter(
      employment => {

        if (
          currentProfile.role ===
          'LEADER'
        ) {

          return (
            !employment.leader_id
            ||
            employment.leader_id ===
            currentProfile.id
          );

        }


        return true;

      }
    );


  pageContent.innerHTML = `

    <section class="dashboard-panel">

      <div class="panel-header">

        <div>

          <h3>
            Jornadas
          </h3>

          <p>
            Acompanhamento de novos colaboradores.
          </p>

        </div>

      </div>


      <div class="table-wrapper">

        <table class="journey-table">

          <thead>

            <tr>

              <th>
                Colaborador
              </th>

              <th>
                Regional
              </th>

              <th>
                Operação
              </th>

              <th>
                BPO
              </th>

              <th>
                Liderança
              </th>

              <th>
                Jornada
              </th>

            </tr>

          </thead>


          <tbody>

            ${
              rows.map(
                employment => {

                  const journey =
                    getEmploymentJourneySafe(
                      employment
                    );


                  return `

                    <tr>

                      <td>

                        <strong>
                          ${escapeHTML(
                            relationObject(
                              employment.people
                            )
                              ?.full_name
                            ||
                            ''
                          )}
                        </strong>

                      </td>


                      <td>

                        ${escapeHTML(
                          relationObject(
                            relationObject(
                              employment.operations
                            )
                              ?.regionals
                          )
                            ?.name
                          ||
                          '-'
                        )}

                      </td>


                      <td>

                        ${escapeHTML(
                          relationObject(
                            employment.operations
                          )
                            ?.name
                          ||
                          '-'
                        )}

                      </td>


                      <td>

                        ${escapeHTML(
                          relationObject(
                            employment.bpos
                          )
                            ?.name
                          ||
                          '-'
                        )}

                      </td>


                      <td>

                        ${
                          relationObject(
                            employment.leader
                          )
                            ?.full_name

                          ? escapeHTML(
                              relationObject(
                                employment.leader
                              )
                                .full_name
                            )

                          : 'Não definida'
                        }

                      </td>


                      <td>

                        ${
                          journey

                          ? `

                            <span class="status-pill success">
                              ${escapeHTML(
                                journey.status
                              )}
                            </span>

                          `

                          : `

                            <span class="status-pill warning">
                              Não iniciada
                            </span>

                          `
                        }

                      </td>

                    </tr>

                  `;

                }
              )
                .join('')
            }

          </tbody>

        </table>

      </div>

    </section>

  `;

}


// ============================================================
// JORNADA SEGURA
// ============================================================

function getEmploymentJourneySafe(
  employment
) {

  const journeys =
    relationArray(
      employment?.journeys
    );


  return (
    journeys.find(
      journey =>
        journey.status ===
        'ACTIVE'
    )
    ||
    journeys[0]
    ||
    null
  );

}


// ============================================================
// CHECKPOINT
// ============================================================

function getSimpleCheckpointLabel(
  checkpoint
) {

  const now =
    new Date();


  const opens =
    new Date(
      checkpoint.opens_at
    );


  const due =
    new Date(
      checkpoint.due_at
    );


  if (
    now < opens
  ) {

    return (
      'Libera em '
      +
      formatDateTimeBR(
        checkpoint.opens_at
      )
    );

  }


  if (
    now > due
  ) {

    return (
      'Prazo encerrado em '
      +
      formatDateTimeBR(
        checkpoint.due_at
      )
    );

  }


  return (
    'Disponível até '
    +
    formatDateTimeBR(
      checkpoint.due_at
    )
  );

}


// ============================================================
// TEMA
// ============================================================

function loadTheme() {

  const theme =
    localStorage.getItem(
      'journey-theme'
    )
    ||
    'light';


  document.documentElement
    .setAttribute(
      'data-theme',
      theme
    );


  updateThemeIcon(
    theme
  );

}


themeToggleApp
  .addEventListener(
    'click',
    async () => {

      const current =
        document.documentElement
          .getAttribute(
            'data-theme'
          );


      const next =
        current ===
        'dark'
          ? 'light'
          : 'dark';


      document.documentElement
        .setAttribute(
          'data-theme',
          next
        );


      localStorage.setItem(
        'journey-theme',
        next
      );


      updateThemeIcon(
        next
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
              next

          });

      }

    }
  );


function updateThemeIcon(theme) {

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
// UTILITÁRIOS
// ============================================================

function showPageLoading() {

  pageContent.innerHTML = `

    <div class="page-loading">
      Carregando...
    </div>

  `;

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


function formatDateTimeBR(value) {

  if (!value) {
    return '-';
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '-';
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
