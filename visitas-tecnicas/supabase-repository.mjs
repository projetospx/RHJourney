const DIMENSION_WEIGHTS = {
  abs: 20, leadership: 20, climate: 15, turnover: 15, people: 10,
  onboarding: 8, communication: 5, structure: 5, governance: 2,
};
const INTERVIEW_QUESTIONS = [
  'Quais são hoje os três principais problemas de pessoas?',
  'Quais causas explicam o ABS e em quais evidências você se baseia?',
  'O problema se concentra em algum turno, equipe, líder ou dia da semana?',
  'Quais ações já foram tentadas e qual resultado mensurável produziram?',
  'Como você avalia as lideranças na prática, e não apenas no resultado?',
  'O que o RH provavelmente ouvirá dos colaboradores?',
  'Quem apresenta maior risco de saída e por quê?',
  'Como faltas e retornos pós-ausência são tratados?',
  'Com que frequência ocorrem feedbacks e como são registrados?',
  'Quais conflitos estão ativos ou recorrentes?',
  'Como você descreveria o clima atual com um exemplo concreto?',
  'Que suporte do RH está faltando?',
  'O que eu ainda não perguntei e deveria saber?',
];

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : null;
}

function integerOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : null;
}

function generalScore(stageData = {}) {
  let total = 0;
  let weights = 0;
  for (const [key, dimensionWeight] of Object.entries(DIMENSION_WEIGHTS)) {
    const entry = stageData[key] || {};
    const sources = [
      [numberOrNull(entry.objective), 40],
      [numberOrNull(entry.perception), 30],
      [numberOrNull(entry.observation), 30],
    ].filter(([value]) => value !== null);
    if (!sources.length) continue;
    const sourceWeight = sources.reduce((sum, [, weight]) => sum + weight, 0);
    const score = sources.reduce((sum, [value, weight]) => sum + value * weight, 0) / sourceWeight;
    total += score * dimensionWeight;
    weights += dimensionWeight;
  }
  return weights ? Math.round((total / weights) * 100) / 100 : null;
}

function scoreBand(score) {
  if (score === null) return null;
  if (score < 40) return 'Crítico';
  if (score < 60) return 'Alto risco';
  if (score < 75) return 'Atenção';
  return 'Saudável';
}

function criticality(finding = {}) {
  const values = ['severity', 'frequency', 'breadth', 'urgency'].map(key => {
    const value = Number(finding[key]);
    return Number.isFinite(value) ? Math.max(1, Math.min(5, value)) : 3;
  });
  const score = values.reduce((total, value) => total * value, 1);
  const band = score >= 400 ? 'Crítico' : score >= 200 ? 'Alto' : score >= 80 ? 'Atenção' : 'Baixo';
  return { score, band, values };
}

function configured(config) {
  return Boolean(
    config?.url?.startsWith('https://') &&
    config?.anonKey &&
    !config.url.includes('COLE_AQUI') &&
    !config.anonKey.includes('COLE_AQUI')
  );
}

export function createSupabaseRepository(config = {}) {
  let client = null;
  let user = null;

  return {
    configured: configured(config),

    async connect() {
      if (!configured(config)) return { ok: false, reason: 'not_configured' };
      if (!globalThis.supabase?.createClient) return { ok: false, reason: 'sdk_unavailable' };
      client = globalThis.supabase.createClient(config.url, config.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
      const { data, error } = await client.auth.getSession();
      if (error) return { ok: false, reason: 'auth_error', error };
      user = data.session?.user || null;
      if (!user) return { ok: false, reason: 'unauthenticated' };
      return { ok: true, user };
    },

    async listVisits() {
      if (!client || !user) return { ok: false, reason: 'unavailable', data: [] };
      const { data, error } = await client
        .from('vt_visits')
        .select('id,visit_code,operation_id,operation_name,period_label,status,score_general,updated_at')
        .order('updated_at', { ascending: false });
      return error ? { ok: false, error, data: [] } : { ok: true, data: data || [] };
    },

    async listOperations() {
      if (!client || !user) return { ok: false, reason: 'unavailable', data: [] };
      const { data, error } = await client
        .from('operations')
        .select('id,name,regional_id')
        .eq('active', true)
        .order('name');
      return error ? { ok: false, error, data: [] } : { ok: true, data: data || [] };
    },

    async loadVisit(visitCode) {
      if (!client || !user || !visitCode) return { ok: false, reason: 'unavailable' };
      const { data, error } = await client
        .from('vt_visits')
        .select('id,visit_code,workspace_payload,updated_at')
        .eq('visit_code', visitCode)
        .maybeSingle();
      if (error) return { ok: false, error };
      return { ok: true, data };
    },

    async saveWorkspace(state) {
      if (!client || !user) return { ok: false, reason: 'unavailable' };
      if (!state?.draft?.operation || !state?.draft?.id) return { ok: false, reason: 'empty_draft' };
      const score = generalScore(state.draft.stageData);
      const payload = JSON.parse(JSON.stringify(state));
      payload.dirty = false;
      // O snapshot da visita não replica a lista de outras operações.
      // As visitas são sempre consultadas diretamente em vt_visits.
      payload.visits = [];
      const row = {
        visit_code: state.draft.id,
        operation_id: state.draft.operationId || null,
        operation_name: state.draft.operation,
        regional_name: state.draft.regional || null,
        period_label: state.draft.period || null,
        visit_type: state.draft.type || 'Diagnóstico crítico',
        objective: state.draft.objective || null,
        owner_name: state.draft.owner || null,
        main_reason: state.draft.reason || null,
        status: state.draft.status || 'Rascunho',
        baseline: state.draft.baseline || {},
        preparation: state.draft.prep || [],
        score_general: score,
        score_band: scoreBand(score),
        workspace_payload: payload,
        updated_by: user.id,
      };
      if (state.draft.dbId) row.id = state.draft.dbId;
      const { data, error } = await client
        .from('vt_visits')
        .upsert(row, { onConflict: 'visit_code' })
        .select('id,visit_code,updated_at')
        .single();
      if (error) return { ok: false, error };

      const visitId = data.id;
      const stageRows = Object.entries(state.draft.stageData || {}).map(([stageKey, entry]) => ({
        visit_id: visitId,
        stage_key: stageKey,
        objective_score: numberOrNull(entry.objective),
        perception_score: numberOrNull(entry.perception),
        observation_score: numberOrNull(entry.observation),
        behavioral_scores: entry.criteria || {},
        evidence: entry.evidence || entry.notes || null,
        payload: entry,
        complete: Boolean(entry.complete),
        updated_by: user.id,
      }));
      if (stageRows.length) {
        const stageResult = await client.from('vt_stage_entries').upsert(stageRows, { onConflict: 'visit_id,stage_key' });
        if (stageResult.error) return { ok: false, error: stageResult.error, partial: true };
      }

      const interviewRows = (state.interviews || []).map(interview => ({
        id: interview.id,
        visit_id: visitId,
        audience_type: interview.type,
        interviewee_name: interview.name || null,
        role_title: interview.role || null,
        team: interview.team || null,
        notes: interview.notes || null,
        updated_by: user.id,
      }));
      if (interviewRows.length) {
        const interviewResult = await client.from('vt_interviews').upsert(interviewRows, { onConflict: 'id' });
        if (interviewResult.error) return { ok: false, error: interviewResult.error, partial: true };
        const answerRows = (state.interviews || []).flatMap(interview =>
          Object.entries(interview.answers || {}).map(([index, answer]) => ({
            interview_id: interview.id,
            question_index: Number(index),
            question_text: INTERVIEW_QUESTIONS[Number(index)] || `Pergunta ${Number(index) + 1}`,
            answer: answer || null,
            updated_by: user.id,
          }))
        );
        if (answerRows.length) {
          const answerResult = await client.from('vt_interview_answers').upsert(answerRows, { onConflict: 'interview_id,question_index' });
          if (answerResult.error) return { ok: false, error: answerResult.error, partial: true };
        }
      }

      const findingRows = (state.findings || []).map(finding => {
        const { score: criticalityScore, band, values } = criticality(finding);
        return {
          id: finding.id,
          visit_id: visitId,
          source_interview_id: finding.sourceInterviewId || null,
          title: finding.title,
          category: finding.category || null,
          evidence: finding.evidence || null,
          probable_cause: finding.probableCause || null,
          secondary_cause: finding.secondaryCause || null,
          aggravators: finding.aggravators || [],
          risk: finding.risk || null,
          recommendation: finding.recommendation || null,
          owner_name: finding.owner || null,
          due_date: finding.due || null,
          status: finding.status || 'A iniciar',
          severity: values[0], frequency: values[1], breadth: values[2], urgency: values[3],
          criticality_score: criticalityScore,
          criticality_band: band,
          updated_by: user.id,
        };
      });
      if (findingRows.length) {
        const findingResult = await client.from('vt_findings').upsert(findingRows, { onConflict: 'id' });
        if (findingResult.error) return { ok: false, error: findingResult.error, partial: true };
      }

      const actionRows = (state.actions || []).map(action => ({
        id: action.id,
        visit_id: visitId,
        finding_id: action.findingId || null,
        title: action.title,
        owner_name: action.owner || null,
        due_date: action.due || null,
        status: action.status || 'A iniciar',
        completed_at: action.status === 'Concluída' ? new Date().toISOString() : null,
        updated_by: user.id,
      }));
      if (actionRows.length) {
        const actionResult = await client.from('vt_actions').upsert(actionRows, { onConflict: 'id' });
        if (actionResult.error) return { ok: false, error: actionResult.error, partial: true };
      }

      const survey = state.survey || {};
      if (survey.status && survey.status !== 'Não iniciada') {
        survey.id ||= crypto.randomUUID();
        const surveyResult = await client.from('vt_surveys').upsert({
          id: survey.id,
          visit_id: visitId,
          operation_id: state.draft.operationId || null,
          title: survey.title || `Pesquisa pré-visita — ${state.draft.operation}`,
          audience: survey.audience || 'Colaboradores',
          anonymity: survey.anonymity || null,
          status: survey.status,
          invited_count: integerOrNull(survey.invited),
          response_count: integerOrNull(survey.responses),
          results: survey,
          updated_by: user.id,
        }, { onConflict: 'id' });
        if (surveyResult.error) return { ok: false, error: surveyResult.error, partial: true };
      }

      return { ok: true, data };
    },
  };
}
