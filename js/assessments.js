// ============================================================
// SHOPEE JOURNEY
// AVALIAÇÕES
// ============================================================

(function () {

  'use strict';


  let employmentsCache = [];

  let submissionsCache = [];


// ============================================================
// RELACIONAMENTO
// ============================================================

  function asArray(value) {

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


  function asObject(value) {

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
// ENTRADA PÚBLICA
// ============================================================

  window.loadAssessmentsPage =
    async function () {

      injectStyles();

      showPageLoading();


      try {

        if (
          currentProfile.role ===
          'EMPLOYEE'
        ) {

          await loadEmployee();

          return;

        }


        if (
          currentProfile.role ===
          'LEADER'
        ) {

          await loadLeader();

          return;

        }


        await loadManagement();

      }

      catch (error) {

        console.error(
          'Avaliações:',
          error
        );


        pageContent.innerHTML = `

          <div class="system-error">

            <h2>
              Não foi possível carregar as Avaliações
            </h2>

            <p>
              ${escapeHTML(
                error.message
              )}
            </p>

          </div>

        `;

      }

    };


// ============================================================
// COLABORADOR
// ============================================================

  async function loadEmployee() {

    const {
      data,
      error
    } =
      await journeySupabase
        .from('employments')
        .select(`
          id,
          leader_id,
          period_id,
          operation_id,
          admission_date,
          status,

          people (
            id,
            full_name
          ),

          operations (
            id,
            name,
            use_period_filter
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
          {
            ascending:
              false
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

      pageContent.innerHTML = `

        <div class="assessment-empty">

          <h2>
            Nenhuma Jornada encontrada
          </h2>

        </div>

      `;

      return;

    }


    const journey =
      getJourney(
        employment
      );


    if (!journey) {

      pageContent.innerHTML = `

        ${renderLeaderCard(
          employment
        )}


        <div class="assessment-empty">

          <h2>
            Jornada ainda não iniciada
          </h2>

          <p>
            Assim que a Jornada for iniciada,
            suas avaliações aparecerão aqui.
          </p>

        </div>

      `;


      bindLeaderCard(
        employment
      );

      return;

    }


    const checkpoints =
      asArray(
        journey
          .journey_checkpoints
      )
        .sort(
          checkpointSort
        );


    const checkpointIds =
      checkpoints.map(
        checkpoint =>
          checkpoint.id
      );


    let submissions = [];


    if (
      checkpointIds.length
    ) {

      const {
        data: submissionData,
        error: submissionError
      } =
        await journeySupabase
          .from(
            'journey_assessment_submissions'
          )
          .select(`
            id,
            checkpoint_id,
            status,
            submitted_at
          `)
          .in(
            'checkpoint_id',
            checkpointIds
          )
          .eq(
            'respondent_type',
            'EMPLOYEE'
          );


      if (submissionError) {
        throw submissionError;
      }


      submissions =
        submissionData ||
        [];

    }


    renderEmployee(
      employment,
      checkpoints,
      submissions
    );

  }


// ============================================================
// RENDER COLABORADOR
// ============================================================

  function renderEmployee(
    employment,
    checkpoints,
    submissions
  ) {

    const completed =
      submissions.filter(
        item =>
          item.status ===
          'SUBMITTED'
      )
        .length;


    pageContent.innerHTML = `

      <div class="assessment-hero">

        <div>

          <span>
            MINHA JORNADA
          </span>

          <h2>
            Suas Avaliações 🧡
          </h2>

          <p>
            Compartilhe como está sendo sua experiência
            ao longo dos primeiros 90 dias.
          </p>

        </div>


        <strong>
          ${completed}/${checkpoints.length}
        </strong>

      </div>


      ${renderLeaderCard(
        employment
      )}


      <section class="dashboard-panel">

        <div class="panel-header">

          <div>

            <h3>
              Checkpoints
            </h3>

            <p>
              Cada avaliação será liberada
              conforme sua Jornada avança.
            </p>

          </div>

        </div>


        <div class="assessment-checkpoints">

          ${
            checkpoints.length

            ? checkpoints.map(
                checkpoint => {

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

                }
              )
                .join('')

            : `

                <div class="assessment-empty">

                  Nenhum checkpoint encontrado.

                </div>

              `
          }

        </div>

      </section>

    `;


    bindLeaderCard(
      employment
    );


    document
      .querySelectorAll(
        '[data-answer-checkpoint]'
      )
      .forEach(
        button => {

          button.addEventListener(
            'click',
            () => {

              openEmployeeAssessment(
                button
                  .dataset
                  .answerCheckpoint
              );

            }
          );

        }
      );


    document
      .querySelectorAll(
        '[data-view-submission]'
      )
      .forEach(
        button => {

          button.addEventListener(
            'click',
            () => {

              viewSubmission(
                button
                  .dataset
                  .viewSubmission
              );

            }
          );

        }
      );

  }


// ============================================================
// CHECKPOINT DO COLABORADOR
// ============================================================

  function renderCheckpoint(
    checkpoint,
    submission
  ) {

    const availability =
      availabilityStatus(
        checkpoint
      );


    if (
      submission?.status ===
      'SUBMITTED'
    ) {

      return `

        <div class="assessment-checkpoint">

          <b class="checkpoint-code">

            ${escapeHTML(
              checkpoint.checkpoint
            )}

          </b>


          <div>

            <strong>
              Avaliação respondida
            </strong>

            <small>
              ${formatDate(
                submission.submitted_at
              )}
            </small>

          </div>


          <span class="assessment-pill success">
            ✓ Respondida
          </span>


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
      availability ===
      'FUTURE'
    ) {

      return `

        <div class="assessment-checkpoint">

          <b class="checkpoint-code">

            ${escapeHTML(
              checkpoint.checkpoint
            )}

          </b>


          <div>

            <strong>
              Em breve
            </strong>

            <small>
              Libera em
              ${formatDate(
                checkpoint.opens_at
              )}
            </small>

          </div>


          <span class="assessment-pill muted">
            🔒 Bloqueada
          </span>

        </div>

      `;

    }


    return `

      <div class="assessment-checkpoint">

        <b class="checkpoint-code">

          ${escapeHTML(
            checkpoint.checkpoint
          )}

        </b>


        <div>

          <strong>

            ${
              submission?.status ===
              'DRAFT'

              ? 'Continuar avaliação'

              : 'Avaliação disponível'
            }

          </strong>

          <small>

            ${
              availability ===
              'OVERDUE'

              ? 'Prazo original: '

              : 'Prazo: '
            }

            ${formatDate(
              checkpoint.due_at
            )}

          </small>

        </div>


        <span
          class="assessment-pill ${
            availability ===
            'OVERDUE'
              ? 'danger'
              : 'warning'
          }"
        >

          ${
            availability ===
            'OVERDUE'

            ? '⚠ Em atraso'

            : submission?.status ===
              'DRAFT'

              ? 'Rascunho'

              : 'Disponível'
          }

        </span>


        <button
          class="primary-action-button"
          type="button"
          data-answer-checkpoint="${checkpoint.id}"
        >

          ${
            submission?.status ===
            'DRAFT'

            ? 'Continuar'

            : 'Responder'
          }

        </button>

      </div>

    `;

  }


// ============================================================
// CARD DO LÍDER
// ============================================================

  function renderLeaderCard(
    employment
  ) {

    const leader =
      asObject(
        employment.leader
      );


    const operation =
      asObject(
        employment.operations
      );


    if (leader) {

      return `

        <div class="assessment-leader">

          <div class="leader-avatar">

            ${getInitials(
              leader.full_name
            )}

          </div>


          <div>

            <small>
              Seu líder atual
            </small>

            <strong>
              ${escapeHTML(
                leader.full_name
              )}
            </strong>

            <span>
              ${escapeHTML(
                operation?.name
                ||
                ''
              )}
            </span>

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

          <small>
            Liderança não identificada
          </small>

          <strong>
            Quem é seu líder?
          </strong>

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


// ============================================================
// EVENTOS LÍDER DO COLABORADOR
// ============================================================

  function bindLeaderCard(
    employment
  ) {

    document
      .getElementById(
        'chooseEmployeeLeader'
      )
      ?.addEventListener(
        'click',
        () =>
          chooseLeader(
            employment
          )
      );


    document
      .getElementById(
        'changeEmployeeLeader'
      )
      ?.addEventListener(
        'click',
        () =>
          chooseLeader(
            employment
          )
      );

  }


// ============================================================
// ESCOLHER LÍDER
// ============================================================

  async function chooseLeader(
    employment
  ) {

    const {
      data,
      error
    } =
      await journeySupabase
        .rpc(
          'get_eligible_leaders_for_employment',
          {
            p_employment_id:
              employment.id
          }
        );


    if (error) {

      alert(
        error.message
      );

      return;

    }


    const leaders =
      data ||
      [];


    if (!leaders.length) {

      alert(
        'Nenhuma liderança elegível encontrada.'
      );

      return;

    }


    openGenericModal(`

      <div class="modal-header">

        <div>

          <h2>
            Quem é seu líder?
          </h2>

          <p>
            Selecione sua liderança atual.
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

        ${
          leaders.map(
            leader => `

              <button
                class="leader-option"
                type="button"
                data-leader-id="${leader.leader_id}"
                data-leader-name="${escapeHTML(
                  leader.full_name
                )}"
              >

                <span class="leader-avatar">

                  ${getInitials(
                    leader.full_name
                  )}

                </span>


                <span>

                  <strong>
                    ${escapeHTML(
                      leader.full_name
                    )}
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
      .querySelectorAll(
        '.leader-option'
      )
      .forEach(
        button => {

          button.addEventListener(
            'click',
            async () => {

              await setLeader(
                employment,
                button.dataset.leaderId,
                button.dataset.leaderName
              );

            }
          );

        }
      );

  }


// ============================================================
// SALVAR LÍDER
// ============================================================

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


    const {
      error
    } =
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

      alert(
        error.message
      );

      return;

    }


    closeGenericModal();


    await loadEmployee();

  }


// ============================================================
// ABRIR AVALIAÇÃO DO COLABORADOR
// ============================================================

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

      alert(
        error.message
      );

      return;

    }


    await openForm(
      submissionId
    );

  }


// ============================================================
// LÍDER
// ============================================================

  async function loadLeader() {

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
        .eq(
          'leader_id',
          currentProfile.id
        )
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


    employmentsCache =
      data ||
      [];


    const checkpointIds =
      collectCheckpointIds(
        employmentsCache
      );


    submissionsCache = [];


    if (
      checkpointIds.length
    ) {

      const {
        data: submissions,
        error: submissionError
      } =
        await journeySupabase
          .from(
            'journey_assessment_submissions'
          )
          .select(`
            id,
            checkpoint_id,
            status,
            submitted_at
          `)
          .in(
            'checkpoint_id',
            checkpointIds
          )
          .eq(
            'respondent_type',
            'LEADER'
          );


      if (submissionError) {
        throw submissionError;
      }


      submissionsCache =
        submissions ||
        [];

    }


    renderLeader();

  }


// ============================================================
// RENDER LÍDER
// ============================================================

  function renderLeader() {

    const items = [];


    employmentsCache
      .forEach(
        employment => {

          const journey =
            getJourney(
              employment
            );


          if (!journey) {
            return;
          }


          asArray(
            journey
              .journey_checkpoints
          )
            .forEach(
              checkpoint => {

                const submission =
                  submissionsCache
                    .find(
                      item =>
                        item.checkpoint_id ===
                        checkpoint.id
                    );


                let status =
                  availabilityStatus(
                    checkpoint
                  );


                if (
                  submission?.status ===
                  'SUBMITTED'
                ) {

                  status =
                    'SUBMITTED';

                }

                else if (
                  submission?.status ===
                  'DRAFT'
                ) {

                  status =
                    'DRAFT';

                }


                items.push({

                  employment,
                  checkpoint,
                  submission,
                  status

                });

              }
            );

        }
      );


    pageContent.innerHTML = `

      <div class="assessment-hero">

        <div>

          <span>
            AVALIAÇÕES DA EQUIPE
          </span>

          <h2>
            Acompanhamento da Liderança
          </h2>

          <p>
            Avalie os colaboradores sob sua responsabilidade.
          </p>

        </div>

      </div>


      <section class="dashboard-panel">

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
                  Etapa
                </th>

                <th>
                  Prazo
                </th>

                <th>
                  Status
                </th>

                <th>
                  Ação
                </th>

              </tr>

            </thead>


            <tbody>

              ${
                items.length

                ? items.map(
                    item => {

                      const employee =
                        asObject(
                          item
                            .employment
                            .people
                        );


                      const operation =
                        asObject(
                          item
                            .employment
                            .operations
                        );


                      return `

                        <tr>

                          <td>

                            ${escapeHTML(
                              employee
                                ?.full_name
                              ||
                              ''
                            )}

                          </td>


                          <td>

                            ${escapeHTML(
                              operation
                                ?.name
                              ||
                              '-'
                            )}

                          </td>


                          <td>

                            ${escapeHTML(
                              item
                                .checkpoint
                                .checkpoint
                            )}

                          </td>


                          <td>

                            ${formatDate(
                              item
                                .checkpoint
                                .due_at
                            )}

                          </td>


                          <td>

                            ${statusBadge(
                              item.status
                            )}

                          </td>


                          <td>

                            ${
                              item.status ===
                              'FUTURE'

                              ? '—'

                              : item.status ===
                                'SUBMITTED'

                                ? `

                                  <button
                                    class="assessment-outline"
                                    type="button"
                                    data-view-submission="${item.submission.id}"
                                  >
                                    Ver
                                  </button>

                                `

                                : `

                                  <button
                                    class="primary-action-button"
                                    type="button"
                                    data-leader-checkpoint="${item.checkpoint.id}"
                                  >
                                    ${
                                      item.status ===
                                      'DRAFT'
                                        ? 'Continuar'
                                        : 'Responder'
                                    }
                                  </button>

                                `
                            }

                          </td>

                        </tr>

                      `;

                    }
                  )
                    .join('')

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
                        button
                          .dataset
                          .leaderCheckpoint
                    }
                  );


              if (error) {

                alert(
                  error.message
                );

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
// ADM / RH MANAGER
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
          {
            ascending:
              false
          }
        );


    if (error) {
      throw error;
    }


    employmentsCache =
      data ||
      [];


    const checkpointIds =
      collectCheckpointIds(
        employmentsCache
      );


    submissionsCache = [];


    if (
      checkpointIds.length
    ) {

      const {
        data: submissions,
        error: submissionError
      } =
        await journeySupabase
          .from(
            'journey_assessment_submissions'
          )
          .select(`
            id,
            checkpoint_id,
            respondent_type,
            status,
            submitted_at
          `)
          .in(
            'checkpoint_id',
            checkpointIds
          );


      if (submissionError) {
        throw submissionError;
      }


      submissionsCache =
        submissions ||
        [];

    }


    renderManagement();

  }


// ============================================================
// RENDER GESTÃO
// ============================================================

  function renderManagement() {

    const items = [];


    employmentsCache
      .forEach(
        employment => {

          const journey =
            getJourney(
              employment
            );


          if (!journey) {
            return;
          }


          asArray(
            journey
              .journey_checkpoints
          )
            .forEach(
              checkpoint => {

                const employeeSubmission =
                  submissionsCache
                    .find(
                      item =>
                        item.checkpoint_id ===
                          checkpoint.id
                        &&
                        item.respondent_type ===
                          'EMPLOYEE'
                    );


                const leaderSubmission =
                  submissionsCache
                    .find(
                      item =>
                        item.checkpoint_id ===
                          checkpoint.id
                        &&
                        item.respondent_type ===
                          'LEADER'
                    );


                items.push({

                  employment,
                  checkpoint,
                  employeeSubmission,
                  leaderSubmission

                });

              }
            );

        }
      );


    pageContent.innerHTML = `

      <div class="assessment-hero">

        <div>

          <span>
            AVALIAÇÕES DA JORNADA
          </span>

          <h2>
            D1 → D90
          </h2>

          <p>
            Compare a visão do colaborador
            e da liderança.
          </p>

        </div>

      </div>


      <section class="dashboard-panel">

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
                  Etapa
                </th>

                <th>
                  Colaborador
                </th>

                <th>
                  Liderança
                </th>

                <th>
                  Prazo
                </th>

              </tr>

            </thead>


            <tbody>

              ${
                items.length

                ? items.map(
                    item => {

                      const employment =
                        item.employment;


                      const employee =
                        asObject(
                          employment.people
                        );


                      const operation =
                        asObject(
                          employment.operations
                        );


                      return `

                        <tr>

                          <td>

                            <strong>

                              ${escapeHTML(
                                employee
                                  ?.full_name
                                ||
                                ''
                              )}

                            </strong>

                          </td>


                          <td>

                            ${escapeHTML(
                              operation
                                ?.name
                              ||
                              '-'
                            )}

                          </td>


                          <td>

                            <strong>

                              ${escapeHTML(
                                item
                                  .checkpoint
                                  .checkpoint
                              )}

                            </strong>

                          </td>


                          <td>

                            ${sideStatus(
                              item.checkpoint,
                              item.employeeSubmission,
                              false
                            )}

                          </td>


                          <td>

                            ${
                              !employment.leader_id
                              &&
                              !item.leaderSubmission

                              ? `

                                <span class="assessment-pill danger">
                                  ⚠ Sem líder
                                </span>

                              `

                              : sideStatus(
                                  item.checkpoint,
                                  item.leaderSubmission,
                                  true
                                )
                            }

                          </td>


                          <td>

                            ${formatDate(
                              item
                                .checkpoint
                                .due_at
                            )}

                          </td>

                        </tr>

                      `;

                    }
                  )
                    .join('')

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


    bindViewButtons();

  }


// ============================================================
// STATUS LADO RH
// ============================================================

  function sideStatus(
    checkpoint,
    submission
  ) {

    if (
      submission?.status ===
      'SUBMITTED'
    ) {

      return `

        <button
          class="assessment-outline"
          type="button"
          data-view-submission="${submission.id}"
        >
          ✓ Respondida
        </button>

      `;

    }


    if (
      submission?.status ===
      'DRAFT'
    ) {

      return `

        <span class="assessment-pill warning">
          Rascunho
        </span>

      `;

    }


    return statusBadge(
      availabilityStatus(
        checkpoint
      )
    );

  }


// ============================================================
// FORMULÁRIO
// ============================================================

  async function openForm(
    submissionId
  ) {

    const {
      data: submission,
      error
    } =
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


    if (error) {

      alert(
        error.message
      );

      return;

    }


    const checkpoint =
      asObject(
        submission
          .journey_checkpoints
      );


    const employment =
      asObject(
        submission.employments
      );


    const employee =
      asObject(
        employment?.people
      );


    const {
      data: questions,
      error: questionError
    } =
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


    if (questionError) {

      alert(
        questionError.message
      );

      return;

    }


    if (
      !questions?.length
    ) {

      alert(
        `Ainda não existem perguntas cadastradas para ${checkpoint.checkpoint}.`
      );

      return;

    }


    const {
      data: answers,
      error: answerError
    } =
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


    if (answerError) {

      alert(
        answerError.message
      );

      return;

    }


    openGenericModal(`

      <div class="assessment-form-modal">

        <div class="modal-header">

          <div>

            <span class="assessment-eyebrow">
              ${escapeHTML(
                checkpoint.checkpoint
              )}
            </span>

            <h2>

              ${escapeHTML(
                employee?.full_name
                ||
                currentProfile.full_name
              )}

            </h2>

            <p>

              Prazo:
              ${formatDate(
                checkpoint.due_at
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
          id="assessmentForm"
          class="assessment-form"
        >

          ${
            questions.map(
              (
                question,
                index
              ) => {

                const answer =
                  (
                    answers ||
                    []
                  )
                    .find(
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


// ============================================================
// PERGUNTA
// ============================================================

  function renderQuestion(
    question,
    answer,
    index
  ) {

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
            question.dimension
            ||
            ''
          )}

        </small>


        <strong>

          ${escapeHTML(
            question.question_text
          )}

        </strong>


        ${
          question.question_type ===
          'SCALE_1_5'

          ? renderScale(
              question,
              answer
            )

          : question.question_type ===
            'YES_NO'

            ? renderYesNo(
                question,
                answer
              )

            : question.question_type ===
              'TEXT'

              ? `

                <textarea
                  data-text-answer
                  rows="4"
                  placeholder="Digite sua resposta..."
                >${escapeHTML(
                  answer?.text_value
                  ||
                  ''
                )}</textarea>

              `

              : renderChoice(
                  question,
                  answer
                )
        }

      </div>

    `;

  }


// ============================================================
// ESCALA
// ============================================================

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
                      ) ===
                      number
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


// ============================================================
// SIM/NÃO
// ============================================================

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
              answer?.boolean_value ===
              true
                ? 'checked'
                : ''
            }
          >

          <span>
            Sim
          </span>

        </label>


        <label>

          <input
            type="radio"
            name="q_${question.id}"
            value="false"
            ${
              answer?.boolean_value ===
              false
                ? 'checked'
                : ''
            }
          >

          <span>
            Não
          </span>

        </label>

      </div>

    `;

  }


// ============================================================
// ESCOLHA
// ============================================================

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
          options.map(
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


// ============================================================
// SALVAR
// ============================================================

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


            let numeric =
              null;

            let text =
              null;

            let boolean =
              null;

            let option =
              null;

            let hasValue =
              false;


            if (
              question.question_type ===
              'SCALE_1_5'
            ) {

              const selected =
                container
                  ?.querySelector(
                    `input[name="q_${question.id}"]:checked`
                  );


              if (selected) {

                numeric =
                  Number(
                    selected.value
                  );

                hasValue =
                  true;

              }

            }


            else if (
              question.question_type ===
              'YES_NO'
            ) {

              const selected =
                container
                  ?.querySelector(
                    `input[name="q_${question.id}"]:checked`
                  );


              if (selected) {

                boolean =
                  selected.value ===
                  'true';

                hasValue =
                  true;

              }

            }


            else if (
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

            }


            else {

              const selected =
                container
                  ?.querySelector(
                    `input[name="q_${question.id}"]:checked`
                  );


              if (selected) {

                option =
                  selected.value;

                hasValue =
                  true;

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


        const {
          error
        } =
          await journeySupabase
            .rpc(
              'save_journey_assessment_answer',
              {
                p_submission_id:
                  submissionId,

                p_question_id:
                  response
                    .question
                    .id,

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


      const {
        error
      } =
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

    }

    catch (error) {

      console.error(
        error
      );


      alert(
        error.message
        ||
        'Não foi possível salvar.'
      );

    }

  }


// ============================================================
// VISUALIZAR
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

      alert(
        error.message
      );

      return;

    }


    const answers =
      data ||
      [];


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
          answers.map(
            answer => {

              const question =
                asObject(
                  answer
                    .journey_assessment_questions
                );


              return `

                <div class="view-answer">

                  <small>

                    ${escapeHTML(
                      question?.dimension
                      ||
                      ''
                    )}

                  </small>

                  <strong>

                    ${escapeHTML(
                      question?.question_text
                      ||
                      ''
                    )}

                  </strong>

                  <p>

                    ${escapeHTML(
                      answerValue(
                        answer
                      )
                    )}

                  </p>

                </div>

              `;

            }
          )
            .join('')
        }

      </div>

    `;

  }


// ============================================================
// BOTÕES DE VISUALIZAÇÃO
// ============================================================

  function bindViewButtons() {

    document
      .querySelectorAll(
        '[data-view-submission]'
      )
      .forEach(
        button => {

          button.addEventListener(
            'click',
            () => {

              viewSubmission(
                button
                  .dataset
                  .viewSubmission
              );

            }
          );

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
          journey.status ===
          'ACTIVE'
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
          getJourney(
            employment
          );


        if (!journey) {
          return;
        }


        asArray(
          journey
            .journey_checkpoints
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

    const order = {

      D1:
        1,

      D7:
        7,

      D15:
        15,

      D30:
        30,

      D45:
        45,

      D90:
        90

    };


    return (
      (
        order[
          a.checkpoint
        ]
        ||
        999
      )
      -
      (
        order[
          b.checkpoint
        ]
        ||
        999
      )
    );

  }


  function availabilityStatus(
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

      return 'FUTURE';

    }


    if (
      now > due
    ) {

      return 'OVERDUE';

    }


    return 'AVAILABLE';

  }


  function statusBadge(
    status
  ) {

    const values = {

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
      label
    ] =
      values[status]
      ||
      values.FUTURE;


    return `

      <span class="assessment-pill ${css}">
        ${label}
      </span>

    `;

  }


  function formatDate(
    value
  ) {

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


  function answerValue(
    answer
  ) {

    if (
      answer.numeric_value !==
      null
      &&
      answer.numeric_value !==
      undefined
    ) {

      return (
        answer.numeric_value
        +
        ' / 5'
      );

    }


    if (
      answer.boolean_value !==
      null
      &&
      answer.boolean_value !==
      undefined
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


// ============================================================
// EXPOR MODAL TAMBÉM
// ============================================================

  window.openGenericModal =
    openGenericModal;


  window.closeGenericModal =
    closeGenericModal;


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

      .assessment-hero {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:20px;
        padding:26px;
        margin-bottom:20px;
        border-radius:18px;
        border:1px solid rgba(238,77,45,.18);
        background:
          linear-gradient(
            135deg,
            rgba(238,77,45,.12),
            rgba(238,77,45,.02)
          );
      }

      .assessment-hero > div > span,
      .assessment-eyebrow {
        color:#EE4D2D;
        font-size:10px;
        font-weight:800;
        letter-spacing:.1em;
      }

      .assessment-hero h2 {
        margin:5px 0 8px;
      }

      .assessment-hero p {
        margin:0;
        opacity:.7;
      }

      .assessment-hero > strong {
        color:#EE4D2D;
        font-size:24px;
      }

      .assessment-leader {
        display:flex;
        align-items:center;
        gap:14px;
        padding:17px;
        margin-bottom:20px;
        border-radius:14px;
        border:1px solid rgba(238,77,45,.18);
      }

      .assessment-leader > div:nth-child(2) {
        flex:1;
      }

      .assessment-leader small,
      .assessment-leader strong,
      .assessment-leader span {
        display:block;
      }

      .assessment-leader small,
      .assessment-leader span {
        opacity:.65;
      }

      .leader-avatar {
        width:42px;
        height:42px;
        min-width:42px;
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        background:rgba(238,77,45,.14);
        color:#EE4D2D;
        font-weight:800;
      }

      .assessment-checkpoints {
        display:flex;
        flex-direction:column;
        gap:10px;
      }

      .assessment-checkpoint {
        display:grid;
        grid-template-columns:
          55px minmax(0,1fr) auto auto;
        align-items:center;
        gap:12px;
        padding:14px;
        border:1px solid rgba(127,127,127,.16);
        border-radius:13px;
      }

      .assessment-checkpoint small,
      .assessment-checkpoint strong {
        display:block;
      }

      .assessment-checkpoint small {
        opacity:.65;
        margin-top:4px;
      }

      .checkpoint-code {
        width:48px;
        height:48px;
        display:flex;
        align-items:center;
        justify-content:center;
        border-radius:11px;
        background:rgba(238,77,45,.12);
        color:#EE4D2D;
      }

      .assessment-pill {
        display:inline-flex;
        padding:6px 9px;
        border-radius:999px;
        font-size:10px;
        font-weight:800;
        white-space:nowrap;
      }

      .assessment-pill.success {
        color:#35b76c;
        background:rgba(53,183,108,.11);
      }

      .assessment-pill.warning {
        color:#EE4D2D;
        background:rgba(238,77,45,.11);
      }

      .assessment-pill.danger {
        color:#e15757;
        background:rgba(225,87,87,.11);
      }

      .assessment-pill.muted {
        opacity:.6;
        background:rgba(127,127,127,.10);
      }

      .assessment-outline {
        border:1px solid rgba(238,77,45,.3);
        border-radius:8px;
        background:transparent;
        color:#EE4D2D;
        padding:8px 11px;
        cursor:pointer;
        font-weight:700;
      }

      .assessment-modal-body {
        padding:20px;
      }

      .leader-option {
        width:100%;
        display:flex;
        align-items:center;
        gap:12px;
        padding:12px;
        margin-bottom:8px;
        border-radius:11px;
        border:1px solid rgba(127,127,127,.16);
        background:transparent;
        color:inherit;
        text-align:left;
        cursor:pointer;
      }

      .leader-option > span:last-child {
        flex:1;
      }

      .leader-option strong,
      .leader-option small {
        display:block;
      }

      .assessment-form-modal {
        max-height:88vh;
        overflow:auto;
      }

      .assessment-form {
        padding:22px;
      }

      .assessment-question {
        position:relative;
        padding:18px 0;
        border-bottom:1px solid rgba(127,127,127,.15);
      }

      .assessment-question > small,
      .assessment-question > strong {
        display:block;
        margin-left:40px;
      }

      .assessment-question > small {
        color:#EE4D2D;
        font-size:10px;
        font-weight:800;
        text-transform:uppercase;
      }

      .assessment-question > strong {
        margin-top:4px;
        margin-bottom:14px;
      }

      .question-number {
        position:absolute;
        left:0;
        top:18px;
        width:28px;
        height:28px;
        display:flex;
        align-items:center;
        justify-content:center;
        border-radius:7px;
        background:rgba(238,77,45,.12);
        color:#EE4D2D;
        font-weight:800;
      }

      .scale-options {
        display:grid;
        grid-template-columns:repeat(5,1fr);
        gap:8px;
        margin-left:40px;
      }

      .scale-options input,
      .choice-options input {
        position:absolute;
        opacity:0;
      }

      .scale-options span {
        height:44px;
        display:flex;
        align-items:center;
        justify-content:center;
        border:1px solid rgba(127,127,127,.2);
        border-radius:9px;
        cursor:pointer;
        font-weight:800;
      }

      .scale-options input:checked + span,
      .choice-options input:checked + span {
        background:#EE4D2D;
        border-color:#EE4D2D;
        color:white;
      }

      .scale-caption {
        display:flex;
        justify-content:space-between;
        margin:6px 0 0 40px;
        opacity:.55;
        font-size:10px;
      }

      .choice-options {
        display:flex;
        gap:8px;
        margin-left:40px;
      }

      .choice-options.vertical {
        flex-direction:column;
      }

      .choice-options span {
        display:block;
        padding:10px 14px;
        border:1px solid rgba(127,127,127,.2);
        border-radius:8px;
        cursor:pointer;
      }

      .assessment-question textarea {
        width:calc(100% - 40px);
        margin-left:40px;
        box-sizing:border-box;
        padding:11px;
        background:transparent;
        color:inherit;
        border:1px solid rgba(127,127,127,.2);
        border-radius:9px;
        resize:vertical;
      }

      .assessment-form-footer {
        display:flex;
        justify-content:flex-end;
        gap:10px;
        margin-top:20px;
      }

      .view-answer {
        padding:14px 0;
        border-bottom:1px solid rgba(127,127,127,.14);
      }

      .view-answer small,
      .view-answer strong {
        display:block;
      }

      .view-answer small {
        color:#EE4D2D;
        font-weight:800;
      }

      .view-answer strong {
        margin:4px 0 7px;
      }

      .view-answer p {
        margin:0;
      }

      .assessment-empty {
        padding:60px 20px;
        text-align:center;
      }

      @media(max-width:800px) {

        .assessment-checkpoint {
          grid-template-columns:
            50px minmax(0,1fr);
        }

        .assessment-checkpoint
        > .assessment-pill,
        .assessment-checkpoint
        > button {
          grid-column:2;
          justify-self:start;
        }

        .assessment-leader,
        .assessment-hero {
          align-items:flex-start;
          flex-direction:column;
        }

      }

    `;


    document.head
      .appendChild(
        style
      );

  }


// ============================================================
// SINAL PARA DIAGNÓSTICO
// ============================================================

  console.log(
    'Shopee Journey: módulo assessments.js carregado com sucesso.'
  );

})();
