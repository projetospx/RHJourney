(function () {
  'use strict';

  const SELECTOR = '.dimension-grid .dimension-card';
  const MODAL_ID = 'indicatorDetailsOverlay';
  const QUERY_TIMEOUT_MS = 15000;
  const QUERY_CHUNK_SIZE = 150;

  let detailsPromise = null;
  let observedGrid = null;
  let lastFocusedCard = null;

  document.addEventListener('DOMContentLoaded', initialize);

  function initialize() {
    const content = document.getElementById('pageContent');

    if (!content) {
      return;
    }

    prepareCards();

    new MutationObserver(prepareCards).observe(content, {
      childList: true,
      subtree: true
    });

    document.addEventListener('click', handleCardClick);
    document.addEventListener('keydown', handleKeydown);
  }

  function prepareCards() {
    const grid = document.querySelector('.dimension-grid');

    if (!grid) {
      return;
    }

    if (grid !== observedGrid) {
      observedGrid = grid;
      detailsPromise = null;
    }

    grid.querySelectorAll('.dimension-card').forEach(card => {
      if (card.dataset.indicatorDetailsReady === 'true') {
        return;
      }

      const title = getCardTitle(card);

      card.dataset.indicatorDetailsReady = 'true';
      card.classList.add('indicator-details-ready');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-haspopup', 'dialog');
      card.setAttribute(
        'aria-label',
        `Ver o que compôs a nota de ${title || 'esta dimensão'}`
      );
      card.title = 'Clique para ver o que compôs esta nota';

      const hint = document.createElement('span');
      hint.className = 'indicator-details-hint';
      hint.dataset.indicatorDetailsHint = 'true';
      hint.setAttribute('aria-hidden', 'true');
      hint.textContent = 'Ver detalhes';
      card.appendChild(hint);
    });
  }

  function handleCardClick(event) {
    const card = event.target.closest(SELECTOR);

    if (!card) {
      return;
    }

    openCardDetails(card);
  }

  function handleKeydown(event) {
    if (event.key === 'Escape' && document.getElementById(MODAL_ID)) {
      closeModal();
      return;
    }

    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    const card = event.target.closest(SELECTOR);

    if (!card) {
      return;
    }

    event.preventDefault();
    openCardDetails(card);
  }

  async function openCardDetails(card) {
    lastFocusedCard = card;
    card.setAttribute('aria-busy', 'true');

    openModal(renderLoading(getCardTitle(card)));

    try {
      const groups = await getDetails();
      assignGroupsToCards(groups);

      const groupIndex = Number(card.dataset.indicatorDetailIndex);
      const group = Number.isInteger(groupIndex)
        ? groups[groupIndex]
        : null;

      if (!group) {
        throw new Error(
          'Não foi possível relacionar este card às respostas atuais.'
        );
      }

      openModal(renderDetails(group));
    } catch (error) {
      console.error('Detalhamento dos Indicadores:', error);
      detailsPromise = null;
      openModal(renderError(error));
    } finally {
      card.removeAttribute('aria-busy');
    }
  }

  function getDetails() {
    if (!detailsPromise) {
      detailsPromise = withTimeout(
        fetchIndicatorDetails(),
        QUERY_TIMEOUT_MS,
        'O detalhamento demorou mais que o esperado. Tente novamente.'
      );
    }

    return detailsPromise;
  }

  async function fetchIndicatorDetails() {
    if (typeof journeySupabase === 'undefined' || !journeySupabase) {
      throw new Error('A conexão com o banco ainda não está disponível.');
    }

    const employmentResult = await journeySupabase
      .from('employments')
      .select(`
        id,
        status,
        journeys (
          id,
          status,
          journey_checkpoints (
            id,
            checkpoint
          )
        )
      `)
      .in('status', ['IN_JOURNEY', 'COMPLETED']);

    if (employmentResult.error) {
      throw employmentResult.error;
    }

    const checkpointById = new Map();

    (employmentResult.data || []).forEach(employment => {
      const journey = getEmploymentJourney(employment);

      asArray(journey?.journey_checkpoints).forEach(checkpoint => {
        checkpointById.set(checkpoint.id, checkpoint.checkpoint || '—');
      });
    });

    const checkpointIds = [...checkpointById.keys()];

    if (!checkpointIds.length) {
      return [];
    }

    const submissions = await selectInChunks(
      'journey_assessment_submissions',
      `
        id,
        checkpoint_id,
        employment_id,
        respondent_type,
        status,
        submitted_at
      `,
      'checkpoint_id',
      checkpointIds
    );

    const submitted = submissions.filter(item => item.status === 'SUBMITTED');
    const submissionById = new Map(
      submitted.map(item => [item.id, item])
    );
    const submissionIds = [...submissionById.keys()];

    if (!submissionIds.length) {
      return [];
    }

    const answers = await selectInChunks(
      'journey_assessment_answers',
      `
        submission_id,
        numeric_value,
        journey_assessment_questions (
          id,
          dimension,
          question_text,
          question_type,
          display_order
        )
      `,
      'submission_id',
      submissionIds
    );

    const grouped = new Map();

    answers.forEach(answer => {
      if (answer.numeric_value === null || answer.numeric_value === undefined) {
        return;
      }

      const value = Number(answer.numeric_value);
      const question = asObject(answer.journey_assessment_questions);
      const submission = submissionById.get(answer.submission_id);

      if (!Number.isFinite(value) || !question || !submission) {
        return;
      }

      const dimension = question.dimension || 'GERAL';

      if (!grouped.has(dimension)) {
        grouped.set(dimension, []);
      }

      grouped.get(dimension).push({
        value,
        question: question.question_text || 'Pergunta sem descrição',
        displayOrder: Number(question.display_order) || 0,
        checkpoint: checkpointById.get(submission.checkpoint_id) || '—',
        respondentType: submission.respondent_type || '—',
        submittedAt: submission.submitted_at || null
      });
    });

    return [...grouped.entries()]
      .map(([dimension, items]) => ({
        dimension,
        title: prettyDimension(dimension),
        items,
        count: items.length,
        average: average(items.map(item => item.value))
      }))
      .sort((a, b) => (a.average ?? 99) - (b.average ?? 99));
  }

  async function selectInChunks(table, columns, filterColumn, values) {
    const result = [];

    for (let index = 0; index < values.length; index += QUERY_CHUNK_SIZE) {
      const chunk = values.slice(index, index + QUERY_CHUNK_SIZE);
      const queryResult = await journeySupabase
        .from(table)
        .select(columns)
        .in(filterColumn, chunk);

      if (queryResult.error) {
        throw queryResult.error;
      }

      result.push(...(queryResult.data || []));
    }

    return result;
  }

  function assignGroupsToCards(groups) {
    const cards = [...document.querySelectorAll(SELECTOR)];
    const used = new Set();

    cards.forEach(card => {
      const title = getCardTitle(card);
      const score = getCardScore(card);
      const count = getCardCount(card);

      let index = groups.findIndex((group, groupIndex) =>
        !used.has(groupIndex) &&
        normalizeText(group.title) === normalizeText(title) &&
        group.count === count &&
        scoresMatch(group.average, score)
      );

      if (index < 0) {
        index = groups.findIndex((group, groupIndex) =>
          !used.has(groupIndex) &&
          normalizeText(group.title) === normalizeText(title) &&
          group.count === count
        );
      }

      if (index < 0) {
        index = groups.findIndex((group, groupIndex) =>
          !used.has(groupIndex) &&
          normalizeText(group.title) === normalizeText(title)
        );
      }

      if (index >= 0) {
        used.add(index);
        card.dataset.indicatorDetailIndex = String(index);
      } else {
        delete card.dataset.indicatorDetailIndex;
      }
    });
  }

  function renderLoading(title) {
    return `
      <div class="indicator-detail-header">
        <div>
          <span>COMPOSIÇÃO DA NOTA</span>
          <h2>${escapeHTML(title || 'Dimensão')}</h2>
        </div>
        ${closeButton()}
      </div>
      <div class="indicator-detail-body">
        <div class="indicator-detail-loading" role="status">
          Buscando as respostas que formaram esta média...
        </div>
      </div>
    `;
  }

  function renderDetails(group) {
    const values = group.items.map(item => item.value);
    const sum = values.reduce((total, value) => total + value, 0);
    const sortedItems = group.items
      .slice()
      .sort((a, b) =>
        a.value - b.value ||
        checkpointNumber(a.checkpoint) - checkpointNumber(b.checkpoint) ||
        a.displayOrder - b.displayOrder
      );

    return `
      <div class="indicator-detail-header">
        <div>
          <span>COMPOSIÇÃO DA NOTA</span>
          <h2>${escapeHTML(group.title)}</h2>
          <p>Veja exatamente quais respostas numéricas entraram no cálculo.</p>
        </div>
        ${closeButton()}
      </div>

      <div class="indicator-detail-body">
        <section class="indicator-detail-summary" aria-label="Resumo do cálculo">
          <div>
            <small>Média atual</small>
            <strong>${formatNumber(group.average)}</strong>
          </div>
          <div>
            <small>Respostas na conta</small>
            <strong>${group.count}</strong>
          </div>
          <div class="indicator-detail-equation">
            <small>Como foi calculada</small>
            <strong>${escapeHTML(formatEquation(values, sum, group.average))}</strong>
          </div>
        </section>

        <div class="indicator-detail-distribution">
          ${[1, 2, 3, 4, 5].map(value => {
            const amount = values.filter(item => item === value).length;
            const width = group.count ? (amount / group.count) * 100 : 0;

            return `
              <div class="indicator-detail-bar-row">
                <span>Nota ${value}</span>
                <div><i style="width: ${width}%"></i></div>
                <strong>${amount}</strong>
              </div>
            `;
          }).join('')}
        </div>

        <div class="indicator-detail-list-heading">
          <div>
            <h3>Respostas que contribuíram</h3>
            <p>As notas menores aparecem primeiro para facilitar a leitura dos riscos.</p>
          </div>
        </div>

        <div class="indicator-detail-list">
          ${sortedItems.map((item, index) =>
            renderAnswer(item, group.average, index, group.count)
          ).join('')}
        </div>

        <div class="indicator-detail-note">
          Somente respostas numéricas da escala 1 a 5 compõem esta média.
          Textos, respostas Sim/Não e alternativas não alteram a nota.
        </div>
      </div>
    `;
  }

  function renderAnswer(item, groupAverage, index, total) {
    const difference = item.value - groupAverage;
    let influence = 'na média';
    let influenceClass = 'neutral';

    if (difference < -0.049) {
      influence = `puxa ${formatNumber(Math.abs(difference))} para baixo`;
      influenceClass = 'down';
    } else if (difference > 0.049) {
      influence = `puxa ${formatNumber(difference)} para cima`;
      influenceClass = 'up';
    }

    return `
      <article class="indicator-detail-answer">
        <div class="indicator-detail-score score-${Math.round(item.value)}">
          <small>Nota</small>
          <strong>${formatNumber(item.value, 0)}</strong>
        </div>
        <div class="indicator-detail-answer-content">
          <div class="indicator-detail-tags">
            <span>${escapeHTML(item.checkpoint)}</span>
            <span>${escapeHTML(respondentLabel(item.respondentType))}</span>
            <span class="indicator-detail-influence ${influenceClass}">
              ${escapeHTML(influence)}
            </span>
          </div>
          <strong>${escapeHTML(item.question)}</strong>
          <small>Resposta ${index + 1} de ${total} nesta dimensão</small>
        </div>
      </article>
    `;
  }

  function renderError(error) {
    return `
      <div class="indicator-detail-header">
        <div>
          <span>COMPOSIÇÃO DA NOTA</span>
          <h2>Não foi possível abrir o detalhamento</h2>
        </div>
        ${closeButton()}
      </div>
      <div class="indicator-detail-body">
        <div class="indicator-detail-error" role="alert">
          <strong>Tente novamente.</strong>
          <p>${escapeHTML(error?.message || 'Erro desconhecido.')}</p>
          <button type="button" data-indicator-close>Fechar</button>
        </div>
      </div>
    `;
  }

  function openModal(content) {
    closeModal(false);

    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.className = 'indicator-detail-overlay';
    overlay.innerHTML = `
      <div
        class="indicator-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="indicatorDetailTitle"
      >
        ${content.replace('<h2>', '<h2 id="indicatorDetailTitle">')}
      </div>
    `;

    overlay.addEventListener('click', event => {
      if (event.target === overlay || event.target.closest('[data-indicator-close]')) {
        closeModal();
      }
    });

    document.body.appendChild(overlay);
    document.body.classList.add('indicator-detail-open');
    overlay.querySelector('[data-indicator-close]')?.focus();
  }

  function closeModal(restoreFocus = true) {
    document.getElementById(MODAL_ID)?.remove();
    document.body.classList.remove('indicator-detail-open');

    if (restoreFocus) {
      lastFocusedCard?.focus();
    }
  }

  function closeButton() {
    return `
      <button
        class="indicator-detail-close"
        type="button"
        data-indicator-close
        aria-label="Fechar detalhamento"
      >×</button>
    `;
  }

  function getCardTitle(card) {
    return card.querySelector('div > strong')?.textContent?.trim() || '';
  }

  function getCardCount(card) {
    const text = card.querySelector('div > span')?.textContent || '';
    const match = text.match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  function getCardScore(card) {
    const score = [...card.children]
      .find(child => child.tagName === 'STRONG')
      ?.textContent
      ?.trim();

    if (!score || score === '—') {
      return null;
    }

    const parsed = Number(score.replace('.', '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function scoresMatch(a, b) {
    if (a === null || b === null) {
      return a === b;
    }

    return Math.abs(a - b) < 0.051;
  }

  function formatEquation(values, sum, result) {
    if (values.length <= 12) {
      return `(${values.map(value => formatNumber(value, 0)).join(' + ')}) ÷ ${values.length} = ${formatNumber(result)}`;
    }

    return `${formatNumber(sum, 0)} pontos ÷ ${values.length} respostas = ${formatNumber(result)}`;
  }

  function respondentLabel(value) {
    if (value === 'EMPLOYEE') {
      return 'Colaborador';
    }

    if (value === 'LEADER') {
      return 'Liderança';
    }

    return prettyDimension(value);
  }

  function formatNumber(value, decimals = 1) {
    return Number(value).toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function prettyDimension(value) {
    return String(value || 'GERAL')
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/(^|\s)\S/g, character => character.toUpperCase());
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  function checkpointNumber(value) {
    const match = String(value || '').match(/\d+/);
    return match ? Number(match[0]) : 999;
  }

  function average(values) {
    return values.length
      ? values.reduce((total, value) => total + value, 0) / values.length
      : null;
  }

  function asArray(value) {
    if (!value) {
      return [];
    }

    return Array.isArray(value) ? value : [value];
  }

  function asObject(value) {
    if (!value) {
      return null;
    }

    return Array.isArray(value) ? value[0] || null : value;
  }

  function getEmploymentJourney(employment) {
    const journeys = asArray(employment?.journeys);

    return journeys.find(journey =>
      journey.status === 'ACTIVE' || journey.status === 'IN_JOURNEY'
    ) || journeys[0] || null;
  }

  function escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function withTimeout(promise, milliseconds, message) {
    let timeoutId;

    const timeout = new Promise((resolve, reject) => {
      timeoutId = window.setTimeout(
        () => reject(new Error(message)),
        milliseconds
      );
    });

    return Promise.race([promise, timeout])
      .finally(() => window.clearTimeout(timeoutId));
  }
})();


