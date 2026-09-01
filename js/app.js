// ============================================================
// RH JOURNEY
// APP PRINCIPAL CONSOLIDADO
// ============================================================

let currentUser = null;
let currentProfile = null;
let pageContent = null;
let pageTitle = null;
let pageSubtitle = null;
let journeysCache = [];
let employmentsCache = [];
let regionalsCache = [];
let operationsCache = [];
let corporateUsersCache = [];

const PAGE_META = {
  dashboard: ['Visão Geral', 'Acompanhamento da Jornada'],
  'new-employees': ['Novos Colaboradores', 'Importação e início de jornada'],
  journeys: ['Jornadas', 'Acompanhamento D1 → D90'],
  assessments: ['Avaliações', 'Avaliações da Jornada'],
  pending: ['Pendências', 'Pontos que exigem atuação'],
  indicators: ['Indicadores', 'Aderência e evolução da Jornada'],
  settings: ['Configurações', 'Estrutura e acessos do RH Journey']
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

document.addEventListener(
  'DOMContentLoaded',
  initializeApp
);


async function initializeApp() {

  try {

    pageContent =
      document.getElementById('pageContent')
      ||
      document.querySelector('.page-content');

    pageTitle =
      document.getElementById('pageTitle');

    pageSubtitle =
      document.getElementById('pageSubtitle');


    if (!pageContent) {

      throw new Error(
        'Elemento #pageContent não encontrado no app.html.'
      );

    }


    injectAppStyles();

    bindStaticEvents();

    applySavedTheme();

    showPageLoading(
      'Carregando RH Journey...'
    );


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


    const session =
      sessionData?.session;


    if (!session?.user) {

      window.location.href =
        'index.html';

      return;

    }


    currentUser =
      session.user;


    currentProfile =
      await loadCurrentProfile(
        currentUser.id
      );


    renderSidebarUser();

    applyRolePermissions();


    await openPage(
      'dashboard'
    );

  }

  catch (error) {

    console.error(
      'Erro ao inicializar:',
      error
    );


    if (pageContent) {

      pageContent.innerHTML =
        renderError(
          'Não foi possível carregar o RH Journey.',
          error.message
        );

    }

  }

}


async function loadCurrentProfile(
  userId
) {

  const {
    data,
    error
  } =
    await journeySupabase
      .from('profiles')
      .select('*')
      .eq(
        'id',
        userId
      )
      .single();


  if (error) {

    throw error;

  }


  return data;

}


// ============================================================
// NAVEGAÇÃO
// ============================================================

function bindStaticEvents() {

  document
    .querySelectorAll(
      '[data-page]'
    )
    .forEach(
      item => {

        item.addEventListener(
          'click',
          event => {

            event.preventDefault();

            openPage(
              item.dataset.page
            );

          }
        );

      }
    );


  document
    .getElementById(
      'logoutButton'
    )
    ?.addEventListener(
      'click',
      logout
    );


  document
    .getElementById(
      'themeToggle'
    )
    ?.addEventListener(
      'click',
      toggleTheme
    );


  document
    .querySelectorAll(
      '[data-logout]'
    )
    .forEach(
      el =>
        el.addEventListener(
          'click',
          logout
        )
    );


  document
    .querySelectorAll(
      '[data-theme-toggle]'
    )
    .forEach(
      el =>
        el.addEventListener(
          'click',
          toggleTheme
        )
    );

}


async function openPage(
  page
) {

  if (!pageContent) {

    return;

  }


  if (
    !isPageAllowed(
      page
    )
  ) {

    page =
      'dashboard';

  }


  setActiveNav(
    page
  );

  setPageHeader(
    page
  );

  closeAnyOpenModal();

  showPageLoading();


  try {

    switch (page) {

      case 'dashboard':

        return await loadDashboard();


      case 'new-employees':

        return await loadNewEmployeesPage();


      case 'journeys':

        return await loadJourneysPage();


      case 'assessments':

        if (
          typeof window.loadAssessmentsPage ===
          'function'
        ) {

          return await window
            .loadAssessmentsPage();

        }


        pageContent.innerHTML =
          renderError(
            'Módulo de Avaliações não carregado',
            'O arquivo js/assessments.js não foi executado pelo navegador.'
          );

        return;


      case 'pending':

        return await loadPendingPage();


      case 'indicators':

        return await loadIndicatorsPage();


      case 'settings':

        return await loadSettingsPage();


      default:

        pageContent.innerHTML =
          renderEmpty(
            'Página não encontrada.'
          );

    }

  }

  catch (error) {

    console.error(
      `Erro ao abrir ${page}:`,
      error
    );


    pageContent.innerHTML =
      renderError(
        'Não foi possível carregar esta página.',
        error.message
      );

  }

}


window.openPage =
  openPage;


function isPageAllowed(
  page
) {

  const role =
    currentProfile?.role;


  if (!role) {

    return false;

  }


  if (
    role ===
    'EMPLOYEE'
  ) {

    return [
      'dashboard',
      'journeys',
      'assessments'
    ].includes(
      page
    );

  }


  if (
    role ===
    'LEADER'
  ) {

    return [
      'dashboard',
      'journeys',
      'assessments',
      'pending'
    ].includes(
      page
    );

  }


  if (
    role ===
    'HR_MANAGER'
  ) {

    return [
      'dashboard',
      'journeys',
      'assessments',
      'pending',
      'indicators'
    ].includes(
      page
    );

  }


  return true;

}


function applyRolePermissions() {

  document
    .querySelectorAll(
      '[data-page]'
    )
    .forEach(
      item => {

        item.style.display =
          isPageAllowed(
            item.dataset.page
          )

            ? ''

            : 'none';

      }
    );

}


function setActiveNav(
  page
) {

  document
    .querySelectorAll(
      '[data-page]'
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


function setPageHeader(
  page
) {

  const [
    title,
    subtitle
  ] =
    PAGE_META[page]
    ||
    [
      'RH Journey',
      ''
    ];


  if (pageTitle) {

    pageTitle.textContent =
      title;

  }


  if (pageSubtitle) {

    pageSubtitle.textContent =
      subtitle;

  }

}


// ============================================================
// DASHBOARD
// ============================================================

async function loadDashboard() {

  if (
    currentProfile.role ===
    'EMPLOYEE'
  ) {

    return loadEmployeeDashboard();

  }


  if (
    currentProfile.role ===
    'LEADER'
  ) {

    return loadLeaderDashboard();

  }


  return loadAdminDashboard();

}


async function loadAdminDashboard() {

  const {
    data,
    error
  } =
    await journeySupabase
      .from('employments')
      .select(`
        id,
        status,
        leader_id,
        admission_date,

        people (
          full_name
        ),

        operations (
          name
        ),

        journeys (
          id,
          status,

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


  const rows =
    data ||
    [];


  const waiting =
    rows.filter(
      e =>
        e.status ===
        'WAITING'
    ).length;


  const active =
    rows.filter(
      e =>
        e.status ===
        'IN_JOURNEY'
    ).length;


  const completed =
    rows.filter(
      e =>
        e.status ===
        'COMPLETED'
    ).length;


  const noLeader =
    rows.filter(
      e =>
        e.status ===
        'IN_JOURNEY'
        &&
        !e.leader_id
    ).length;


  pageContent.innerHTML = `

    <div class="metric-grid">

      ${metricCard(
        'Aguardando',
        waiting,
        'Novos colaboradores ainda não iniciados'
      )}

      ${metricCard(
        'Em acompanhamento',
        active,
        'Jornadas ativas'
      )}

      ${metricCard(
        'Sem liderança',
        noLeader,
        'Colaboradores ativos sem líder atual'
      )}

      ${metricCard(
        'Concluídos',
        completed,
        'Jornadas finalizadas'
      )}

    </div>


    <section class="dashboard-panel">

      <div class="panel-header">

        <div>

          <h3>
            Ações rápidas
          </h3>

          <p>
            Acesse os principais fluxos do RH Journey.
          </p>

        </div>

      </div>


      <div class="quick-actions-grid">

        ${
          currentProfile.role ===
          'ADMIN_RH'

            ? quickAction(
                'new-employees',
                '＋',
                'Novos Colaboradores',
                'Importar e iniciar jornadas'
              )

            : ''
        }


        ${quickAction(
          'journeys',
          '↗',
          'Jornadas',
          'Acompanhar D1 → D90'
        )}


        ${quickAction(
          'assessments',
          '✓',
          'Avaliações',
          'Comparar colaborador e liderança'
        )}


        ${quickAction(
          'pending',
          '!',
          'Pendências',
          'Ver pontos que exigem atuação'
        )}

      </div>

    </section>

  `;


  bindQuickActions();

}


async function loadLeaderDashboard() {

  const {
    data,
    error
  } =
    await journeySupabase
      .from('employments')
      .select(`
        id,
        status,
        leader_id,
        admission_date,

        people (
          full_name
        ),

        operations (
          name
        ),

        journeys (
          id,
          status
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


  const accessible =
    data ||
    [];


  const mine =
    accessible.filter(
      e =>
        e.leader_id ===
        currentProfile.id
    );


  const unassigned =
    accessible.filter(
      e =>
        !e.leader_id
    );


  pageContent.innerHTML = `

    <div class="metric-grid">

      ${metricCard(
        'Meus colaboradores',
        mine.length,
        'Sob sua responsabilidade atual'
      )}

      ${metricCard(
        'A identificar',
        unassigned.length,
        'Sem liderança definida'
      )}

      ${metricCard(
        'Visíveis na operação',
        accessible.length,
        'Conforme seu escopo de acesso'
      )}

    </div>


    <section class="dashboard-panel">

      <div class="panel-header">

        <div>

          <h3>
            Atalhos
          </h3>

          <p>
            Gerencie sua equipe e avaliações.
          </p>

        </div>

      </div>


      <div class="quick-actions-grid">

        ${quickAction(
          'journeys',
          '↗',
          'Colaboradores',
          'Ver e assumir responsabilidade'
        )}

        ${quickAction(
          'assessments',
          '✓',
          'Avaliações',
          'Responder avaliações da equipe'
        )}

        ${quickAction(
          'pending',
          '!',
          'Pendências',
          'Ver avaliações pendentes'
        )}

      </div>

    </section>

  `;


  bindQuickActions();

}


async function loadEmployeeDashboard() {

  pageContent.innerHTML = `

    <div class="journey-hero-simple">

      <span>
        RH JOURNEY
      </span>

      <h2>
        Olá, ${escapeHTML(
          currentProfile.full_name ||
          'Colaborador'
        )} 🧡
      </h2>

      <p>
        Acompanhe sua jornada e responda suas avaliações.
      </p>

    </div>


    <div class="quick-actions-grid">

      ${quickAction(
        'journeys',
        '↗',
        'Minha Jornada',
        'Acompanhar seus checkpoints'
      )}

      ${quickAction(
        'assessments',
        '✓',
        'Minhas Avaliações',
        'Responder os checkpoints disponíveis'
      )}

    </div>

  `;


  bindQuickActions();

}


// ============================================================
// NOVOS COLABORADORES / IMPORTAÇÃO
// ============================================================

async function loadNewEmployeesPage() {

  if (
    currentProfile.role !==
    'ADMIN_RH'
  ) {

    pageContent.innerHTML =
      renderError(
        'Acesso restrito',
        'Apenas ADMIN/RH pode importar novos colaboradores.'
      );

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
        status,
        person_id,

        people (
          id,
          full_name,
          cpf,
          birth_date,
          email,
          phone
        ),

        bpos (
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

    throw error;

  }


  employmentsCache =
    data ||
    [];


  pageContent.innerHTML = `

    <section class="dashboard-panel">

      <div class="panel-header">

        <div>

          <h3>
            Importar novos colaboradores
          </h3>

          <p>
            Use o modelo padrão para cadastrar novos colaboradores.
          </p>

        </div>


        <div class="panel-actions">

          <button
            class="secondary-button"
            id="downloadImportTemplate"
            type="button"
          >
            Baixar modelo
          </button>


          <button
            class="primary-action-button"
            id="openImportEmployees"
            type="button"
          >
            Importar planilha
          </button>

        </div>

      </div>

    </section>


    <section class="dashboard-panel">

      <div class="panel-header">

        <div>

          <h3>
            Aguardando início
          </h3>

          <p>
            ${employmentsCache.length}
            colaborador(es).
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
                Operação
              </th>

              <th>
                BPO
              </th>

              <th>
                Admissão
              </th>

              <th>
                Ações
              </th>

            </tr>

          </thead>


          <tbody>

            ${
              employmentsCache.length

                ? employmentsCache
                    .map(
                      renderWaitingEmployeeRow
                    )
                    .join('')

                : `

                    <tr>
                      <td colspan="5">
                        Nenhum colaborador aguardando início.
                      </td>
                    </tr>

                  `
            }

          </tbody>

        </table>

      </div>

    </section>

  `;


  document
    .getElementById(
      'downloadImportTemplate'
    )
    ?.addEventListener(
      'click',
      downloadImportTemplate
    );


  document
    .getElementById(
      'openImportEmployees'
    )
    ?.addEventListener(
      'click',
      openImportEmployeesModal
    );


  document
    .querySelectorAll(
      '[data-start-journey]'
    )
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () =>
            startJourney(
              button.dataset.startJourney
            )
        );

      }
    );


  document
    .querySelectorAll(
      '[data-delete-employee]'
    )
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () =>
            deleteEmployee(
              button.dataset.deleteEmployee
            )
        );

      }
    );

}


function renderWaitingEmployeeRow(
  employment
) {

  const person =
    relationObject(
      employment.people
    );


  const operation =
    relationObject(
      employment.operations
    );


  const bpo =
    relationObject(
      employment.bpos
    );


  return `

    <tr>

      <td>

        <strong>
          ${escapeHTML(
            person?.full_name ||
            '-'
          )}
        </strong>

        <br>

        <small>
          ${escapeHTML(
            formatCPF(
              person?.cpf ||
              ''
            )
          )}
        </small>

      </td>


      <td>
        ${escapeHTML(
          operation?.name ||
          '-'
        )}
      </td>


      <td>
        ${escapeHTML(
          bpo?.name ||
          '-'
        )}
      </td>


      <td>
        ${formatDate(
          employment.admission_date
        )}
      </td>


      <td>

        <div class="row-actions">

          <button
            class="primary-action-button"
            data-start-journey="${employment.id}"
            type="button"
          >
            Iniciar Jornada
          </button>

          <button
            class="danger-button"
            data-delete-employee="${employment.id}"
            type="button"
          >
            Excluir
          </button>

        </div>

      </td>

    </tr>

  `;

}


function openImportEmployeesModal() {

  openGenericModal(`

    <div class="modal-header">

      <div>

        <h2>
          Importar novos colaboradores
        </h2>

        <p>
          Selecione o arquivo XLSX preenchido
          no modelo do RH Journey.
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


    <div class="assessment-modal-body">

      <input
        id="employeeImportFile"
        type="file"
        accept=".xlsx,.xls"
      >

      <div
        id="importPreview"
        style="margin-top:16px"
      ></div>

      <div class="assessment-form-footer">

        <button
          id="cancelImport"
          class="secondary-button"
          type="button"
        >
          Cancelar
        </button>

        <button
          id="processEmployeeImport"
          class="primary-action-button"
          type="button"
          disabled
        >
          Importar
        </button>

      </div>

    </div>

  `);


  const fileInput =
    document.getElementById(
      'employeeImportFile'
    );


  const processButton =
    document.getElementById(
      'processEmployeeImport'
    );


  const preview =
    document.getElementById(
      'importPreview'
    );


  let parsedRows =
    [];


  document
    .getElementById(
      'cancelImport'
    )
    ?.addEventListener(
      'click',
      closeGenericModal
    );


  fileInput
    ?.addEventListener(
      'change',
      async () => {

        const file =
          fileInput.files?.[0];


        if (!file) {

          return;

        }


        try {

          parsedRows =
            await parseImportWorkbook(
              file
            );


          preview.innerHTML = `

            <div class="success-box">

              <strong>
                ${parsedRows.length}
              </strong>

              linha(s) válida(s) encontradas.

            </div>

          `;


          processButton.disabled =
            parsedRows.length ===
            0;

        }

        catch (error) {

          parsedRows =
            [];


          processButton.disabled =
            true;


          preview.innerHTML = `

            <div class="system-error">
              ${escapeHTML(
                error.message
              )}
            </div>

          `;

        }

      }
    );


  processButton
    ?.addEventListener(
      'click',
      async () => {

        if (
          !parsedRows.length
        ) {

          return;

        }


        processButton.disabled =
          true;


        processButton.textContent =
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
                    employees:
                      parsedRows
                  }
                }
              );


          if (error) {

            throw error;

          }


          if (
            data?.error
          ) {

            throw new Error(
              data.error
            );

          }


          closeGenericModal();


          alert(
            `Importação concluída. ${
              data?.created
              ??
              parsedRows.length
            } colaborador(es) processado(s).`
          );


          await loadNewEmployeesPage();

        }

        catch (error) {

          console.error(
            'Importação:',
            error
          );


          alert(
            error.message
            ||
            'Não foi possível importar os colaboradores.'
          );


          processButton.disabled =
            false;


          processButton.textContent =
            'Importar';

        }

      }
    );

}


async function parseImportWorkbook(
  file
) {

  if (
    typeof XLSX ===
    'undefined'
  ) {

    throw new Error(
      'Biblioteca XLSX não carregada no app.html.'
    );

  }


  const buffer =
    await file.arrayBuffer();


  const workbook =
    XLSX.read(
      buffer,
      {
        type: 'array',
        cellDates: true
      }
    );


  const sheet =
    workbook.Sheets['IMPORTAÇÃO']
    ||
    workbook.Sheets[
      workbook.SheetNames[0]
    ];


  if (!sheet) {

    throw new Error(
      'Nenhuma aba encontrada na planilha.'
    );

  }


  const rows =
    XLSX.utils
      .sheet_to_json(
        sheet,
        {
          defval: '',
          raw: true
        }
      );


  if (!rows.length) {

    throw new Error(
      'A planilha está vazia.'
    );

  }


  return rows
    .map(
      (
        row,
        index
      ) =>
        normalizeImportRow(
          row,
          index + 2
        )
    )
    .filter(
      Boolean
    );

}


function normalizeImportRow(
  row,
  lineNumber
) {

  const get =
    (...names) => {

      for (
        const name
        of names
      ) {

        if (
          Object.prototype
            .hasOwnProperty
            .call(
              row,
              name
            )
        ) {

          return row[name];

        }

      }


      for (
        const [
          key,
          value
        ]
        of Object.entries(
          row
        )
      ) {

        const normalizedKey =
          normalizeHeader(
            key
          );


        if (
          names.some(
            name =>
              normalizeHeader(
                name
              )
              ===
              normalizedKey
          )
        ) {

          return value;

        }

      }


      return '';

    };


  const name =
    String(
      get(
        'NOME',
        'NOME COMPLETO'
      )
    ).trim();


  const cpf =
    digitsOnly(
      get(
        'CPF'
      )
    );


  const birthDate =
    parseSpreadsheetDate(
      get(
        'DATA DE NASCIMENTO',
        'NASCIMENTO'
      )
    );


  const bpo =
    String(
      get(
        'BPO'
      )
    ).trim();


  const admissionDate =
    parseSpreadsheetDate(
      get(
        'DATA DE ADMISSÃO',
        'DATA DE ADMISSAO',
        'ADMISSÃO',
        'ADMISSAO'
      )
    );


  const email =
    String(
      get(
        'EMAIL',
        'E-MAIL'
      )
    ).trim();


  const phone =
    String(
      get(
        'TELEFONE',
        'CELULAR'
      )
    ).trim();


  const operation =
    String(
      get(
        'HUB/OPERAÇÃO',
        'HUB/OPERACAO',
        'OPERAÇÃO',
        'OPERACAO',
        'HUB'
      )
    ).trim();


  const schedule =
    String(
      get(
        'HORÁRIO/ESCALA',
        'HORARIO/ESCALA',
        'HORÁRIO',
        'HORARIO',
        'ESCALA'
      )
    ).trim();


  if (
    !name
    &&
    !cpf
    &&
    !bpo
    &&
    !operation
  ) {

    return null;

  }


  const missing =
    [];


  if (!name) {

    missing.push(
      'NOME'
    );

  }


  if (
    !cpf
    ||
    cpf.length !==
    11
  ) {

    missing.push(
      'CPF válido'
    );

  }


  if (!birthDate) {

    missing.push(
      'DATA DE NASCIMENTO'
    );

  }


  if (!bpo) {

    missing.push(
      'BPO'
    );

  }


  if (!admissionDate) {

    missing.push(
      'DATA DE ADMISSÃO'
    );

  }


  if (!operation) {

    missing.push(
      'HUB/OPERAÇÃO'
    );

  }


  if (!schedule) {

    missing.push(
      'HORÁRIO/ESCALA'
    );

  }


  if (
    missing.length
  ) {

    throw new Error(
      `Linha ${lineNumber}: faltando ${missing.join(', ')}.`
    );

  }


  return {

    name,

    cpf,

    birth_date:
      birthDate,

    bpo,

    admission_date:
      admissionDate,

    email,

    phone,

    operation,

    schedule

  };

}


function downloadImportTemplate() {

  if (
    typeof XLSX ===
    'undefined'
  ) {

    alert(
      'Biblioteca XLSX não carregada.'
    );

    return;

  }


  const headers = [[

    'NOME',

    'CPF',

    'DATA DE NASCIMENTO',

    'BPO',

    'DATA DE ADMISSÃO',

    'EMAIL',

    'TELEFONE',

    'HUB/OPERAÇÃO',

    'HORÁRIO/ESCALA'

  ]];


  const instructions = [

    [
      'RH JOURNEY - INSTRUÇÕES'
    ],

    [
      'Preencha uma linha por colaborador.'
    ],

    [
      'CPF deve conter 11 dígitos.'
    ],

    [
      'Datas preferencialmente no formato DD/MM/AAAA.'
    ],

    [
      'HUB/OPERAÇÃO deve existir previamente no sistema.'
    ],

    [
      'HORÁRIO/ESCALA será usado para identificar o período quando a operação usar filtro por período.'
    ]

  ];


  const wb =
    XLSX.utils
      .book_new();


  const wsImport =
    XLSX.utils
      .aoa_to_sheet(
        headers
      );


  const wsInstructions =
    XLSX.utils
      .aoa_to_sheet(
        instructions
      );


  wsImport['!cols'] = [

    {
      wch: 32
    },

    {
      wch: 16
    },

    {
      wch: 20
    },

    {
      wch: 18
    },

    {
      wch: 20
    },

    {
      wch: 32
    },

    {
      wch: 18
    },

    {
      wch: 22
    },

    {
      wch: 24
    }

  ];


  XLSX.utils
    .book_append_sheet(
      wb,
      wsImport,
      'IMPORTAÇÃO'
    );


  XLSX.utils
    .book_append_sheet(
      wb,
      wsInstructions,
      'INSTRUÇÕES'
    );


  XLSX.writeFile(
    wb,
    'Modelo_Importacao_RH_Journey.xlsx'
  );

}


async function startJourney(
  employmentId
) {

  if (
    !confirm(
      'Iniciar a Jornada deste colaborador agora?'
    )
  ) {

    return;

  }


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

    alert(
      error.message
    );

    return;

  }


  alert(
    'Jornada iniciada com sucesso.'
  );


  await loadNewEmployeesPage();

}


async function deleteEmployee(
  employmentId
) {

  if (
    !confirm(
      'Excluir permanentemente este colaborador e os dados vinculados? Esta ação não poderá ser desfeita.'
    )
  ) {

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
              employment_id:
                employmentId
            }
          }
        );


    if (error) {

      throw error;

    }


    if (
      data?.error
    ) {

      throw new Error(
        data.error
      );

    }


    alert(
      'Colaborador excluído.'
    );


    await loadNewEmployeesPage();

  }

  catch (error) {

    alert(
      error.message
      ||
      'Não foi possível excluir o colaborador.'
    );

  }

}


// ============================================================
// JORNADAS
// ============================================================

async function loadJourneysPage() {

  if (
    currentProfile.role ===
    'EMPLOYEE'
  ) {

    return loadEmployeeJourneys();

  }


  if (
    currentProfile.role ===
    'LEADER'
  ) {

    return loadLeaderJourneys();

  }


  return loadManagementJourneys();

}


async function loadManagementJourneys() {

  const {
    data,
    error
  } =
    await journeySupabase
      .from('employments')
      .select(`
        id,
        status,
        leader_id,
        admission_date,
        period_id,

        people (
          id,
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
      .in(
        'status',
        [
          'IN_JOURNEY',
          'COMPLETED'
        ]
      )
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
    data ||
    [];


  pageContent.innerHTML = `

    <section class="dashboard-panel">

      <div class="panel-header">

        <div>

          <h3>
            Jornadas
          </h3>

          <p>
            ${journeysCache.length}
            registro(s) em acompanhamento ou concluídos.
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
                Operação
              </th>

              <th>
                BPO
              </th>

              <th>
                Líder atual
              </th>

              <th>
                Etapa
              </th>

              <th>
                Status
              </th>

            </tr>

          </thead>


          <tbody>

            ${
              journeysCache.length

                ? journeysCache
                    .map(
                      renderManagementJourneyRow
                    )
                    .join('')

                : `

                    <tr>
                      <td colspan="6">
                        Nenhuma Jornada encontrada.
                      </td>
                    </tr>

                  `
            }

          </tbody>

        </table>

      </div>

    </section>

  `;

}


function renderManagementJourneyRow(
  employment
) {

  const person =
    relationObject(
      employment.people
    );


  const operation =
    relationObject(
      employment.operations
    );


  const bpo =
    relationObject(
      employment.bpos
    );


  const leader =
    relationObject(
      employment.leader
    );


  const journey =
    getEmploymentJourney(
      employment
    );


  const currentCheckpoint =
    getCurrentCheckpoint(
      journey
    );


  return `

    <tr>

      <td>

        <strong>
          ${escapeHTML(
            person?.full_name ||
            '-'
          )}
        </strong>

        <br>

        <small>
          ${formatCPF(
            person?.cpf ||
            ''
          )}
        </small>

      </td>


      <td>
        ${escapeHTML(
          operation?.name ||
          '-'
        )}
      </td>


      <td>
        ${escapeHTML(
          bpo?.name ||
          '-'
        )}
      </td>


      <td>

        ${
          leader

            ? escapeHTML(
                leader.full_name ||
                '-'
              )

            : `

                <span class="assessment-pill danger">
                  ⚠ Sem líder
                </span>

              `
        }

      </td>


      <td>
        ${escapeHTML(
          currentCheckpoint?.checkpoint ||
          '-'
        )}
      </td>


      <td>

        ${
          employment.status ===
          'COMPLETED'

            ? `

                <span class="assessment-pill success">
                  Concluída
                </span>

              `

            : `

                <span class="assessment-pill warning">
                  Em andamento
                </span>

              `
        }

      </td>

    </tr>

  `;

}


// ============================================================
// JORNADAS - LÍDER
// ============================================================

async function loadLeaderJourneys() {

  const {
    data,
    error
  } =
    await journeySupabase
      .from('employments')
      .select(`
        id,
        status,
        leader_id,
        admission_date,
        period_id,

        people (
          id,
          full_name,
          cpf
        ),

        operations (
          id,
          name
        ),

        period:operation_periods!employments_period_id_fkey (
          id,
          name
        ),

        leader:profiles!employments_leader_id_fkey (
          id,
          full_name
        ),

        journeys (
          id,
          status,

          journey_checkpoints (
            id,
            checkpoint,
            opens_at,
            due_at
          )
        )
      `)
      .in(
        'status',
        [
          'IN_JOURNEY',
          'COMPLETED'
        ]
      )
      .order(
        'admission_date',
        {
          ascending: false
        }
      );


  if (error) {

    throw error;

  }


  employmentsCache =
    data ||
    [];


  const mine =
    employmentsCache.filter(
      e =>
        e.leader_id ===
        currentProfile.id
    );


  const unassigned =
    employmentsCache.filter(
      e =>
        !e.leader_id
        &&
        e.status !==
        'COMPLETED'
    );


  const others =
    employmentsCache.filter(
      e =>
        e.leader_id
        &&
        e.leader_id !==
        currentProfile.id
        &&
        e.status !==
        'COMPLETED'
    );


  pageContent.innerHTML = `

    <div class="metric-grid">

      ${metricCard(
        'Meus colaboradores',
        mine.length,
        'Sua responsabilidade atual'
      )}

      ${metricCard(
        'A identificar',
        unassigned.length,
        'Sem liderança definida'
      )}

      ${metricCard(
        'Outros líderes',
        others.length,
        'Você pode assumir se necessário'
      )}

    </div>


    <section class="dashboard-panel">

      <div class="panel-header">

        <div>

          <h3>
            Colaboradores da sua operação
          </h3>

          <p>
            Assuma um colaborador para passar a ser o líder
            responsável pelas próximas avaliações.
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
                Operação
              </th>

              <th>
                Período
              </th>

              <th>
                Líder atual
              </th>

              <th>
                Etapa
              </th>

              <th>
                Ação
              </th>

            </tr>

          </thead>


          <tbody>

            ${
              employmentsCache.length

                ? employmentsCache
                    .map(
                      renderLeaderJourneyRow
                    )
                    .join('')

                : `

                    <tr>
                      <td colspan="6">
                        Nenhum colaborador visível no seu escopo.
                      </td>
                    </tr>

                  `
            }

          </tbody>

        </table>

      </div>

    </section>

  `;


  document
    .querySelectorAll(
      '[data-claim-employment]'
    )
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () =>
            claimEmployment(
              button.dataset.claimEmployment
            )
        );

      }
    );

}


function renderLeaderJourneyRow(
  employment
) {

  const person =
    relationObject(
      employment.people
    );


  const operation =
    relationObject(
      employment.operations
    );


  const period =
    relationObject(
      employment.period
    );


  const leader =
    relationObject(
      employment.leader
    );


  const journey =
    getEmploymentJourney(
      employment
    );


  const checkpoint =
    getCurrentCheckpoint(
      journey
    );


  const isMine =
    employment.leader_id ===
    currentProfile.id;


  const completed =
    employment.status ===
    'COMPLETED';


  let action = `

    <span class="assessment-pill success">
      Meu colaborador
    </span>

  `;


  if (
    !isMine
    &&
    !completed
  ) {

    action = `

      <button
        class="primary-action-button"
        data-claim-employment="${employment.id}"
        type="button"
      >
        Assumir responsabilidade
      </button>

    `;

  }

  else if (completed) {

    action = `

      <span class="assessment-pill muted">
        Concluído
      </span>

    `;

  }


  return `

    <tr>

      <td>

        <strong>
          ${escapeHTML(
            person?.full_name ||
            '-'
          )}
        </strong>

        <br>

        <small>
          ${formatCPF(
            person?.cpf ||
            ''
          )}
        </small>

      </td>


      <td>
        ${escapeHTML(
          operation?.name ||
          '-'
        )}
      </td>


      <td>
        ${escapeHTML(
          period?.name ||
          '-'
        )}
      </td>


      <td>

        ${
          leader

            ? escapeHTML(
                leader.full_name ||
                '-'
              )

            : `

                <span class="assessment-pill danger">
                  ⚠ Sem líder
                </span>

              `
        }

      </td>


      <td>
        ${escapeHTML(
          checkpoint?.checkpoint ||
          '-'
        )}
      </td>


      <td>
        ${action}
      </td>

    </tr>

  `;

}


async function claimEmployment(
  employmentId
) {

  const employment =
    employmentsCache.find(
      item =>
        item.id ===
        employmentId
    );


  const person =
    relationObject(
      employment?.people
    );


  const currentLeader =
    relationObject(
      employment?.leader
    );


  const message =
    currentLeader

      ? `${person?.full_name || 'Este colaborador'} está atualmente com ${currentLeader.full_name}.

Deseja assumir a responsabilidade a partir de agora?

O histórico anterior será preservado.`

      : `Deseja assumir ${person?.full_name || 'este colaborador'} como sua responsabilidade atual?`;


  if (
    !confirm(
      message
    )
  ) {

    return;

  }


  const {
    error
  } =
    await journeySupabase
      .rpc(
        'set_employment_leader',
        {

          p_employment_id:
            employmentId,

          p_new_leader_id:
            currentProfile.id,

          p_source:
            'LEADER_CLAIMED',

          p_reason:
            currentLeader

              ? 'Responsabilidade assumida pelo líder atual.'

              : 'Liderança identificada pelo próprio líder.'

        }
      );


  if (error) {

    alert(
      error.message
    );

    return;

  }


  alert(
    'Responsabilidade atualizada com sucesso.'
  );


  await loadLeaderJourneys();

}


// ============================================================
// JORNADA DO COLABORADOR
// ============================================================

async function loadEmployeeJourneys() {

  const {
    data,
    error
  } =
    await journeySupabase
      .from('employments')
      .select(`
        id,
        status,
        leader_id,
        admission_date,

        people (
          full_name
        ),

        operations (
          name
        ),

        leader:profiles!employments_leader_id_fkey (
          id,
          full_name
        ),

        journeys (
          id,
          status,
          started_at,

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


  const employment =
    (
      data ||
      []
    )[0];


  if (!employment) {

    pageContent.innerHTML =
      renderEmpty(
        'Nenhuma Jornada encontrada para seu acesso.'
      );

    return;

  }


  const journey =
    getEmploymentJourney(
      employment
    );


  if (!journey) {

    pageContent.innerHTML =
      renderEmpty(
        'Sua Jornada ainda não foi iniciada.'
      );

    return;

  }


  const leader =
    relationObject(
      employment.leader
    );


  const checkpoints =
    relationArray(
      journey.journey_checkpoints
    )
      .slice()
      .sort(
        (
          a,
          b
        ) =>

          (
            CHECKPOINT_ORDER[
              a.checkpoint
            ]
            ||
            999
          )

          -

          (
            CHECKPOINT_ORDER[
              b.checkpoint
            ]
            ||
            999
          )
      );


  pageContent.innerHTML = `

    <section class="dashboard-panel">

      <div class="panel-header">

        <div>

          <h3>
            Minha Jornada
          </h3>

          <p>
            Liderança atual:
            ${escapeHTML(
              leader?.full_name
              ||
              'Ainda não identificada'
            )}
          </p>

        </div>

      </div>


      <div class="assessment-checkpoints">

        ${
          checkpoints
            .map(
              cp => `

                <div class="assessment-checkpoint">

                  <b class="checkpoint-code">
                    ${escapeHTML(
                      cp.checkpoint
                    )}
                  </b>

                  <div>

                    <strong>
                      ${checkpointStateLabel(
                        cp
                      )}
                    </strong>

                    <small>
                      Prazo:
                      ${formatDate(
                        cp.due_at
                      )}
                    </small>

                  </div>

                </div>

              `
            )
            .join('')
        }

      </div>

    </section>

  `;

}


// ============================================================
// PENDÊNCIAS
// ============================================================

async function loadPendingPage() {

  if (
    currentProfile.role ===
    'EMPLOYEE'
  ) {

    pageContent.innerHTML =
      renderEmpty(
        'Você não possui acesso a esta página.'
      );

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
        status,
        leader_id,

        people (
          full_name
        ),

        operations (
          name
        ),

        leader:profiles!employments_leader_id_fkey (
          full_name
        ),

        journeys (
          id,
          status,

          journey_checkpoints (
            id,
            checkpoint,
            opens_at,
            due_at
          )
        )
      `)
      .eq(
        'status',
        'IN_JOURNEY'
      );


  if (error) {

    throw error;

  }


  const rows =
    data ||
    [];


  const checkpointIds =
    collectCheckpointIds(
      rows
    );


  const submissions =
    await fetchSubmissions(
      checkpointIds
    );


  const now =
    new Date();


  const points =
    [];


  rows.forEach(
    employment => {

      const person =
        relationObject(
          employment.people
        );


      const operation =
        relationObject(
          employment.operations
        );


      const leader =
        relationObject(
          employment.leader
        );


      if (
        !employment.leader_id
      ) {

        points.push({

          employee:
            person?.full_name,

          operation:
            operation?.name,

          type:
            'NO_LEADER',

          detail:
            'Liderança ainda não identificada.'

        });

      }


      const journey =
        getEmploymentJourney(
          employment
        );


      relationArray(
        journey?.journey_checkpoints
      )
        .forEach(
          cp => {

            if (
              !cp.opens_at
              ||
              new Date(
                cp.opens_at
              )
              >
              now
            ) {

              return;

            }


            const empSub =
              submissions.find(
                s =>
                  s.checkpoint_id ===
                  cp.id
                  &&
                  s.respondent_type ===
                  'EMPLOYEE'
                  &&
                  s.status ===
                  'SUBMITTED'
              );


            const leaderSub =
              submissions.find(
                s =>
                  s.checkpoint_id ===
                  cp.id
                  &&
                  s.respondent_type ===
                  'LEADER'
                  &&
                  s.status ===
                  'SUBMITTED'
              );


            if (
              cp.due_at
              &&
              new Date(
                cp.due_at
              )
              <
              now
              &&
              !empSub
            ) {

              points.push({

                employee:
                  person?.full_name,

                operation:
                  operation?.name,

                type:
                  'EMPLOYEE_OVERDUE',

                detail:
                  `${cp.checkpoint}: avaliação do colaborador ainda não concluída.`

              });

            }


            if (
              employment.leader_id
              &&
              cp.due_at
              &&
              new Date(
                cp.due_at
              )
              <
              now
              &&
              !leaderSub
            ) {

              points.push({

                employee:
                  person?.full_name,

                operation:
                  operation?.name,

                type:
                  'LEADER_OVERDUE',

                detail:
                  `${cp.checkpoint}: avaliação da liderança ainda não concluída (${leader?.full_name || 'líder atual'}).`

              });

            }

          }
        );

    }
  );


  pageContent.innerHTML = `

    <section class="dashboard-panel">

      <div class="panel-header">

        <div>

          <h3>
            ⚠️ Pontos que exigem atuação
          </h3>

          <p>
            Visão operacional para acompanhamento.
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
                Operação
              </th>

              <th>
                Tipo
              </th>

              <th>
                Detalhe
              </th>

            </tr>

          </thead>


          <tbody>

            ${
              points.length

                ? points
                    .map(
                      p => `

                        <tr>

                          <td>
                            ${escapeHTML(
                              p.employee ||
                              '-'
                            )}
                          </td>

                          <td>
                            ${escapeHTML(
                              p.operation ||
                              '-'
                            )}
                          </td>

                          <td>
                            ${pendingBadge(
                              p.type
                            )}
                          </td>

                          <td>
                            ${escapeHTML(
                              p.detail
                            )}
                          </td>

                        </tr>

                      `
                    )
                    .join('')

                : `

                    <tr>
                      <td colspan="4">
                        Nenhuma pendência encontrada.
                      </td>
                    </tr>

                  `
            }

          </tbody>

        </table>

      </div>

    </section>

  `;

}


function pendingBadge(
  type
) {

  if (
    type ===
    'NO_LEADER'
  ) {

    return `

      <span class="assessment-pill danger">
        Sem líder
      </span>

    `;

  }


  if (
    type ===
    'LEADER_OVERDUE'
  ) {

    return `

      <span class="assessment-pill warning">
        Liderança
      </span>

    `;

  }


  return `

    <span class="assessment-pill warning">
      Colaborador
    </span>

  `;

}


// ============================================================
// INDICADORES REAIS
// ============================================================

async function loadIndicatorsPage() {

  const {
    data: employments,
    error: empError
  } =
    await journeySupabase
      .from('employments')
      .select(`
        id,
        status,
        leader_id,
        admission_date,

        people (
          full_name
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
        ),

        leader:profiles!employments_leader_id_fkey (
          id,
          full_name
        ),

        journeys (
          id,
          status,

          journey_checkpoints (
            id,
            checkpoint,
            opens_at,
            due_at
          )
        )
      `)
      .in(
        'status',
        [
          'IN_JOURNEY',
          'COMPLETED'
        ]
      )
      .order(
        'admission_date',
        {
          ascending: false
        }
      );


  if (empError) {

    throw empError;

  }


  const rows =
    employments ||
    [];


  const checkpointIds =
    collectCheckpointIds(
      rows
    );


  const submissions =
    await fetchSubmissions(
      checkpointIds
    );


  let answers =
    [];


  if (
    submissions.length
  ) {

    const submissionIds =
      submissions.map(
        s =>
          s.id
      );


    const {
      data: answerData,
      error: answerError
    } =
      await journeySupabase
        .from(
          'journey_assessment_answers'
        )
        .select(`
          submission_id,
          numeric_value,
          text_value,
          boolean_value,
          option_value,

          journey_assessment_questions (
            id,
            dimension,
            question_type
          ),

          journey_assessment_submissions (
            id,
            checkpoint_id,
            respondent_type,
            status
          )
        `)
        .in(
          'submission_id',
          submissionIds
        );


    if (answerError) {

      throw answerError;

    }


    answers =
      answerData ||
      [];

  }


  const now =
    new Date();


  const active =
    rows.filter(
      r =>
        r.status ===
        'IN_JOURNEY'
    );


  const completed =
    rows.filter(
      r =>
        r.status ===
        'COMPLETED'
    );


  const noLeader =
    active.filter(
      r =>
        !r.leader_id
    );


  const openedCheckpoints =
    [];


  rows.forEach(
    employment => {

      const journey =
        getEmploymentJourney(
          employment
        );


      relationArray(
        journey?.journey_checkpoints
      )
        .forEach(
          cp => {

            if (
              cp.opens_at
              &&
              new Date(
                cp.opens_at
              )
              <=
              now
            ) {

              openedCheckpoints.push({

                employment,

                checkpoint:
                  cp

              });

            }

          }
        );

    }
  );


  const employeeSubmitted =
    openedCheckpoints.filter(
      item =>
        submissions.some(
          s =>
            s.checkpoint_id ===
            item.checkpoint.id
            &&
            s.respondent_type ===
            'EMPLOYEE'
            &&
            s.status ===
            'SUBMITTED'
        )
    ).length;


  const leaderEligible =
    openedCheckpoints.filter(
      item =>
        !!item.employment.leader_id
    );


  const leaderSubmitted =
    leaderEligible.filter(
      item =>
        submissions.some(
          s =>
            s.checkpoint_id ===
            item.checkpoint.id
            &&
            s.respondent_type ===
            'LEADER'
            &&
            s.status ===
            'SUBMITTED'
        )
    ).length;


  const employeeAdherence =
    percent(
      employeeSubmitted,
      openedCheckpoints.length
    );


  const leaderAdherence =
    percent(
      leaderSubmitted,
      leaderEligible.length
    );


  const numericAnswers =
    answers.filter(
      a =>
        a.numeric_value !==
        null
        &&
        a.numeric_value !==
        undefined
        &&
        relationObject(
          a.journey_assessment_submissions
        )
          ?.status ===
        'SUBMITTED'
    );


  const employeeNumeric =
    numericAnswers.filter(
      a =>
        relationObject(
          a.journey_assessment_submissions
        )
          ?.respondent_type ===
        'EMPLOYEE'
    );


  const leaderNumeric =
    numericAnswers.filter(
      a =>
        relationObject(
          a.journey_assessment_submissions
        )
          ?.respondent_type ===
        'LEADER'
    );


  const employeeAverage =
    average(
      employeeNumeric.map(
        a =>
          Number(
            a.numeric_value
          )
      )
    );


  const leaderAverage =
    average(
      leaderNumeric.map(
        a =>
          Number(
            a.numeric_value
          )
      )
    );


  const checkpointSummary =
    buildCheckpointSummary(
      rows,
      submissions,
      answers,
      now
    );


  const dimensionSummary =
    buildDimensionSummary(
      answers
    );


  const attention =
    buildIndicatorAttention(
      rows,
      submissions,
      dimensionSummary,
      now
    );


  pageContent.innerHTML = `

    <div class="metric-grid indicators-top-grid">

      ${metricCard(
        'Jornadas ativas',
        active.length,
        'Em acompanhamento'
      )}

      ${metricCard(
        'Sem liderança',
        noLeader.length,
        'Ativos sem líder atual'
      )}

      ${metricCard(
        'Adesão colaboradores',
        `${employeeAdherence}%`,
        `${employeeSubmitted}/${openedCheckpoints.length} checkpoints respondidos`
      )}

      ${metricCard(
        'Adesão lideranças',
        `${leaderAdherence}%`,
        `${leaderSubmitted}/${leaderEligible.length} checkpoints respondidos`
      )}

      ${metricCard(
        'Média colaboradores',
        formatAverage(
          employeeAverage
        ),
        'Escala média 1 a 5'
      )}

      ${metricCard(
        'Média lideranças',
        formatAverage(
          leaderAverage
        ),
        'Escala média 1 a 5'
      )}

      ${metricCard(
        'Concluídas',
        completed.length,
        'Jornadas encerradas'
      )}

    </div>


    <section class="dashboard-panel">

      <div class="panel-header">

        <div>

          <h3>
            Resumo por checkpoint
          </h3>

          <p>
            Aderência e média das respostas escala 1–5.
          </p>

        </div>

      </div>


      <div class="table-wrapper">

        <table class="journey-table">

          <thead>

            <tr>

              <th>
                Checkpoint
              </th>

              <th>
                Colaborador
              </th>

              <th>
                Liderança
              </th>

              <th>
                Média Colab.
              </th>

              <th>
                Média Líder
              </th>

              <th>
                Gap
              </th>

            </tr>

          </thead>


          <tbody>

            ${
              checkpointSummary
                .map(
                  row => `

                    <tr>

                      <td>

                        <strong>
                          ${row.checkpoint}
                        </strong>

                      </td>


                      <td>

                        ${row.employeePercent}%

                        <small>
                          (${row.employeeSubmitted}/${row.opened})
                        </small>

                      </td>


                      <td>

                        ${
                          row.leaderEligible

                            ? `${row.leaderPercent}% <small>(${row.leaderSubmitted}/${row.leaderEligible})</small>`

                            : '—'
                        }

                      </td>


                      <td>
                        ${formatAverage(
                          row.employeeAverage
                        )}
                      </td>


                      <td>
                        ${formatAverage(
                          row.leaderAverage
                        )}
                      </td>


                      <td>
                        ${formatGap(
                          row.gap
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

    </section>


    <section class="dashboard-panel">

      <div class="panel-header">

        <div>

          <h3>
            Resumo por dimensão
          </h3>

          <p>
            Onde a experiência está melhor e onde começa a aparecer risco.
          </p>

        </div>

      </div>


      <div class="dimension-grid">

        ${
          dimensionSummary.length

            ? dimensionSummary
                .map(
                  d => `

                    <div
                      class="dimension-card ${
                        d.average !==
                        null
                        &&
                        d.average < 3

                          ? 'attention'

                          : ''
                      }"
                    >

                      <div>

                        <strong>
                          ${escapeHTML(
                            prettyDimension(
                              d.dimension
                            )
                          )}
                        </strong>

                        <span>
                          ${d.count}
                          resposta(s)
                        </span>

                      </div>


                      <b>
                        ${formatAverage(
                          d.average
                        )}
                      </b>

                    </div>

                  `
                )
                .join('')

            : `

                <div class="assessment-empty">
                  Ainda não existem respostas de escala suficientes para calcular dimensões.
                </div>

              `
        }

      </div>

    </section>


    <section class="dashboard-panel">

      <div class="panel-header">

        <div>

          <h3>
            ⚠ Pontos que exigem atenção
          </h3>

          <p>
            Alertas derivados dos dados atuais da Jornada.
          </p>

        </div>

      </div>


      <div class="attention-list">

        ${
          attention.length

            ? attention
                .map(
                  item => `

                    <div class="attention-item">

                      <span>
                        !
                      </span>

                      <div>

                        <strong>
                          ${escapeHTML(
                            item.title
                          )}
                        </strong>

                        <p>
                          ${escapeHTML(
                            item.detail
                          )}
                        </p>

                      </div>

                    </div>

                  `
                )
                .join('')

            : `

                <div class="success-box">
                  Nenhum alerta crítico identificado com os dados atuais.
                </div>

              `
        }

      </div>

    </section>

  `;

}


async function fetchSubmissions(
  checkpointIds
) {

  if (
    !checkpointIds.length
  ) {

    return [];

  }


  const {
    data,
    error
  } =
    await journeySupabase
      .from(
        'journey_assessment_submissions'
      )
      .select(`
        id,
        checkpoint_id,
        employment_id,
        respondent_type,
        status,
        submitted_at,
        leader_snapshot_id
      `)
      .in(
        'checkpoint_id',
        checkpointIds
      );


  if (error) {

    throw error;

  }


  return data ||
    [];

}


function buildCheckpointSummary(
  rows,
  submissions,
  answers,
  now
) {

  return [
    'D1',
    'D7',
    'D15',
    'D30',
    'D45',
    'D90'
  ]
    .map(
      code => {

        const relevant =
          [];


        rows.forEach(
          employment => {

            const journey =
              getEmploymentJourney(
                employment
              );


            relationArray(
              journey?.journey_checkpoints
            )
              .forEach(
                cp => {

                  if (
                    cp.checkpoint ===
                    code
                    &&
                    cp.opens_at
                    &&
                    new Date(
                      cp.opens_at
                    )
                    <=
                    now
                  ) {

                    relevant.push({

                      employment,

                      checkpoint:
                        cp

                    });

                  }

                }
              );

          }
        );


        const opened =
          relevant.length;


        const employeeSubmitted =
          relevant.filter(
            item =>
              submissions.some(
                s =>
                  s.checkpoint_id ===
                  item.checkpoint.id
                  &&
                  s.respondent_type ===
                  'EMPLOYEE'
                  &&
                  s.status ===
                  'SUBMITTED'
              )
          ).length;


        const leaderRows =
          relevant.filter(
            item =>
              !!item.employment.leader_id
          );


        const leaderSubmitted =
          leaderRows.filter(
            item =>
              submissions.some(
                s =>
                  s.checkpoint_id ===
                  item.checkpoint.id
                  &&
                  s.respondent_type ===
                  'LEADER'
                  &&
                  s.status ===
                  'SUBMITTED'
              )
          ).length;


        const relevantIds =
          relevant.map(
            item =>
              item.checkpoint.id
          );


        const empValues =
          answers
            .filter(
              a => {

                const submission =
                  relationObject(
                    a.journey_assessment_submissions
                  );


                return (
                  relevantIds.includes(
                    submission?.checkpoint_id
                  )
                  &&
                  submission?.respondent_type ===
                  'EMPLOYEE'
                  &&
                  submission?.status ===
                  'SUBMITTED'
                  &&
                  a.numeric_value !==
                  null
                  &&
                  a.numeric_value !==
                  undefined
                );

              }
            )
            .map(
              a =>
                Number(
                  a.numeric_value
                )
            );


        const leaderValues =
          answers
            .filter(
              a => {

                const submission =
                  relationObject(
                    a.journey_assessment_submissions
                  );


                return (
                  relevantIds.includes(
                    submission?.checkpoint_id
                  )
                  &&
                  submission?.respondent_type ===
                  'LEADER'
                  &&
                  submission?.status ===
                  'SUBMITTED'
                  &&
                  a.numeric_value !==
                  null
                  &&
                  a.numeric_value !==
                  undefined
                );

              }
            )
            .map(
              a =>
                Number(
                  a.numeric_value
                )
            );


        const employeeAverage =
          average(
            empValues
          );


        const leaderAverage =
          average(
            leaderValues
          );


        const gap =
          employeeAverage !==
          null
          &&
          leaderAverage !==
          null

            ? employeeAverage -
              leaderAverage

            : null;


        return {

          checkpoint:
            code,

          opened,

          employeeSubmitted,

          employeePercent:
            percent(
              employeeSubmitted,
              opened
            ),

          leaderEligible:
            leaderRows.length,

          leaderSubmitted,

          leaderPercent:
            percent(
              leaderSubmitted,
              leaderRows.length
            ),

          employeeAverage,

          leaderAverage,

          gap

        };

      }
    );

}


function buildDimensionSummary(
  answers
) {

  const map =
    new Map();


  answers.forEach(
    answer => {

      const submission =
        relationObject(
          answer.journey_assessment_submissions
        );


      const question =
        relationObject(
          answer.journey_assessment_questions
        );


      if (
        submission?.status !==
        'SUBMITTED'
      ) {

        return;

      }


      if (
        answer.numeric_value ===
        null
        ||
        answer.numeric_value ===
        undefined
      ) {

        return;

      }


      const dimension =
        question?.dimension ||
        'GERAL';


      if (
        !map.has(
          dimension
        )
      ) {

        map.set(
          dimension,
          []
        );

      }


      map
        .get(
          dimension
        )
        .push(
          Number(
            answer.numeric_value
          )
        );

    }
  );


  return [
    ...map.entries()
  ]
    .map(
      (
        [
          dimension,
          values
        ]
      ) => ({

        dimension,

        average:
          average(
            values
          ),

        count:
          values.length

      })
    )
    .sort(
      (
        a,
        b
      ) =>

        (
          a.average
          ??
          99
        )

        -

        (
          b.average
          ??
          99
        )
    );

}


function buildIndicatorAttention(
  rows,
  submissions,
  dimensionSummary,
  now
) {

  const alerts =
    [];


  const active =
    rows.filter(
      r =>
        r.status ===
        'IN_JOURNEY'
    );


  const noLeader =
    active.filter(
      r =>
        !r.leader_id
    );


  if (
    noLeader.length
  ) {

    alerts.push({

      title:
        `${noLeader.length} colaborador(es) sem líder`,

      detail:
        'A liderança ainda não foi identificada para jornadas ativas.'

    });

  }


  let overdueLeader =
    0;


  let overdueEmployee =
    0;


  active.forEach(
    employment => {

      const journey =
        getEmploymentJourney(
          employment
        );


      relationArray(
        journey?.journey_checkpoints
      )
        .forEach(
          cp => {

            if (
              !cp.due_at
              ||
              new Date(
                cp.due_at
              )
              >=
              now
            ) {

              return;

            }


            const empDone =
              submissions.some(
                s =>
                  s.checkpoint_id ===
                  cp.id
                  &&
                  s.respondent_type ===
                  'EMPLOYEE'
                  &&
                  s.status ===
                  'SUBMITTED'
              );


            const leaderDone =
              submissions.some(
                s =>
                  s.checkpoint_id ===
                  cp.id
                  &&
                  s.respondent_type ===
                  'LEADER'
                  &&
                  s.status ===
                  'SUBMITTED'
              );


            if (!empDone) {

              overdueEmployee++;

            }


            if (
              employment.leader_id
              &&
              !leaderDone
            ) {

              overdueLeader++;

            }

          }
        );

    }
  );


  if (
    overdueEmployee
  ) {

    alerts.push({

      title:
        `${overdueEmployee} avaliação(ões) de colaborador em atraso`,

      detail:
        'Há checkpoints vencidos sem envio do colaborador.'

    });

  }


  if (
    overdueLeader
  ) {

    alerts.push({

      title:
        `${overdueLeader} avaliação(ões) de liderança em atraso`,

      detail:
        'Há checkpoints vencidos com líder definido, mas sem avaliação da liderança.'

    });

  }


  dimensionSummary
    .filter(
      d =>
        d.average !==
        null
        &&
        d.average < 3
    )
    .forEach(
      d => {

        alerts.push({

          title:
            `${prettyDimension(
              d.dimension
            )} abaixo de 3,0`,

          detail:
            `Média atual de ${formatAverage(
              d.average
            )} na dimensão.`

        });

      }
    );


  return alerts;

}


// ============================================================
// CONFIGURAÇÕES
// ============================================================

async function loadSettingsPage() {

  if (
    currentProfile.role !==
    'ADMIN_RH'
  ) {

    pageContent.innerHTML =
      renderError(
        'Acesso restrito',
        'Configurações disponíveis apenas para ADMIN/RH.'
      );

    return;

  }


  const [
    regionalsResult,
    operationsResult,
    usersResult
  ] =
    await Promise.all([

      journeySupabase
        .from('regionals')
        .select(`
          id,
          name,
          active
        `)
        .order(
          'name'
        ),

      journeySupabase
        .from('operations')
        .select(`
          id,
          name,
          active,
          use_period_filter,
          regional_id,

          regionals (
            name
          )
        `)
        .order(
          'name'
        ),

      journeySupabase
        .from('profiles')
        .select(`
          id,
          full_name,
          role,
          corporate_email,
          active
        `)
        .in(
          'role',
          [
            'ADMIN_RH',
            'HR_MANAGER',
            'LEADER'
          ]
        )
        .order(
          'full_name'
        )

    ]);


  if (
    regionalsResult.error
  ) {

    throw regionalsResult.error;

  }


  if (
    operationsResult.error
  ) {

    throw operationsResult.error;

  }


  if (
    usersResult.error
  ) {

    throw usersResult.error;

  }


  regionalsCache =
    regionalsResult.data ||
    [];


  operationsCache =
    operationsResult.data ||
    [];


  corporateUsersCache =
    usersResult.data ||
    [];


  pageContent.innerHTML = `

    <div class="settings-grid">

      <button
        class="settings-card"
        data-settings-section="regionals"
        type="button"
      >

        <strong>
          Regionais
        </strong>

        <span>
          ${regionalsCache.length}
          cadastrada(s)
        </span>

      </button>


      <button
        class="settings-card"
        data-settings-section="operations"
        type="button"
      >

        <strong>
          Operações / HUBs
        </strong>

        <span>
          ${operationsCache.length}
          cadastrada(s)
        </span>

      </button>


      <button
        class="settings-card"
        data-settings-section="accesses"
        type="button"
      >

        <strong>
          Acessos Corporativos
        </strong>

        <span>
          ${corporateUsersCache.length}
          acesso(s)
        </span>

      </button>


      <button
        class="settings-card"
        data-settings-section="checkpoints"
        type="button"
      >

        <strong>
          Checkpoints
        </strong>

        <span>
          6 etapas: D1 → D90
        </span>

      </button>

    </div>


    <div
      id="settingsSection"
      style="margin-top:18px"
    ></div>

  `;


  document
    .querySelectorAll(
      '[data-settings-section]'
    )
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () =>
            renderSettingsSection(
              button.dataset
                .settingsSection
            )
        );

      }
    );


  renderSettingsSection(
    'regionals'
  );

}


function renderSettingsSection(
  section
) {

  const host =
    document.getElementById(
      'settingsSection'
    );


  if (!host) {

    return;

  }


  if (
    section ===
    'regionals'
  ) {

    host.innerHTML = `

      <section class="dashboard-panel">

        <div class="panel-header">

          <div>
            <h3>
              Regionais
            </h3>
          </div>

          <button
            class="primary-action-button"
            id="newRegional"
            type="button"
          >
            Nova Regional
          </button>

        </div>


        <div class="table-wrapper">

          <table class="journey-table">

            <thead>

              <tr>

                <th>
                  Regional
                </th>

                <th>
                  Status
                </th>

              </tr>

            </thead>


            <tbody>

              ${
                regionalsCache.length

                  ? regionalsCache
                      .map(
                        r => `

                          <tr>

                            <td>
                              ${escapeHTML(
                                r.name
                              )}
                            </td>

                            <td>
                              ${
                                r.active ===
                                false

                                  ? 'Inativa'

                                  : 'Ativa'
                              }
                            </td>

                          </tr>

                        `
                      )
                      .join('')

                  : `

                      <tr>
                        <td colspan="2">
                          Nenhuma regional.
                        </td>
                      </tr>

                    `
              }

            </tbody>

          </table>

        </div>

      </section>

    `;


    document
      .getElementById(
        'newRegional'
      )
      ?.addEventListener(
        'click',
        createRegional
      );


    return;

  }


  if (
    section ===
    'operations'
  ) {

    host.innerHTML = `

      <section class="dashboard-panel">

        <div class="panel-header">

          <div>
            <h3>
              Operações / HUBs
            </h3>
          </div>

          <button
            class="primary-action-button"
            id="newOperation"
            type="button"
          >
            Nova Operação
          </button>

        </div>


        <div class="table-wrapper">

          <table class="journey-table">

            <thead>

              <tr>

                <th>
                  Operação
                </th>

                <th>
                  Regional
                </th>

                <th>
                  Filtro por período
                </th>

                <th>
                  Status
                </th>

              </tr>

            </thead>


            <tbody>

              ${
                operationsCache.length

                  ? operationsCache
                      .map(
                        o => {

                          const regional =
                            relationObject(
                              o.regionals
                            );


                          return `

                            <tr>

                              <td>
                                ${escapeHTML(
                                  o.name
                                )}
                              </td>

                              <td>
                                ${escapeHTML(
                                  regional?.name ||
                                  '-'
                                )}
                              </td>

                              <td>
                                ${
                                  o.use_period_filter

                                    ? 'Sim'

                                    : 'Não'
                                }
                              </td>

                              <td>
                                ${
                                  o.active ===
                                  false

                                    ? 'Inativa'

                                    : 'Ativa'
                                }
                              </td>

                            </tr>

                          `;

                        }
                      )
                      .join('')

                  : `

                      <tr>
                        <td colspan="4">
                          Nenhuma operação.
                        </td>
                      </tr>

                    `
              }

            </tbody>

          </table>

        </div>

      </section>

    `;


    document
      .getElementById(
        'newOperation'
      )
      ?.addEventListener(
        'click',
        createOperation
      );


    return;

  }


  if (
    section ===
    'accesses'
  ) {

    host.innerHTML = `

      <section class="dashboard-panel">

        <div class="panel-header">

          <div>
            <h3>
              Acessos Corporativos
            </h3>
          </div>

          <button
            class="primary-action-button"
            id="newCorporateUser"
            type="button"
          >
            Novo acesso
          </button>

        </div>


        <div class="table-wrapper">

          <table class="journey-table">

            <thead>

              <tr>

                <th>
                  Usuário
                </th>

                <th>
                  E-mail
                </th>

                <th>
                  Perfil
                </th>

                <th>
                  Status
                </th>

              </tr>

            </thead>


            <tbody>

              ${
                corporateUsersCache.length

                  ? corporateUsersCache
                      .map(
                        u => `

                          <tr>

                            <td>
                              ${escapeHTML(
                                u.full_name ||
                                '-'
                              )}
                            </td>

                            <td>
                              ${escapeHTML(
                                u.corporate_email ||
                                '-'
                              )}
                            </td>

                            <td>
                              ${escapeHTML(
                                u.role ||
                                '-'
                              )}
                            </td>

                            <td>
                              ${
                                u.active ===
                                false

                                  ? 'Inativo'

                                  : 'Ativo'
                              }
                            </td>

                          </tr>

                        `
                      )
                      .join('')

                  : `

                      <tr>
                        <td colspan="4">
                          Nenhum acesso.
                        </td>
                      </tr>

                    `
              }

            </tbody>

          </table>

        </div>

      </section>

    `;


    document
      .getElementById(
        'newCorporateUser'
      )
      ?.addEventListener(
        'click',
        createCorporateUser
      );


    return;

  }


  host.innerHTML = `

    <section class="dashboard-panel">

      <div class="panel-header">

        <div>

          <h3>
            Checkpoints
          </h3>

          <p>
            D1, D7, D15, D30, D45 e D90.
          </p>

        </div>

      </div>

    </section>

  `;

}


async function createRegional() {

  const name =
    prompt(
      'Nome da nova Regional:'
    );


  if (
    !name?.trim()
  ) {

    return;

  }


  const {
    error
  } =
    await journeySupabase
      .from('regionals')
      .insert({

        name:
          name.trim(),

        active:
          true

      });


  if (error) {

    alert(
      error.message
    );

    return;

  }


  await loadSettingsPage();

}


async function createOperation() {

  if (
    !regionalsCache.length
  ) {

    alert(
      'Cadastre uma Regional antes.'
    );

    return;

  }


  const name =
    prompt(
      'Nome da nova Operação/HUB:'
    );


  if (
    !name?.trim()
  ) {

    return;

  }


  const options =
    regionalsCache
      .map(
        (
          r,
          i
        ) =>
          `${i + 1} - ${r.name}`
      )
      .join('\n');


  const selected =
    Number(
      prompt(
        `Escolha a Regional:

${options}`
      )
    );


  const regional =
    regionalsCache[
      selected - 1
    ];


  if (!regional) {

    alert(
      'Regional inválida.'
    );

    return;

  }


  const usePeriodFilter =
    confirm(
      'Esta operação utiliza filtro de responsabilidade por período/turno?'
    );


  const {
    error
  } =
    await journeySupabase
      .from('operations')
      .insert({

        name:
          name.trim(),

        regional_id:
          regional.id,

        use_period_filter:
          usePeriodFilter,

        active:
          true

      });


  if (error) {

    alert(
      error.message
    );

    return;

  }


  await loadSettingsPage();

}


async function createCorporateUser() {

  const fullName =
    prompt(
      'Nome completo:'
    );


  if (
    !fullName?.trim()
  ) {

    return;

  }


  const corporateEmail =
    prompt(
      'E-mail corporativo @empresa.com:'
    );


  if (
    !corporateEmail?.trim()
  ) {

    return;

  }


  const role =
    (
      prompt(
        'Perfil: LEADER, HR_MANAGER ou ADMIN_RH',
        'LEADER'
      )
      ||
      ''
    )
      .trim()
      .toUpperCase();


  if (
    ![
      'LEADER',
      'HR_MANAGER',
      'ADMIN_RH'
    ].includes(
      role
    )
  ) {

    alert(
      'Perfil inválido.'
    );

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
          'create-corporate-user',
          {
            body: {

              full_name:
                fullName.trim(),

              corporate_email:
                corporateEmail
                  .trim()
                  .toLowerCase(),

              role

            }
          }
        );


    if (error) {

      throw error;

    }


    if (
      data?.error
    ) {

      throw new Error(
        data.error
      );

    }


    alert(
      'Acesso corporativo criado.'
    );


    await loadSettingsPage();

  }

  catch (error) {

    alert(
      error.message
      ||
      'Não foi possível criar o acesso.'
    );

  }

}


// ============================================================
// UI / PERFIL / HELPERS
// ============================================================

function showPageLoading(
  message = 'Carregando...'
) {

  if (!pageContent) {

    return;

  }


  pageContent.innerHTML = `

    <div class="assessment-empty">

      <div class="loading-spinner">
      </div>

      <p>
        ${escapeHTML(
          message
        )}
      </p>

    </div>

  `;

}


function renderSidebarUser() {

  const name =
    currentProfile?.full_name
    ||
    currentUser?.email
    ||
    'Usuário';


  const role =
    roleLabel(
      currentProfile?.role
    );


  const avatar =
    getInitials(
      name
    );


  const nameSelectors = [

    '#sidebarUserName',

    '[data-user-name]',

    '.sidebar-user-name',

    '.user-name',

    '.profile-name',

    '.sidebar-profile strong'

  ];


  const roleSelectors = [

    '#sidebarUserRole',

    '[data-user-role]',

    '.sidebar-user-role',

    '.user-role',

    '.profile-role',

    '.sidebar-profile small'

  ];


  const avatarSelectors = [

    '#sidebarUserAvatar',

    '[data-user-avatar]',

    '.sidebar-user-avatar',

    '.user-avatar',

    '.profile-avatar'

  ];


  setFirstText(
    nameSelectors,
    name
  );


  setFirstText(
    roleSelectors,
    role
  );


  setFirstText(
    avatarSelectors,
    avatar
  );


  // Fallback específico para o rodapé atual
  const sidebar =
    document.querySelector(
      'aside, .sidebar, #sidebar, nav'
    )
    ||
    document.body;


  const all = [
    ...sidebar.querySelectorAll(
      '*'
    )
  ];


  const loadingNode =
    all.find(
      el =>
        el.children.length ===
        0
        &&
        el.textContent.trim() ===
        'Carregando...'
    );


  if (
    loadingNode
  ) {

    loadingNode.textContent =
      name;


    const parent =
      loadingNode.parentElement;


    if (parent) {

      const roleNode =
        [
          ...parent.children
        ]
          .find(
            el =>
              el !==
              loadingNode
              &&
              el.children.length ===
              0
              &&
              [
                '...',
                'Colaborador',
                'Liderança',
                'ADMIN / RH',
                'GESTOR DE RH'
              ].includes(
                el.textContent.trim()
              )
          );


      if (
        roleNode
      ) {

        roleNode.textContent =
          role;

      }

    }

  }


  const avatarCandidate =
    [
      ...sidebar.querySelectorAll(
        'div,span'
      )
    ]
      .find(
        el =>
          el.children.length ===
          0
          &&
          el.textContent.trim() ===
          'U'
          &&
          el.getBoundingClientRect().width
          <=
          70
          &&
          el.getBoundingClientRect().height
          <=
          70
      );


  if (
    avatarCandidate
  ) {

    avatarCandidate.textContent =
      avatar;

  }

}


function setFirstText(
  selectors,
  text
) {

  for (
    const selector
    of selectors
  ) {

    const el =
      document.querySelector(
        selector
      );


    if (el) {

      el.textContent =
        text;

      return true;

    }

  }


  return false;

}


function roleLabel(
  role
) {

  return {

    ADMIN_RH:
      'ADMIN / RH',

    HR_MANAGER:
      'GESTOR DE RH',

    LEADER:
      'LIDERANÇA',

    EMPLOYEE:
      'COLABORADOR'

  }[role]
  ||
  role
  ||
  '';

}


function metricCard(
  label,
  value,
  detail
) {

  return `

    <div class="metric-card">

      <small>
        ${escapeHTML(
          String(
            label
          )
        )}
      </small>

      <strong>
        ${escapeHTML(
          String(
            value
          )
        )}
      </strong>

      <span>
        ${escapeHTML(
          String(
            detail ||
            ''
          )
        )}
      </span>

    </div>

  `;

}


function quickAction(
  page,
  icon,
  title,
  description
) {

  return `

    <button
      class="quick-action-card"
      data-quick-page="${page}"
      type="button"
    >

      <span class="quick-action-icon">
        ${icon}
      </span>

      <div>

        <strong>
          ${escapeHTML(
            title
          )}
        </strong>

        <small>
          ${escapeHTML(
            description
          )}
        </small>

      </div>

    </button>

  `;

}


function bindQuickActions() {

  document
    .querySelectorAll(
      '[data-quick-page]'
    )
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () =>
            openPage(
              button.dataset.quickPage
            )
        );

      }
    );

}


function renderEmpty(
  message
) {

  return `

    <div class="assessment-empty">

      <h2>
        ${escapeHTML(
          message
        )}
      </h2>

    </div>

  `;

}


function renderError(
  title,
  message
) {

  return `

    <div class="system-error">

      <h2>
        ${escapeHTML(
          title
        )}
      </h2>

      <p>
        ${escapeHTML(
          message ||
          ''
        )}
      </p>

    </div>

  `;

}


function relationArray(
  value
) {

  if (!value) {

    return [];

  }


  return Array.isArray(
    value
  )

    ? value

    : [
        value
      ];

}


function relationObject(
  value
) {

  if (!value) {

    return null;

  }


  return Array.isArray(
    value
  )

    ? (
        value[0]
        ||
        null
      )

    : value;

}


function getEmploymentJourney(
  employment
) {

  const journeys =
    relationArray(
      employment?.journeys
    );


  return (

    journeys.find(
      j =>
        j.status ===
        'ACTIVE'
        ||
        j.status ===
        'IN_JOURNEY'
    )

    ||

    journeys[0]

    ||

    null

  );

}


function collectCheckpointIds(
  employments
) {

  const ids =
    [];


  (
    employments ||
    []
  )
    .forEach(
      employment => {

        const journey =
          getEmploymentJourney(
            employment
          );


        relationArray(
          journey?.journey_checkpoints
        )
          .forEach(
            cp => {

              ids.push(
                cp.id
              );

            }
          );

      }
    );


  return [
    ...new Set(
      ids
    )
  ];

}


function getCurrentCheckpoint(
  journey
) {

  if (!journey) {

    return null;

  }


  const checkpoints =
    relationArray(
      journey.journey_checkpoints
    )
      .slice()
      .sort(
        (
          a,
          b
        ) =>

          (
            CHECKPOINT_ORDER[
              a.checkpoint
            ]
            ||
            999
          )

          -

          (
            CHECKPOINT_ORDER[
              b.checkpoint
            ]
            ||
            999
          )
      );


  const now =
    new Date();


  return (

    checkpoints.find(
      cp =>
        cp.opens_at
        &&
        new Date(
          cp.opens_at
        )
        <=
        now
        &&
        (
          !cp.due_at
          ||
          new Date(
            cp.due_at
          )
          >=
          now
        )
    )

    ||

    [
      ...checkpoints
    ]
      .reverse()
      .find(
        cp =>
          cp.opens_at
          &&
          new Date(
            cp.opens_at
          )
          <=
          now
      )

    ||

    checkpoints[0]

    ||

    null

  );

}


function checkpointStateLabel(
  cp
) {

  const now =
    new Date();


  const opens =
    cp.opens_at

      ? new Date(
          cp.opens_at
        )

      : null;


  const due =
    cp.due_at

      ? new Date(
          cp.due_at
        )

      : null;


  if (
    opens
    &&
    now < opens
  ) {

    return 'Em breve';

  }


  if (
    due
    &&
    now > due
  ) {

    return 'Disponível / prazo original encerrado';

  }


  return 'Disponível';

}


function percent(
  part,
  total
) {

  return total

    ? Math.round(
        (
          part /
          total
        )
        *
        100
      )

    : 0;

}


function average(
  values
) {

  const valid =
    values.filter(
      v =>
        Number.isFinite(
          v
        )
    );


  return valid.length

    ? valid.reduce(
        (
          a,
          b
        ) =>
          a + b,
        0
      )
      /
      valid.length

    : null;

}


function formatAverage(
  value
) {

  if (
    value ===
    null
    ||
    value ===
    undefined
    ||
    Number.isNaN(
      value
    )
  ) {

    return '—';

  }


  return value
    .toLocaleString(
      'pt-BR',
      {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }
    );

}


function formatGap(
  value
) {

  if (
    value ===
    null
    ||
    value ===
    undefined
    ||
    Number.isNaN(
      value
    )
  ) {

    return '—';

  }


  const sign =
    value > 0

      ? '+'

      : '';


  const cls =
    Math.abs(
      value
    )
    >=
    1

      ? 'gap-alert'

      : '';


  return `

    <span class="${cls}">
      ${sign}${value.toLocaleString(
        'pt-BR',
        {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1
        }
      )}
    </span>

  `;

}


function prettyDimension(
  value
) {

  return String(
    value ||
    'GERAL'
  )
    .replaceAll(
      '_',
      ' '
    )
    .toLowerCase()
    .replace(
      /(^|\s)\S/g,
      c =>
        c.toUpperCase()
    );

}


function formatDate(
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

    return '-';

  }


  return date
    .toLocaleDateString(
      'pt-BR'
    );

}


function getInitials(
  name
) {

  return String(
    name ||
    '?'
  )
    .trim()
    .split(
      /\s+/
    )
    .filter(
      Boolean
    )
    .slice(
      0,
      2
    )
    .map(
      part =>
        part[0]
          ?.toUpperCase()
    )
    .join('')
    ||
    '?';

}


function escapeHTML(
  value
) {

  return String(
    value ??
    ''
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


function digitsOnly(
  value
) {

  return String(
    value ??
    ''
  )
    .replace(
      /\D/g,
      ''
    );

}


function formatCPF(
  value
) {

  const cpf =
    digitsOnly(
      value
    );


  if (
    cpf.length !==
    11
  ) {

    return cpf;

  }


  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;

}


function normalizeHeader(
  value
) {

  return String(
    value ||
    ''
  )
    .normalize(
      'NFD'
    )
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .trim()
    .toUpperCase();

}


function parseSpreadsheetDate(
  value
) {

  if (
    !value
    &&
    value !==
    0
  ) {

    return null;

  }


  if (
    value instanceof Date
    &&
    !Number.isNaN(
      value.getTime()
    )
  ) {

    return toISODate(
      value
    );

  }


  if (
    typeof value ===
    'number'
    &&
    typeof XLSX !==
    'undefined'
  ) {

    const parsed =
      XLSX.SSF
        .parse_date_code(
          value
        );


    if (parsed) {

      return `${String(parsed.y).padStart(4, '0')}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;

    }

  }


  const text =
    String(
      value
    )
      .trim();


  if (!text) {

    return null;

  }


  if (
    /^\d{4}-\d{2}-\d{2}/
      .test(
        text
      )
  ) {

    return text.slice(
      0,
      10
    );

  }


  const br =
    text.match(
      /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/
    );


  if (br) {

    let a =
      Number(
        br[1]
      );


    let b =
      Number(
        br[2]
      );


    const y =
      Number(
        br[3]
      );


    let d =
      a;


    let m =
      b;


    if (
      a <= 12
      &&
      b > 12
    ) {

      m =
        a;

      d =
        b;

    }


    const date =
      new Date(
        y,
        m - 1,
        d
      );


    if (
      date.getFullYear() ===
      y
      &&
      date.getMonth() ===
      m - 1
      &&
      date.getDate() ===
      d
    ) {

      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    }

  }


  const parsedDate =
    new Date(
      text
    );


  if (
    !Number.isNaN(
      parsedDate.getTime()
    )
  ) {

    return toISODate(
      parsedDate
    );

  }


  return null;

}


function toISODate(
  date
) {

  const y =
    date.getFullYear();


  const m =
    String(
      date.getMonth() + 1
    )
      .padStart(
        2,
        '0'
      );


  const d =
    String(
      date.getDate()
    )
      .padStart(
        2,
        '0'
      );


  return `${y}-${m}-${d}`;

}


// ============================================================
// MODAL
// ============================================================

function openGenericModal(
  content
) {

  closeGenericModal();


  const overlay =
    document.createElement(
      'div'
    );


  overlay.id =
    'genericModalOverlay';


  overlay.className =
    'modal-overlay';


  overlay.innerHTML = `

    <div class="import-modal">
      ${content}
    </div>

  `;


  document.body
    .appendChild(
      overlay
    );


  document
    .getElementById(
      'closeGenericModalButton'
    )
    ?.addEventListener(
      'click',
      closeGenericModal
    );


  overlay.addEventListener(
    'click',
    event => {

      if (
        event.target ===
        overlay
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


function closeAnyOpenModal() {

  closeGenericModal();

}


window.openGenericModal =
  openGenericModal;


window.closeGenericModal =
  closeGenericModal;


// ============================================================
// TEMA / LOGOUT
// ============================================================

function applySavedTheme() {

  const saved =
    localStorage.getItem(
      'RHJourneyTheme'
    )
    ||
    'light';


  document.documentElement
    .setAttribute(
      'data-theme',
      saved
    );


  document.body
    ?.setAttribute(
      'data-theme',
      saved
    );

}


function toggleTheme() {

  const current =
    document.documentElement
      .getAttribute(
        'data-theme'
      )
    ||
    'light';


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


  document.body
    ?.setAttribute(
      'data-theme',
      next
    );


  localStorage.setItem(
    'RHJourneyTheme',
    next
  );

}


async function logout() {

  await journeySupabase
    .auth
    .signOut();


  window.location.href =
    'index.html';

}


// ============================================================
// CSS COMPLEMENTAR
// ============================================================

function injectAppStyles() {

  if (
    document.getElementById(
      'appConsolidatedStyles'
    )
  ) {

    return;

  }


  const style =
    document.createElement(
      'style'
    );


  style.id =
    'appConsolidatedStyles';


  style.textContent = `

    .metric-grid {
      display:grid;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:14px;
      margin-bottom:18px;
    }

    .indicators-top-grid {
      grid-template-columns:repeat(4,minmax(0,1fr));
    }

    .metric-card {
      padding:18px;
      border:1px solid var(--border-color,#e5e7eb);
      border-radius:14px;
      background:var(--card-bg,#fff);
    }

    .metric-card small,
    .metric-card span {
      display:block;
      color:var(--muted-color,#6b7280);
    }

    .metric-card strong {
      display:block;
      font-size:28px;
      line-height:1.1;
      margin:5px 0 6px;
      color:var(--text-color,inherit);
    }

    .quick-actions-grid {
      display:grid;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:12px;
      margin-top:14px;
    }

    .quick-action-card {
      appearance:none;
      width:100%;
      display:flex;
      align-items:center;
      gap:12px;
      text-align:left;
      padding:16px;
      border:1px solid var(--border-color,#e5e7eb);
      border-radius:13px;
      background:var(--card-bg,#fff);
      color:inherit;
      cursor:pointer;
      transition:.18s ease;
    }

    .quick-action-card:hover {
      transform:translateY(-1px);
      border-color:rgba(238,77,45,.35);
      box-shadow:0 8px 24px rgba(0,0,0,.05);
    }

    .quick-action-card strong,
    .quick-action-card small {
      display:block;
    }

    .quick-action-card small {
      margin-top:3px;
      color:var(--muted-color,#6b7280);
    }

    .quick-action-icon {
      display:flex;
      width:38px;
      height:38px;
      min-width:38px;
      align-items:center;
      justify-content:center;
      border-radius:10px;
      background:rgba(238,77,45,.10);
      color:#EE4D2D;
      font-weight:900;
    }

    .panel-actions,
    .row-actions {
      display:flex;
      gap:8px;
      align-items:center;
      flex-wrap:wrap;
    }

    .danger-button {
      border:1px solid rgba(220,38,38,.25);
      background:rgba(220,38,38,.08);
      color:#dc2626;
      border-radius:8px;
      padding:9px 12px;
      cursor:pointer;
      font-weight:700;
    }

    .success-box {
      padding:13px 14px;
      border-radius:10px;
      background:rgba(22,163,74,.09);
      border:1px solid rgba(22,163,74,.18);
    }

    .settings-grid {
      display:grid;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:12px;
    }

    .settings-card {
      appearance:none;
      text-align:left;
      padding:18px;
      border:1px solid var(--border-color,#e5e7eb);
      border-radius:13px;
      background:var(--card-bg,#fff);
      color:inherit;
      cursor:pointer;
    }

    .settings-card strong,
    .settings-card span {
      display:block;
    }

    .settings-card span {
      margin-top:5px;
      color:var(--muted-color,#6b7280);
    }

    .journey-hero-simple {
      padding:24px;
      border-radius:16px;
      margin-bottom:18px;
      background:
        linear-gradient(
          135deg,
          rgba(238,77,45,.12),
          rgba(238,77,45,.03)
        );
      border:1px solid rgba(238,77,45,.16);
    }

    .journey-hero-simple > span {
      color:#EE4D2D;
      font-size:11px;
      font-weight:800;
      letter-spacing:.08em;
    }

    .journey-hero-simple h2 {
      margin:6px 0;
    }

    .journey-hero-simple p {
      margin:0;
      color:var(--muted-color,#6b7280);
    }

    .dimension-grid {
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:12px;
    }

    .dimension-card {
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:10px;
      padding:16px;
      border:1px solid var(--border-color,#e5e7eb);
      border-radius:12px;
    }

    .dimension-card strong,
    .dimension-card span {
      display:block;
    }

    .dimension-card span {
      margin-top:4px;
      font-size:12px;
      color:var(--muted-color,#6b7280);
    }

    .dimension-card b {
      font-size:24px;
    }

    .dimension-card.attention {
      border-color:rgba(220,38,38,.28);
      background:rgba(220,38,38,.05);
    }

    .attention-list {
      display:flex;
      flex-direction:column;
      gap:9px;
    }

    .attention-item {
      display:flex;
      gap:12px;
      align-items:flex-start;
      padding:13px;
      border:1px solid rgba(238,77,45,.16);
      border-radius:11px;
    }

    .attention-item > span {
      display:flex;
      width:28px;
      height:28px;
      min-width:28px;
      align-items:center;
      justify-content:center;
      border-radius:8px;
      background:rgba(238,77,45,.10);
      color:#EE4D2D;
      font-weight:900;
    }

    .attention-item p {
      margin:4px 0 0;
      color:var(--muted-color,#6b7280);
    }

    .gap-alert {
      color:#dc2626;
      font-weight:800;
    }


    @media (
      max-width:1100px
    ) {

      .metric-grid,
      .indicators-top-grid,
      .quick-actions-grid,
      .settings-grid {
        grid-template-columns:
          repeat(2,minmax(0,1fr));
      }

      .dimension-grid {
        grid-template-columns:
          repeat(2,minmax(0,1fr));
      }

    }


    @media (
      max-width:700px
    ) {

      .metric-grid,
      .indicators-top-grid,
      .quick-actions-grid,
      .settings-grid,
      .dimension-grid {
        grid-template-columns:1fr;
      }

    }

  `;


  document.head
    .appendChild(
      style
    );

}


// ============================================================
// EXPOSIÇÃO PARA assessments.js
// ============================================================

window.showPageLoading =
  showPageLoading;


window.escapeHTML =
  escapeHTML;


window.getInitials =
  getInitials;


window.relationArray =
  relationArray;


window.relationObject =
  relationObject;


window.formatDate =
  formatDate;


console.log(
  'RH Journey: app.js consolidado v2 carregado com sucesso.'
);
