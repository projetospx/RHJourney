(function () {
  'use strict';

  let employmentsCache = [];
  let submissionsCache = [];

  let listState = {
    search: '',
    operation: 'ALL',
    checkpoint: 'ALL',
    status: 'ALL',
    page: 1,
    pageSize: 20,
    expanded: new Set()
  };


  // ============================================================
  // HELPERS BÁSICOS
  // ============================================================

  const asArray = value =>
    !value
      ? []
      : Array.isArray(value)
        ? value
        : [value];


  const asObject = value =>
    !value
      ? null
      : Array.isArray(value)
        ? value[0] || null
        : value;


  const CHECKPOINT_ORDER = {
    D1: 1,
    D7: 7,
    D15: 15,
    D30: 30,
    D45: 45,
    D90: 90
  };


  // ============================================================
  // ENTRADA PÚBLICA
  // ============================================================

  window.loadAssessmentsPage = async function () {

    injectStyles();

    showPageLoading();

    try {

      if (currentProfile.role === 'EMPLOYEE') {
        return await loadEmployee();
      }

      if (currentProfile.role === 'LEADER') {
        return await loadLeader();
      }

      return await loadManagement();

    } catch (error) {

      console.error(
        'Avaliações:',
        error
      );

      pageContent.innerHTML = `
        <div class="system-error">
          <h2>Não foi possível carregar as Avaliações</h2>
          <p>${escapeHTML(error.message || 'Erro desconhecido.')}</p>
        </div>
      `;

    }

  };


  // ============================================================
  // COLABORADOR
  // ============================================================

  async function loadEmployee() {

    const { data, error } =
      await journeySupabase
        .from('employments')
        .select(`
          id,
          leader_id,
          operation_id,
          admission_date,
          status,

          people (
            id,
            full_name
          ),

          operations (
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
        .order(
          'admission_date',
          { ascending: false }
        );


    if (error) throw error;


    const employment =
      (data || [])[0];


    if (!employment) {

      pageContent.innerHTML = `
        <div class="assessment-empty">
          <h2>Nenhuma Jornada encontrada</h2>
        </div>
      `;

      return;

    }


    const journey =
      getJourney(employment);


    if (!journey) {

      pageContent.innerHTML = `
        ${renderLeaderCard(employment)}

        <div class="assessment-empty">
          <h2>Jornada ainda não iniciada</h2>
          <p>
            Assim que a Jornada for iniciada,
            suas avaliações aparecerão aqui.
          </p>
        </div>
      `;

      bindLeaderCard(employment);

      return;

    }


    const checkpoints =
      asArray(
        journey.journey_checkpoints
      )
        .slice()
        .sort(checkpointSort);


    const submissions =
      await fetchSubmissions(
        checkpoints.map(cp => cp.id),
        'EMPLOYEE'
      );


    renderEmployee(
      employment,
      checkpoints,
      submissions
    );

  }


  function renderEmployee(
    employment,
    checkpoints,
    submissions
  ) {

    const completed =
      submissions.filter(
        submission =>
          submission.status === 'SUBMITTED'
      ).length;


    pageContent.innerHTML = `

      <div class="assessment-hero">

        <div>
          <span>MINHA JORNADA</span>
          <h2>Suas Avaliações 🧡</h2>

          <p>
            Compartilhe como está sendo sua experiência
            ao longo dos primeiros 90 dias.
          </p>
        </div>

        <strong>
          ${completed}/${checkpoints.length}
        </strong>

      </div>


      ${renderLeaderCard(employment)}


      <section class="dashboard-panel">

        <div class="panel-header">

          <div>
            <h3>Checkpoints</h3>

            <p>
              Cada avaliação será liberada
              conforme sua Jornada avança.
            </p>
          </div>

        </div>


        <div class="assessment-checkpoints">

          ${
            checkpoints
              .map(checkpoint => {

                const submission =
                  submissions.find(
                    item =>
                      item.checkpoint_id ===
                      checkpoint.id
                  );

                return renderCheckpoint(
                  checkpoint,
                  submission
                );

              })
              .join('')
          }

        </div>

      </section>

    `;


    bindLeaderCard(employment);

    bindAssessmentButtons();

  }


  // ============================================================
  // LIDERANÇA ATUAL DO COLABORADOR
  // ============================================================

  function renderLeaderCard(employment) {

    const leader =
      asObject(employment.leader);

    const operation =
      asObject(employment.operations);


    if (leader) {

      return `

        <div class="assessment-leader">

          <div class="leader-avatar">
            ${getInitials(leader.full_name)}
          </div>

          <div>
            <small>Seu líder atual</small>
            <strong>${escapeHTML(leader.full_name)}</strong>
            <span>${escapeHTML(operation?.name || '')}</span>
          </div>

          <button
            id="changeEmployeeLeader"
            class="assessment-outline"
            type="button"
          >
            Meu líder mudou
          </button>

        </div>

      `;

    }


    return `

      <div class="assessment-leader">

        <div class="leader-avatar">
          ?
        </div>

        <div>
          <small>Liderança não identificada</small>
          <strong>Quem é seu líder?</strong>

          <span>
            Isso não impede suas avaliações.
          </span>
        </div>

        <button
          id="chooseEmployeeLeader"
          class="primary-action-button"
          type="button"
        >
          Informar meu líder
        </button>

      </div>

    `;

  }


  function bindLeaderCard(employment) {

    document
      .getElementById('chooseEmployeeLeader')
      ?.addEventListener(
        'click',
        () => chooseLeader(employment)
      );


    document
      .getElementById('changeEmployeeLeader')
      ?.addEventListener(
        'click',
        () => chooseLeader(employment)
      );

  }


  async function chooseLeader(employment) {

    const { data, error } =
      await journeySupabase
        .rpc(
          'get_eligible_leaders_for_employment',
          {
            p_employment_id:
              employment.id
          }
        );


    if (error) {
      alert(error.message);
      return;
    }


    const leaders =
      data || [];


    if (!leaders.length) {

      alert(
        'Nenhuma liderança elegível encontrada.'
      );

      return;

    }


    openGenericModal(`

      <div class="modal-header">

        <div>
          <h2>Quem é seu líder?</h2>
          <p>Selecione sua liderança atual.</p>
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

        ${
          leaders
            .map(
              leader => `

                <button
                  class="leader-option"
                  type="button"
                  data-leader-id="${leader.leader_id}"
                  data-leader-name="${escapeHTML(leader.full_name)}"
                >

                  <span class="leader-avatar">
                    ${getInitials(leader.full_name)}
                  </span>

                  <span>
                    <strong>
                      ${escapeHTML(leader.full_name)}
                    </strong>

                    <small>
                      Selecionar
                    </small>
                  </span>

                </button>

              `
            )
            .join('')
        }

      </div>

    `);


    document
      .querySelectorAll('.leader-option')
      .forEach(button => {

        button.addEventListener(
          'click',
          () => setLeader(
            employment,
            button.dataset.leaderId,
            button.dataset.leaderName
          )
        );

      });

  }


  async function setLeader(
    employment,
    leaderId,
    leaderName
  ) {

    if (
      !confirm(
        `Confirmar ${leaderName} como sua liderança atual?`
      )
    ) {
      return;
    }


    const { error } =
      await journeySupabase
        .rpc(
          'set_employment_leader',
          {
            p_employment_id:
              employment.id,

            p_new_leader_id:
              leaderId,

            p_source:
              'EMPLOYEE_SELECTED',

            p_reason:
              employment.leader_id
                ? 'Liderança alterada pelo colaborador.'
                : 'Liderança indicada pelo colaborador.'
          }
        );


    if (error) {
      alert(error.message);
      return;
    }


    closeGenericModal();

    await loadEmployee();

  }


  // ============================================================
  // LÍDER
  // 1 LINHA POR COLABORADOR
  // ============================================================

  async function loadLeader() {

    const { data, error } =
      await journeySupabase
        .from('employments')
        .select(`
          id,
          leader_id,
          admission_date,
          status,

          people (
            full_name,
            cpf
          ),

          operations (
            id,
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
        .eq(
          'leader_id',
          currentProfile.id
        )
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


    if (error) throw error;


    employmentsCache =
      data || [];


    const checkpointIds =
      collectCheckpointIds(
        employmentsCache
      );


    submissionsCache =
      await fetchSubmissions(
        checkpointIds,
        'LEADER'
      );


    listState.page = 1;

    renderLeaderList();

  }


  function renderLeaderList() {

    const prepared =
      employmentsCache
        .map(buildLeaderEmployeeItem);


    const filtered =
      filterEmployeeItems(
        prepared
      );


    filtered.sort(
      compareUrgency
    );


    const total =
      filtered.length;


    const totalPages =
      Math.max(
        1,
        Math.ceil(
          total /
          listState.pageSize
        )
      );


    if (
      listState.page >
      totalPages
    ) {
      listState.page =
        totalPages;
    }


    const start =
      (
        listState.page - 1
      )
      *
      listState.pageSize;


    const pageItems =
      filtered.slice(
        start,
        start + listState.pageSize
      );


    const pending =
      prepared.filter(
        item =>
          [
            'OVERDUE',
            'AVAILABLE',
            'DRAFT'
          ].includes(
            item.primary.status
          )
      ).length;


    const overdue =
      prepared.filter(
        item =>
          item.primary.status ===
          'OVERDUE'
      ).length;


    const operations =
      [
        ...new Set(
          employmentsCache
            .map(
              employment =>
                asObject(
                  employment.operations
                )?.name
            )
            .filter(Boolean)
        )
      ].sort();


    pageContent.innerHTML = `

      <div class="assessment-hero">

        <div>
          <span>AVALIAÇÕES DA EQUIPE</span>
          <h2>Acompanhamento da Liderança</h2>

          <p>
            Uma visão compacta da sua equipe.
          </p>
        </div>

      </div>


      <div class="assessment-summary-grid">

        <div>
          <small>Equipe</small>
          <strong>${prepared.length}</strong>
        </div>

        <div>
          <small>Pendentes</small>
          <strong>${pending}</strong>
        </div>

        <div>
          <small>Em atraso</small>
          <strong>${overdue}</strong>
        </div>

      </div>


      <section class="dashboard-panel">

        <div class="assessment-toolbar">

          <input
            id="assessmentSearch"
            type="search"
            placeholder="Buscar nome ou CPF..."
            value="${escapeHTML(listState.search)}"
          >


          <select id="assessmentOperation">

            <option value="ALL">
              Todas as operações
            </option>

            ${
              operations.map(
                operation => `

                  <option
                    value="${escapeHTML(operation)}"
                    ${
                      listState.operation ===
                      operation
                        ? 'selected'
                        : ''
                    }
                  >
                    ${escapeHTML(operation)}
                  </option>

                `
              ).join('')
            }

          </select>


          <select id="assessmentCheckpoint">

            <option value="ALL">
              Todos os checkpoints
            </option>

            ${
              [
                'D1',
                'D7',
                'D15',
                'D30',
                'D45',
                'D90'
              ]
                .map(
                  cp => `

                    <option
                      value="${cp}"
                      ${
                        listState.checkpoint ===
                        cp
                          ? 'selected'
                          : ''
                      }
                    >
                      ${cp}
                    </option>

                  `
                )
                .join('')
            }

          </select>


          <select id="assessmentStatus">

            <option value="ALL">
              Todos os status
            </option>

            <option
              value="OVERDUE"
              ${
                listState.status === 'OVERDUE'
                  ? 'selected'
                  : ''
              }
            >
              Em atraso
            </option>

            <option
              value="AVAILABLE"
              ${
                listState.status === 'AVAILABLE'
                  ? 'selected'
                  : ''
              }
            >
              Disponível
            </option>

            <option
              value="DRAFT"
              ${
                listState.status === 'DRAFT'
                  ? 'selected'
                  : ''
              }
            >
              Rascunho
            </option>

            <option
              value="SUBMITTED"
              ${
                listState.status === 'SUBMITTED'
                  ? 'selected'
                  : ''
              }
            >
              Respondida
            </option>

            <option
              value="FUTURE"
              ${
                listState.status === 'FUTURE'
                  ? 'selected'
                  : ''
              }
            >
              Em breve
            </option>

          </select>

        </div>


        <div class="assessment-list-info">

          ${
            total
              ? `Exibindo ${start + 1}–${Math.min(start + listState.pageSize, total)} de ${total}`
              : 'Nenhum colaborador encontrado'
          }

        </div>


        <div class="table-wrapper">

          <table class="journey-table assessment-people-table">

            <thead>

              <tr>
                <th>Colaborador</th>
                <th>Operação</th>
                <th>Etapa atual</th>
                <th>Prazo</th>
                <th>Status</th>
                <th>Ação</th>
              </tr>

            </thead>


            <tbody>

              ${
                pageItems.length

                  ? pageItems
                      .map(
                        renderLeaderEmployeeRow
                      )
                      .join('')

                  : `

                      <tr>
                        <td colspan="6">
                          Nenhum colaborador encontrado.
                        </td>
                      </tr>

                    `
              }

            </tbody>

          </table>

        </div>


        ${renderPagination(totalPages)}

      </section>

    `;


    bindListFilters();

    bindLeaderListButtons();

    bindPagination();

  }


  function buildLeaderEmployeeItem(
    employment
  ) {

    const person =
      asObject(
        employment.people
      );


    const operation =
      asObject(
        employment.operations
      );


    const journey =
      getJourney(
        employment
      );


    const checkpoints =
      asArray(
        journey?.journey_checkpoints
      )
        .slice()
        .sort(checkpointSort);


    const states =
      checkpoints.map(
        checkpoint => {

          const submission =
            submissionsCache.find(
              item =>
                item.checkpoint_id ===
                checkpoint.id
            );


          return {
            checkpoint,
            submission,
            status:
              effectiveStatus(
                checkpoint,
                submission
              )
          };

        }
      );


    let primary;


    if (
      listState.checkpoint !==
      'ALL'
    ) {

      primary =
        states.find(
          item =>
            item.checkpoint.checkpoint ===
            listState.checkpoint
        );

    }


    if (!primary) {

      primary =
        states.find(
          item =>
            item.status === 'OVERDUE'
        )
        ||
        states.find(
          item =>
            item.status === 'DRAFT'
        )
        ||
        states.find(
          item =>
            item.status === 'AVAILABLE'
        )
        ||
        states.find(
          item =>
            item.status === 'FUTURE'
        )
        ||
        states[
          states.length - 1
        ];

    }


    return {
      employment,
      person,
      operation,
      states,
      primary:
        primary || {
          checkpoint: {
            checkpoint: '-',
            due_at: null
          },
          submission: null,
          status: 'FUTURE'
        }
    };

  }


  function filterEmployeeItems(
    items
  ) {

    const search =
      listState.search
        .trim()
        .toLowerCase();


    return items.filter(
      item => {

        const text =
          `${item.person?.full_name || ''} ${item.person?.cpf || ''}`
            .toLowerCase();


        if (
          search &&
          !text.includes(search)
        ) {
          return false;
        }


        if (
          listState.operation !==
          'ALL'
          &&
          item.operation?.name !==
          listState.operation
        ) {
          return false;
        }


        if (
          listState.checkpoint !==
          'ALL'
          &&
          !item.states.some(
            state =>
              state.checkpoint.checkpoint ===
              listState.checkpoint
          )
        ) {
          return false;
        }


        if (
          listState.status !==
          'ALL'
          &&
          item.primary.status !==
          listState.status
        ) {
          return false;
        }


        return true;

      }
    );

  }


  function renderLeaderEmployeeRow(
    item
  ) {

    const employment =
      item.employment;


    const primary =
      item.primary;


    const expanded =
      listState.expanded.has(
        employment.id
      );


    return `

      <tr>

        <td>

          <strong>
            ${escapeHTML(item.person?.full_name || '-')}
          </strong>

          <br>

          <small>
            ${escapeHTML(formatCPF(item.person?.cpf || ''))}
          </small>

        </td>


        <td>
          ${escapeHTML(item.operation?.name || '-')}
        </td>


        <td>
          <strong>
            ${escapeHTML(primary.checkpoint.checkpoint)}
          </strong>
        </td>


        <td>
          ${formatDate(primary.checkpoint.due_at)}
        </td>


        <td>
          ${statusBadge(primary.status)}
        </td>


        <td>

          <div class="assessment-row-actions">

            ${primaryAction(primary)}

            <button
              class="assessment-outline"
              type="button"
              data-toggle-employment="${employment.id}"
            >
              ${
                expanded
                  ? 'Ocultar'
                  : 'Ver jornada'
              }
            </button>

          </div>

        </td>

      </tr>


      ${
        expanded
          ? `

              <tr class="assessment-expanded-row">

                <td colspan="6">

                  <div class="expanded-checkpoints">

                    ${
                      item.states
                        .map(
                          state =>
                            renderExpandedCheckpoint(
                              state
                            )
                        )
                        .join('')
                    }

                  </div>

                </td>

              </tr>

            `
          : ''
      }

    `;

  }


  function primaryAction(
    state
  ) {

    if (
      state.status ===
      'SUBMITTED'
    ) {

      return `

        <button
          class="assessment-outline"
          type="button"
          data-view-submission="${state.submission.id}"
        >
          Ver
        </button>

      `;

    }


    if (
      state.status ===
      'FUTURE'
    ) {
      return '';
    }


    return `

      <button
        class="primary-action-button"
        type="button"
        data-leader-checkpoint="${state.checkpoint.id}"
      >
        ${
          state.status ===
          'DRAFT'
            ? 'Continuar'
            : 'Responder'
        }
      </button>

    `;

  }


  function renderExpandedCheckpoint(
    state
  ) {

    return `

      <div class="expanded-checkpoint">

        <div>

          <b>
            ${escapeHTML(
              state.checkpoint.checkpoint
            )}
          </b>

          <small>
            ${formatDate(
              state.checkpoint.due_at
            )}
          </small>

        </div>

        ${statusBadge(state.status)}

        ${primaryAction(state)}

      </div>

    `;

  }


  function bindListFilters() {

    document
      .getElementById('assessmentSearch')
      ?.addEventListener(
        'input',
        event => {

          listState.search =
            event.target.value;

          listState.page = 1;

          renderLeaderList();

          setTimeout(
            () =>
              document
                .getElementById('assessmentSearch')
                ?.focus(),
            0
          );

        }
      );


    [
      [
        'assessmentOperation',
        'operation'
      ],
      [
        'assessmentCheckpoint',
        'checkpoint'
      ],
      [
        'assessmentStatus',
        'status'
      ]
    ]
      .forEach(
        ([id, key]) => {

          document
            .getElementById(id)
            ?.addEventListener(
              'change',
              event => {

                listState[key] =
                  event.target.value;

                listState.page = 1;

                renderLeaderList();

              }
            );

        }
      );

  }


  function bindLeaderListButtons() {

    document
      .querySelectorAll(
        '[data-toggle-employment]'
      )
      .forEach(
        button => {

          button.addEventListener(
            'click',
            () => {

              const id =
                button.dataset.toggleEmployment;


              if (
                listState.expanded.has(id)
              ) {
                listState.expanded.delete(id);
              } else {
                listState.expanded.add(id);
              }


              renderLeaderList();

            }
          );

        }
      );


    document
      .querySelectorAll(
        '[data-leader-checkpoint]'
      )
      .forEach(
        button => {

          button.addEventListener(
            'click',
            async () => {

              const {
                data: submissionId,
                error
              } =
                await journeySupabase
                  .rpc(
                    'get_or_create_leader_assessment',
                    {
                      p_checkpoint_id:
                        button.dataset.leaderCheckpoint
                    }
                  );


              if (error) {
                alert(error.message);
                return;
              }


              await openForm(
                submissionId
              );

            }
          );

        }
      );


    bindViewButtons();

  }


  // ============================================================
  // RH / HR_MANAGER
  // UMA LINHA POR COLABORADOR
  // ============================================================

  async function loadManagement() {

    const {
      data,
      error
    } =
      await journeySupabase
        .from('employments')
        .select(`
          id,
          leader_id,
          admission_date,
          status,

          people (
            full_name,
            cpf
          ),

          operations (
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


    if (error) throw error;


    employmentsCache =
      data || [];


    const checkpointIds =
      collectCheckpointIds(
        employmentsCache
      );


    submissionsCache =
      await fetchSubmissions(
        checkpointIds
      );


    renderManagement();

  }


  function renderManagement() {

    const rows =
      employmentsCache.map(
        employment => {

          const person =
            asObject(
              employment.people
            );


          const operation =
            asObject(
              employment.operations
            );


          const leader =
            asObject(
              employment.leader
            );


          const journey =
            getJourney(
              employment
            );


          const checkpoints =
            asArray(
              journey?.journey_checkpoints
            )
              .slice()
              .sort(checkpointSort);


          const states =
            checkpoints.map(
              checkpoint => {

                const employeeSubmission =
                  submissionsCache.find(
                    item =>
                      item.checkpoint_id ===
                      checkpoint.id
                      &&
                      item.respondent_type ===
                      'EMPLOYEE'
                  );


                const leaderSubmission =
                  submissionsCache.find(
                    item =>
                      item.checkpoint_id ===
                      checkpoint.id
                      &&
                      item.respondent_type ===
                      'LEADER'
                  );


                return {
                  checkpoint,

                  employeeSubmission,

                  leaderSubmission,

                  employeeStatus:
                    effectiveStatus(
                      checkpoint,
                      employeeSubmission
                    ),

                  leaderStatus:
                    employment.leader_id
                      ? effectiveStatus(
                          checkpoint,
                          leaderSubmission
                        )
                      : 'NO_LEADER'
                };

              }
            );


          const current =
            states.find(
              state =>
                [
                  'OVERDUE',
                  'DRAFT',
                  'AVAILABLE'
                ].includes(
                  state.employeeStatus
                )
                ||
                [
                  'OVERDUE',
                  'DRAFT',
                  'AVAILABLE',
                  'NO_LEADER'
                ].includes(
                  state.leaderStatus
                )
            )
            ||
            states[
              states.length - 1
            ];


          return {
            employment,
            person,
            operation,
            leader,
            states,
            current
          };

        }
      );


    pageContent.innerHTML = `

      <div class="assessment-hero">

        <div>
          <span>AVALIAÇÕES DA JORNADA</span>
          <h2>D1 → D90</h2>

          <p>
            Visão consolidada por colaborador.
          </p>
        </div>

      </div>


      <section class="dashboard-panel">

        <div class="table-wrapper">

          <table class="journey-table">

            <thead>

              <tr>
                <th>Colaborador</th>
                <th>Operação</th>
                <th>Líder atual</th>
                <th>Etapa</th>
                <th>Colaborador</th>
                <th>Liderança</th>
              </tr>

            </thead>


            <tbody>

              ${
                rows.length

                  ? rows.map(
                      row => `

                        <tr>

                          <td>
                            <strong>
                              ${escapeHTML(row.person?.full_name || '-')}
                            </strong>
                          </td>

                          <td>
                            ${escapeHTML(row.operation?.name || '-')}
                          </td>

                          <td>

                            ${
                              row.leader
                                ? escapeHTML(row.leader.full_name)
                                : `<span class="assessment-pill danger">⚠ Sem líder</span>`
                            }

                          </td>

                          <td>
                            <strong>
                              ${escapeHTML(row.current?.checkpoint?.checkpoint || '-')}
                            </strong>
                          </td>

                          <td>
                            ${statusBadge(row.current?.employeeStatus || 'FUTURE')}
                          </td>

                          <td>
                            ${
                              row.current?.leaderStatus === 'NO_LEADER'
                                ? `<span class="assessment-pill danger">⚠ Sem líder</span>`
                                : statusBadge(row.current?.leaderStatus || 'FUTURE')
                            }
                          </td>

                        </tr>

                      `
                    ).join('')

                  : `

                      <tr>
                        <td colspan="6">
                          Nenhuma avaliação encontrada.
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


  // ============================================================
  // CHECKPOINT EMPLOYEE
  // ============================================================

  function renderCheckpoint(
    checkpoint,
    submission
  ) {

    const status =
      effectiveStatus(
        checkpoint,
        submission
      );


    if (
      status ===
      'SUBMITTED'
    ) {

      return `

        <div class="assessment-checkpoint">

          <b class="checkpoint-code">
            ${escapeHTML(checkpoint.checkpoint)}
          </b>

          <div>
            <strong>Avaliação respondida</strong>
            <small>
              ${formatDate(submission.submitted_at)}
            </small>
          </div>

          ${statusBadge(status)}

          <button
            class="assessment-outline"
            type="button"
            data-view-submission="${submission.id}"
          >
            Ver respostas
          </button>

        </div>

      `;

    }


    if (
      status ===
      'FUTURE'
    ) {

      return `

        <div class="assessment-checkpoint">

          <b class="checkpoint-code">
            ${escapeHTML(checkpoint.checkpoint)}
          </b>

          <div>
            <strong>Em breve</strong>

            <small>
              Libera em
              ${formatDate(checkpoint.opens_at)}
            </small>
          </div>

          ${statusBadge(status)}

        </div>

      `;

    }


    return `

      <div class="assessment-checkpoint">

        <b class="checkpoint-code">
          ${escapeHTML(checkpoint.checkpoint)}
        </b>

        <div>

          <strong>

            ${
              status === 'DRAFT'
                ? 'Continuar avaliação'
                : 'Avaliação disponível'
            }

          </strong>

          <small>
            Prazo:
            ${formatDate(checkpoint.due_at)}
          </small>

        </div>

        ${statusBadge(status)}

        <button
          class="primary-action-button"
          type="button"
          data-answer-checkpoint="${checkpoint.id}"
        >
          ${
            status === 'DRAFT'
              ? 'Continuar'
              : 'Responder'
          }
        </button>

      </div>

    `;

  }


  // ============================================================
  // ABRIR AVALIAÇÃO
  // ============================================================

  function bindAssessmentButtons() {

    document
      .querySelectorAll(
        '[data-answer-checkpoint]'
      )
      .forEach(
        button => {

          button.addEventListener(
            'click',
            () => openEmployeeAssessment(
              button.dataset.answerCheckpoint
            )
          );

        }
      );


    bindViewButtons();

  }


  async function openEmployeeAssessment(
    checkpointId
  ) {

    const {
      data: submissionId,
      error
    } =
      await journeySupabase
        .rpc(
          'get_or_create_employee_assessment',
          {
            p_checkpoint_id:
              checkpointId
          }
        );


    if (error) {
      alert(error.message);
      return;
    }


    await openForm(
      submissionId
    );

  }


  // ============================================================
  // FORMULÁRIO
  // ============================================================

  async function openForm(
    submissionId
  ) {

    const submissionResult =
      await journeySupabase
        .from(
          'journey_assessment_submissions'
        )
        .select(`
          id,
          checkpoint_id,
          respondent_type,
          status,

          journey_checkpoints (
            checkpoint,
            due_at
          ),

          employments (
            people (
              full_name
            )
          )
        `)
        .eq(
          'id',
          submissionId
        )
        .single();


    if (
      submissionResult.error
    ) {

      alert(
        submissionResult.error.message
      );

      return;

    }


    const submission =
      submissionResult.data;


    const checkpoint =
      asObject(
        submission.journey_checkpoints
      );


    const employment =
      asObject(
        submission.employments
      );


    const employee =
      asObject(
        employment?.people
      );


    const questionResult =
      await journeySupabase
        .from(
          'journey_assessment_questions'
        )
        .select(`
          id,
          dimension,
          question_text,
          question_type,
          required,
          display_order,
          options
        `)
        .eq(
          'checkpoint',
          checkpoint.checkpoint
        )
        .eq(
          'respondent_type',
          submission.respondent_type
        )
        .eq(
          'active',
          true
        )
        .order(
          'display_order'
        );


    if (
      questionResult.error
    ) {

      alert(
        questionResult.error.message
      );

      return;

    }


    const questions =
      questionResult.data || [];


    if (!questions.length) {

      alert(
        `Ainda não existem perguntas cadastradas para ${checkpoint.checkpoint}.`
      );

      return;

    }


    const answerResult =
      await journeySupabase
        .from(
          'journey_assessment_answers'
        )
        .select(`
          question_id,
          numeric_value,
          text_value,
          boolean_value,
          option_value
        `)
        .eq(
          'submission_id',
          submissionId
        );


    if (
      answerResult.error
    ) {

      alert(
        answerResult.error.message
      );

      return;

    }


    const answers =
      answerResult.data || [];


    openGenericModal(`

      <div class="assessment-form-modal">

        <div class="modal-header">

          <div>

            <span class="assessment-eyebrow">
              ${escapeHTML(checkpoint.checkpoint)}
            </span>

            <h2>
              ${escapeHTML(
                employee?.full_name ||
                currentProfile.full_name
              )}
            </h2>

            <p>
              Prazo:
              ${formatDate(checkpoint.due_at)}
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
          id="assessmentForm"
          class="assessment-form"
        >

          ${
            questions
              .map(
                (
                  question,
                  index
                ) => {

                  const answer =
                    answers.find(
                      item =>
                        item.question_id ===
                        question.id
                    );


                  return renderQuestion(
                    question,
                    answer,
                    index + 1
                  );

                }
              )
              .join('')
          }


          <div class="assessment-form-footer">

            <button
              id="saveAssessmentDraft"
              class="secondary-button"
              type="button"
            >
              Salvar rascunho
            </button>

            <button
              class="primary-action-button"
              type="submit"
            >
              Enviar avaliação
            </button>

          </div>

        </form>

      </div>

    `);


    document
      .getElementById(
        'saveAssessmentDraft'
      )
      ?.addEventListener(
        'click',
        () =>
          saveForm(
            submissionId,
            questions,
            false
          )
      );


    document
      .getElementById(
        'assessmentForm'
      )
      ?.addEventListener(
        'submit',
        event => {

          event.preventDefault();

          saveForm(
            submissionId,
            questions,
            true
          );

        }
      );

  }


  function renderQuestion(
    question,
    answer,
    index
  ) {

    let input = '';


    if (
      question.question_type ===
      'SCALE_1_5'
    ) {

      input =
        renderScale(
          question,
          answer
        );

    } else if (
      question.question_type ===
      'YES_NO'
    ) {

      input =
        renderYesNo(
          question,
          answer
        );

    } else if (
      question.question_type ===
      'TEXT'
    ) {

      input = `

        <textarea
          data-text-answer
          rows="4"
          placeholder="Digite sua resposta..."
        >${escapeHTML(answer?.text_value || '')}</textarea>

      `;

    } else {

      input =
        renderChoice(
          question,
          answer
        );

    }


    return `

      <div
        class="assessment-question"
        data-question-id="${question.id}"
      >

        <span class="question-number">
          ${index}
        </span>

        <small>
          ${escapeHTML(
            prettyDimension(
              question.dimension
            )
          )}
        </small>

        <strong>
          ${escapeHTML(
            question.question_text
          )}
        </strong>

        ${input}

      </div>

    `;

  }


  function renderScale(
    question,
    answer
  ) {

    return `

      <div class="scale-options">

        ${
          [
            1,
            2,
            3,
            4,
            5
          ]
            .map(
              number => `

                <label>

                  <input
                    type="radio"
                    name="q_${question.id}"
                    value="${number}"
                    ${
                      Number(
                        answer?.numeric_value
                      ) === number
                        ? 'checked'
                        : ''
                    }
                  >

                  <span>
                    ${number}
                  </span>

                </label>

              `
            )
            .join('')
        }

      </div>


      <div class="scale-caption">

        <span>
          1 · Muito abaixo
        </span>

        <span>
          5 · Muito acima
        </span>

      </div>

    `;

  }


  function renderYesNo(
    question,
    answer
  ) {

    return `

      <div class="choice-options">

        <label>

          <input
            type="radio"
            name="q_${question.id}"
            value="true"
            ${
              answer?.boolean_value === true
                ? 'checked'
                : ''
            }
          >

          <span>Sim</span>

        </label>


        <label>

          <input
            type="radio"
            name="q_${question.id}"
            value="false"
            ${
              answer?.boolean_value === false
                ? 'checked'
                : ''
            }
          >

          <span>Não</span>

        </label>

      </div>

    `;

  }


  function renderChoice(
    question,
    answer
  ) {

    const options =
      Array.isArray(
        question.options
      )
        ? question.options
        : [];


    return `

      <div class="choice-options vertical">

        ${
          options
            .map(
              option => `

                <label>

                  <input
                    type="radio"
                    name="q_${question.id}"
                    value="${escapeHTML(option)}"
                    ${
                      answer?.option_value ===
                      option
                        ? 'checked'
                        : ''
                    }
                  >

                  <span>
                    ${escapeHTML(option)}
                  </span>

                </label>

              `
            )
            .join('')
        }

      </div>

    `;

  }


  async function saveForm(
    submissionId,
    questions,
    submit
  ) {

    try {

      const responses =
        questions.map(
          question => {

            const container =
              document.querySelector(
                `[data-question-id="${question.id}"]`
              );


            let numeric = null;
            let text = null;
            let boolean = null;
            let option = null;
            let hasValue = false;


            if (
              question.question_type ===
              'SCALE_1_5'
            ) {

              const selected =
                container?.querySelector(
                  `input[name="q_${question.id}"]:checked`
                );


              if (selected) {

                numeric =
                  Number(selected.value);

                hasValue = true;

              }

            } else if (
              question.question_type ===
              'YES_NO'
            ) {

              const selected =
                container?.querySelector(
                  `input[name="q_${question.id}"]:checked`
                );


              if (selected) {

                boolean =
                  selected.value ===
                  'true';

                hasValue = true;

              }

            } else if (
              question.question_type ===
              'TEXT'
            ) {

              text =
                container
                  ?.querySelector(
                    '[data-text-answer]'
                  )
                  ?.value
                  ?.trim()
                ||
                '';


              hasValue =
                !!text;

            } else {

              const selected =
                container?.querySelector(
                  `input[name="q_${question.id}"]:checked`
                );


              if (selected) {

                option =
                  selected.value;

                hasValue = true;

              }

            }


            return {
              question,
              numeric,
              text,
              boolean,
              option,
              hasValue
            };

          }
        );


      if (submit) {

        const missing =
          responses.filter(
            item =>
              item.question.required
              &&
              !item.hasValue
          );


        if (
          missing.length
        ) {

          alert(
            `Existem ${missing.length} pergunta(s) obrigatória(s) sem resposta.`
          );

          return;

        }

      }


      for (
        const response
        of responses
      ) {

        if (
          !response.hasValue
        ) {
          continue;
        }


        const { error } =
          await journeySupabase
            .rpc(
              'save_journey_assessment_answer',
              {
                p_submission_id:
                  submissionId,

                p_question_id:
                  response.question.id,

                p_numeric_value:
                  response.numeric,

                p_text_value:
                  response.text,

                p_boolean_value:
                  response.boolean,

                p_option_value:
                  response.option
              }
            );


        if (error) {
          throw error;
        }

      }


      if (!submit) {

        alert(
          'Rascunho salvo.'
        );

        return;

      }


      if (
        !confirm(
          'Enviar esta avaliação?\n\nDepois do envio ela será considerada concluída.'
        )
      ) {
        return;
      }


      const { error } =
        await journeySupabase
          .rpc(
            'submit_journey_assessment',
            {
              p_submission_id:
                submissionId
            }
          );


      if (error) {
        throw error;
      }


      closeGenericModal();


      alert(
        'Avaliação enviada com sucesso. 🧡'
      );


      await window
        .loadAssessmentsPage();

    } catch (error) {

      console.error(error);

      alert(
        error.message ||
        'Não foi possível salvar.'
      );

    }

  }


  // ============================================================
  // VISUALIZAÇÃO
  // ============================================================

  async function viewSubmission(
    submissionId
  ) {

    const {
      data,
      error
    } =
      await journeySupabase
        .from(
          'journey_assessment_answers'
        )
        .select(`
          numeric_value,
          text_value,
          boolean_value,
          option_value,

          journey_assessment_questions (
            question_text,
            dimension,
            display_order
          )
        `)
        .eq(
          'submission_id',
          submissionId
        );


    if (error) {
      alert(error.message);
      return;
    }


    const answers =
      (data || [])
        .slice()
        .sort(
          (
            a,
            b
          ) => {

            const qa =
              asObject(
                a.journey_assessment_questions
              );

            const qb =
              asObject(
                b.journey_assessment_questions
              );

            return (
              qa?.display_order || 0
            )
            -
            (
              qb?.display_order || 0
            );

          }
        );


    openGenericModal(`

      <div class="modal-header">

        <div>
          <h2>
            Respostas da Avaliação
          </h2>
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

        ${
          answers.length

            ? answers
                .map(
                  answer => {

                    const question =
                      asObject(
                        answer.journey_assessment_questions
                      );


                    return `

                      <div class="view-answer">

                        <small>
                          ${escapeHTML(
                            prettyDimension(
                              question?.dimension
                            )
                          )}
                        </small>

                        <strong>
                          ${escapeHTML(
                            question?.question_text || ''
                          )}
                        </strong>

                        <p>
                          ${escapeHTML(
                            answerValue(answer)
                          )}
                        </p>

                      </div>

                    `;

                  }
                )
                .join('')

            : `

                <div class="assessment-empty">
                  Nenhuma resposta encontrada.
                </div>

              `
        }

      </div>

    `);

  }


  function bindViewButtons() {

    document
      .querySelectorAll(
        '[data-view-submission]'
      )
      .forEach(
        button => {

          button.addEventListener(
            'click',
            () =>
              viewSubmission(
                button.dataset.viewSubmission
              )
          );

        }
      );

  }


  // ============================================================
  // SUBMISSIONS
  // ============================================================

  async function fetchSubmissions(
    checkpointIds,
    respondentType = null
  ) {

    if (
      !checkpointIds.length
    ) {
      return [];
    }


    let query =
      journeySupabase
        .from(
          'journey_assessment_submissions'
        )
        .select(`
          id,
          checkpoint_id,
          employment_id,
          respondent_type,
          status,
          submitted_at
        `)
        .in(
          'checkpoint_id',
          checkpointIds
        );


    if (
      respondentType
    ) {

      query =
        query.eq(
          'respondent_type',
          respondentType
        );

    }


    const {
      data,
      error
    } =
      await query;


    if (error) throw error;


    return data || [];

  }


  // ============================================================
  // STATUS / ORDENAÇÃO
  // ============================================================

  function effectiveStatus(
    checkpoint,
    submission
  ) {

    if (
      submission?.status ===
      'SUBMITTED'
    ) {
      return 'SUBMITTED';
    }


    if (
      submission?.status ===
      'DRAFT'
    ) {
      return 'DRAFT';
    }


    const now =
      new Date();


    const opens =
      checkpoint.opens_at
        ? new Date(
            checkpoint.opens_at
          )
        : null;


    const due =
      checkpoint.due_at
        ? new Date(
            checkpoint.due_at
          )
        : null;


    if (
      opens
      &&
      now < opens
    ) {
      return 'FUTURE';
    }


    if (
      due
      &&
      now > due
    ) {
      return 'OVERDUE';
    }


    return 'AVAILABLE';

  }


  function compareUrgency(
    a,
    b
  ) {

    const priority = {
      OVERDUE: 0,
      DRAFT: 1,
      AVAILABLE: 2,
      FUTURE: 3,
      SUBMITTED: 4
    };


    const pa =
      priority[
        a.primary.status
      ]
      ??
      99;


    const pb =
      priority[
        b.primary.status
      ]
      ??
      99;


    if (
      pa !== pb
    ) {
      return pa - pb;
    }


    const da =
      a.primary.checkpoint.due_at
        ? new Date(
            a.primary.checkpoint.due_at
          ).getTime()
        : Infinity;


    const db =
      b.primary.checkpoint.due_at
        ? new Date(
            b.primary.checkpoint.due_at
          ).getTime()
        : Infinity;


    return da - db;

  }


  function statusBadge(status) {

    const map = {

      SUBMITTED:
        [
          'success',
          '✓ Respondida'
        ],

      AVAILABLE:
        [
          'warning',
          'Disponível'
        ],

      DRAFT:
        [
          'warning',
          'Rascunho'
        ],

      OVERDUE:
        [
          'danger',
          '⚠ Em atraso'
        ],

      FUTURE:
        [
          'muted',
          'Em breve'
        ]

    };


    const [
      css,
      text
    ] =
      map[status]
      ||
      map.FUTURE;


    return `
      <span class="assessment-pill ${css}">
        ${text}
      </span>
    `;

  }


  // ============================================================
  // PAGINAÇÃO
  // ============================================================

  function renderPagination(
    totalPages
  ) {

    if (
      totalPages <= 1
    ) {
      return '';
    }


    return `

      <div class="assessment-pagination">

        <button
          type="button"
          data-page-prev
          ${
            listState.page === 1
              ? 'disabled'
              : ''
          }
        >
          ‹
        </button>

        <span>
          Página
          <strong>${listState.page}</strong>
          de
          <strong>${totalPages}</strong>
        </span>

        <button
          type="button"
          data-page-next
          ${
            listState.page === totalPages
              ? 'disabled'
              : ''
          }
        >
          ›
        </button>

      </div>

    `;

  }


  function bindPagination() {

    document
      .querySelector(
        '[data-page-prev]'
      )
      ?.addEventListener(
        'click',
        () => {

          listState.page =
            Math.max(
              1,
              listState.page - 1
            );

          renderLeaderList();

        }
      );


    document
      .querySelector(
        '[data-page-next]'
      )
      ?.addEventListener(
        'click',
        () => {

          listState.page++;

          renderLeaderList();

        }
      );

  }


  // ============================================================
  // HELPERS
  // ============================================================

  function getJourney(
    employment
  ) {

    const journeys =
      asArray(
        employment.journeys
      );


    return (
      journeys.find(
        journey =>
          journey.status === 'ACTIVE'
          ||
          journey.status === 'IN_JOURNEY'
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

    const ids = [];


    employments.forEach(
      employment => {

        const journey =
          getJourney(employment);


        if (!journey) {
          return;
        }


        asArray(
          journey.journey_checkpoints
        )
          .forEach(
            checkpoint =>
              ids.push(
                checkpoint.id
              )
          );

      }
    );


    return [
      ...new Set(ids)
    ];

  }


  function checkpointSort(
    a,
    b
  ) {

    return (
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
    );

  }


  function answerValue(
    answer
  ) {

    if (
      answer.numeric_value !== null
      &&
      answer.numeric_value !== undefined
    ) {

      return `${answer.numeric_value} / 5`;

    }


    if (
      answer.boolean_value !== null
      &&
      answer.boolean_value !== undefined
    ) {

      return answer.boolean_value
        ? 'Sim'
        : 'Não';

    }


    return (
      answer.option_value
      ||
      answer.text_value
      ||
      '-'
    );

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
        char =>
          char.toUpperCase()
      );

  }


  function formatCPF(
    value
  ) {

    const cpf =
      String(
        value || ''
      )
        .replace(
          /\D/g,
          ''
        );


    if (
      cpf.length !== 11
    ) {
      return cpf;
    }


    return `${cpf.slice(0,3)}.${cpf.slice(3,6)}.${cpf.slice(6,9)}-${cpf.slice(9)}`;

  }


  // ============================================================
  // CSS
  // ============================================================

  function injectStyles() {

    if (
      document.getElementById(
        'assessmentModuleCSS'
      )
    ) {
      return;
    }


    const style =
      document.createElement(
        'style'
      );


    style.id =
      'assessmentModuleCSS';


    style.textContent = `

      .assessment-hero{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:20px;
        padding:24px;
        margin-bottom:18px;
        border-radius:16px;
        border:1px solid rgba(238,77,45,.16);
        background:linear-gradient(
          135deg,
          rgba(238,77,45,.11),
          rgba(238,77,45,.02)
        );
      }

      .assessment-hero>div>span,
      .assessment-eyebrow{
        color:#EE4D2D;
        font-size:10px;
        font-weight:800;
        letter-spacing:.1em;
      }

      .assessment-hero h2{
        margin:5px 0 7px;
      }

      .assessment-hero p{
        margin:0;
        opacity:.7;
      }

      .assessment-summary-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:12px;
        margin-bottom:18px;
      }

      .assessment-summary-grid>div{
        padding:15px;
        border:1px solid rgba(127,127,127,.16);
        border-radius:12px;
      }

      .assessment-summary-grid small,
      .assessment-summary-grid strong{
        display:block;
      }

      .assessment-summary-grid strong{
        margin-top:4px;
        font-size:24px;
      }

      .assessment-toolbar{
        display:grid;
        grid-template-columns:minmax(220px,2fr) repeat(3,minmax(150px,1fr));
        gap:9px;
        margin-bottom:12px;
      }

      .assessment-toolbar input,
      .assessment-toolbar select{
        width:100%;
        box-sizing:border-box;
        border:1px solid rgba(127,127,127,.2);
        border-radius:9px;
        padding:10px;
        background:transparent;
        color:inherit;
      }

      .assessment-list-info{
        margin-bottom:10px;
        font-size:12px;
        opacity:.65;
      }

      .assessment-row-actions{
        display:flex;
        gap:6px;
        flex-wrap:wrap;
      }

      .assessment-expanded-row td{
        background:rgba(127,127,127,.025);
      }

      .expanded-checkpoints{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
        padding:6px 0;
      }

      .expanded-checkpoint{
        display:flex;
        flex-direction:column;
        align-items:flex-start;
        gap:8px;
        padding:12px;
        border:1px solid rgba(127,127,127,.15);
        border-radius:10px;
      }

      .expanded-checkpoint b,
      .expanded-checkpoint small{
        display:block;
      }

      .assessment-pagination{
        display:flex;
        justify-content:flex-end;
        align-items:center;
        gap:10px;
        margin-top:15px;
      }

      .assessment-pagination button{
        width:34px;
        height:34px;
        border-radius:8px;
        border:1px solid rgba(127,127,127,.2);
        background:transparent;
        color:inherit;
        cursor:pointer;
      }

      .assessment-pagination button:disabled{
        opacity:.35;
        cursor:default;
      }

      .assessment-leader{
        display:flex;
        align-items:center;
        gap:14px;
        padding:16px;
        margin-bottom:18px;
        border-radius:13px;
        border:1px solid rgba(238,77,45,.16);
      }

      .assessment-leader>div:nth-child(2){
        flex:1;
      }

      .assessment-leader small,
      .assessment-leader strong,
      .assessment-leader span{
        display:block;
      }

      .leader-avatar{
        width:42px;
        height:42px;
        min-width:42px;
        display:flex;
        align-items:center;
        justify-content:center;
        border-radius:50%;
        background:rgba(238,77,45,.13);
        color:#EE4D2D;
        font-weight:800;
      }

      .assessment-checkpoints{
        display:flex;
        flex-direction:column;
        gap:9px;
      }

      .assessment-checkpoint{
        display:grid;
        grid-template-columns:55px minmax(0,1fr) auto auto;
        align-items:center;
        gap:12px;
        padding:13px;
        border:1px solid rgba(127,127,127,.15);
        border-radius:12px;
      }

      .checkpoint-code{
        width:48px;
        height:48px;
        display:flex;
        align-items:center;
        justify-content:center;
        border-radius:10px;
        background:rgba(238,77,45,.11);
        color:#EE4D2D;
      }

      .assessment-pill{
        display:inline-flex;
        border-radius:999px;
        padding:6px 9px;
        font-size:10px;
        font-weight:800;
        white-space:nowrap;
      }

      .assessment-pill.success{
        color:#169b50;
        background:rgba(22,155,80,.10);
      }

      .assessment-pill.warning{
        color:#EE4D2D;
        background:rgba(238,77,45,.10);
      }

      .assessment-pill.danger{
        color:#d14343;
        background:rgba(209,67,67,.10);
      }

      .assessment-pill.muted{
        opacity:.6;
        background:rgba(127,127,127,.1);
      }

      .assessment-outline{
        border:1px solid rgba(238,77,45,.3);
        border-radius:8px;
        background:transparent;
        color:#EE4D2D;
        padding:8px 11px;
        cursor:pointer;
        font-weight:700;
      }

      .leader-option{
        width:100%;
        display:flex;
        align-items:center;
        gap:12px;
        padding:12px;
        margin-bottom:8px;
        border-radius:10px;
        border:1px solid rgba(127,127,127,.16);
        background:transparent;
        color:inherit;
        text-align:left;
        cursor:pointer;
      }

      .leader-option>span:last-child{
        flex:1;
      }

      .leader-option strong,
      .leader-option small{
        display:block;
      }

      .assessment-modal-body{
        padding:20px;
      }

      .assessment-form-modal{
        max-height:88vh;
        overflow:auto;
      }

      .assessment-form{
        padding:22px;
      }

      .assessment-question{
        position:relative;
        padding:18px 0;
        border-bottom:1px solid rgba(127,127,127,.15);
      }

      .assessment-question>small,
      .assessment-question>strong{
        display:block;
        margin-left:40px;
      }

      .assessment-question>small{
        color:#EE4D2D;
        font-size:10px;
        font-weight:800;
      }

      .assessment-question>strong{
        margin-top:4px;
        margin-bottom:14px;
      }

      .question-number{
        position:absolute;
        left:0;
        top:18px;
        width:28px;
        height:28px;
        display:flex;
        align-items:center;
        justify-content:center;
        border-radius:7px;
        background:rgba(238,77,45,.11);
        color:#EE4D2D;
        font-weight:800;
      }

      .scale-options{
        display:grid;
        grid-template-columns:repeat(5,1fr);
        gap:8px;
        margin-left:40px;
      }

      .scale-options input,
      .choice-options input{
        position:absolute;
        opacity:0;
      }

      .scale-options span{
        height:42px;
        display:flex;
        align-items:center;
        justify-content:center;
        border:1px solid rgba(127,127,127,.2);
        border-radius:8px;
        cursor:pointer;
        font-weight:800;
      }

      .scale-options input:checked+span,
      .choice-options input:checked+span{
        background:#EE4D2D;
        border-color:#EE4D2D;
        color:#fff;
      }

      .scale-caption{
        display:flex;
        justify-content:space-between;
        margin:6px 0 0 40px;
        font-size:10px;
        opacity:.55;
      }

      .choice-options{
        display:flex;
        gap:8px;
        margin-left:40px;
      }

      .choice-options.vertical{
        flex-direction:column;
      }

      .choice-options span{
        display:block;
        padding:10px 14px;
        border:1px solid rgba(127,127,127,.2);
        border-radius:8px;
        cursor:pointer;
      }

      .assessment-question textarea{
        width:calc(100% - 40px);
        margin-left:40px;
        box-sizing:border-box;
        padding:11px;
        border:1px solid rgba(127,127,127,.2);
        border-radius:8px;
        background:transparent;
        color:inherit;
      }

      .assessment-form-footer{
        display:flex;
        justify-content:flex-end;
        gap:10px;
        margin-top:20px;
      }

      .view-answer{
        padding:14px 0;
        border-bottom:1px solid rgba(127,127,127,.14);
      }

      .view-answer small,
      .view-answer strong{
        display:block;
      }

      .view-answer small{
        color:#EE4D2D;
        font-weight:800;
      }

      .view-answer p{
        margin-bottom:0;
      }

      .assessment-empty{
        padding:50px 20px;
        text-align:center;
      }


      @media(max-width:1050px){

        .assessment-toolbar{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }

        .expanded-checkpoints{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }

      }


      @media(max-width:700px){

        .assessment-toolbar,
        .assessment-summary-grid,
        .expanded-checkpoints{
          grid-template-columns:1fr;
        }

        .assessment-checkpoint{
          grid-template-columns:50px minmax(0,1fr);
        }

      }

    `;


    document.head
      .appendChild(style);

  }


  console.log(
    'Shopee Journey: assessments.js escalável carregado.'
  );

})();
