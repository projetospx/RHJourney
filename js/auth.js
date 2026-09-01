// ============================================================
// SHOPEE JOURNEY
// AUTH V2 - LOGIN DIRETO NO SUPABASE AUTH
// ============================================================

'use strict';


let loginMode =
  'corporate';

let loginInProgress =
  false;


// ============================================================
// ELEMENTOS
// ============================================================

const corporateTab =
  document.getElementById(
    'corporateTab'
  );

const employeeTab =
  document.getElementById(
    'employeeTab'
  );

const loginForm =
  document.getElementById(
    'loginForm'
  );

const loginInput =
  document.getElementById(
    'login'
  );

const loginLabel =
  document.getElementById(
    'loginLabel'
  );

const passwordInput =
  document.getElementById(
    'password'
  );

const loginButton =
  document.getElementById(
    'loginButton'
  );

const loginMessage =
  document.getElementById(
    'loginMessage'
  );

const accessHelp =
  document.getElementById(
    'accessHelp'
  );

const showPassword =
  document.getElementById(
    'showPassword'
  );

const themeToggle =
  document.getElementById(
    'themeToggle'
  );


// ============================================================
// CONFIGURAÇÕES
// ============================================================

const LOGIN_TIMEOUT_MS =
  15000;


// ============================================================
// MENSAGENS
// ============================================================

function showLoginMessage(
  message = '',
  type = ''
) {

  if (!loginMessage) {
    return;
  }


  loginMessage.textContent =
    message;


  loginMessage.className =
    type
      ? `login-message ${type}`
      : 'login-message';

}


// ============================================================
// BOTÃO
// ============================================================

function setLoginLoading(
  loading
) {

  if (!loginButton) {
    return;
  }


  loginButton.disabled =
    loading;


  loginButton.textContent =
    loading
      ? 'Entrando...'
      : 'Entrar';

}


// ============================================================
// TEMA
// ============================================================

function applyTheme(
  theme
) {

  const safeTheme =
    theme === 'dark'
      ? 'dark'
      : 'light';


  document.documentElement
    .setAttribute(
      'data-theme',
      safeTheme
    );


  localStorage.setItem(
    'journey-theme',
    safeTheme
  );


  if (themeToggle) {

    themeToggle.textContent =
      safeTheme === 'dark'
        ? '☀️'
        : '🌙';

  }

}


function loadTheme() {

  const storedTheme =
    localStorage.getItem(
      'journey-theme'
    );


  applyTheme(
    storedTheme ||
    'light'
  );

}


themeToggle
  ?.addEventListener(
    'click',
    () => {

      const current =
        document.documentElement
          .getAttribute(
            'data-theme'
          );


      applyTheme(
        current === 'dark'
          ? 'light'
          : 'dark'
      );

    }
  );


loadTheme();


// ============================================================
// MODO DE LOGIN
// ============================================================

function setLoginMode(
  mode
) {

  loginMode =
    mode === 'employee'
      ? 'employee'
      : 'corporate';


  showLoginMessage();


  const corporate =
    loginMode === 'corporate';


  corporateTab
    ?.classList
    .toggle(
      'active',
      corporate
    );


  employeeTab
    ?.classList
    .toggle(
      'active',
      !corporate
    );


  if (loginLabel) {

    loginLabel.textContent =
      corporate
        ? 'E-mail Corporativo'
        : 'CPF';

  }


  if (loginInput) {

    loginInput.value =
      '';

    loginInput.type =
      corporate
        ? 'email'
        : 'text';

    loginInput.inputMode =
      corporate
        ? 'email'
        : 'numeric';

    loginInput.placeholder =
      corporate
        ? 'nome@empresa.com'
        : '000.000.000-00';

    loginInput.focus();

  }


  if (accessHelp) {

    accessHelp.textContent =
      corporate
        ? 'Utilize seu e-mail corporativo.'
        : 'Utilize seu CPF e sua senha de acesso.';

  }

}


corporateTab
  ?.addEventListener(
    'click',
    () => {

      setLoginMode(
        'corporate'
      );

    }
  );


employeeTab
  ?.addEventListener(
    'click',
    () => {

      setLoginMode(
        'employee'
      );

    }
  );


// ============================================================
// CPF
// ============================================================

function normalizeCPF(
  value
) {

  return String(
    value || ''
  )
    .replace(
      /\D/g,
      ''
    );

}


function formatCPF(
  value
) {

  const digits =
    normalizeCPF(
      value
    )
      .slice(
        0,
        11
      );


  if (
    digits.length <= 3
  ) {

    return digits;

  }


  if (
    digits.length <= 6
  ) {

    return (
      `${digits.slice(0, 3)}.` +
      `${digits.slice(3)}`
    );

  }


  if (
    digits.length <= 9
  ) {

    return (
      `${digits.slice(0, 3)}.` +
      `${digits.slice(3, 6)}.` +
      `${digits.slice(6)}`
    );

  }


  return (
    `${digits.slice(0, 3)}.` +
    `${digits.slice(3, 6)}.` +
    `${digits.slice(6, 9)}-` +
    `${digits.slice(9, 11)}`
  );

}


function employeeLoginEmail(
  cpf
) {

  return (
    `${normalizeCPF(cpf)}` +
    '@employee.journey.internal'
  );

}


loginInput
  ?.addEventListener(
    'input',
    () => {

      if (
        loginMode !==
        'employee'
      ) {

        return;

      }


      loginInput.value =
        formatCPF(
          loginInput.value
        );

    }
  );


// ============================================================
// MOSTRAR SENHA
// ============================================================

showPassword
  ?.addEventListener(
    'click',
    () => {

      const hidden =
        passwordInput.type ===
        'password';


      passwordInput.type =
        hidden
          ? 'text'
          : 'password';


      showPassword.textContent =
        hidden
          ? '🙈'
          : '👁';

    }
  );


// ============================================================
// STORAGE KEY DO SUPABASE
// ============================================================

function getSupabaseStorageKey() {

  try {

    const projectUrl =
      new URL(
        SUPABASE_URL
      );


    const projectRef =
      projectUrl.hostname
        .split('.')[0];


    return (
      `sb-${projectRef}-auth-token`
    );

  }

  catch {

    return null;

  }

}


// ============================================================
// LIMPAR SESSÃO ANTIGA
// ============================================================

function clearOldSupabaseSession() {

  const storageKey =
    getSupabaseStorageKey();


  if (!storageKey) {
    return;
  }


  const keysToRemove =
    [];


  for (
    let i = 0;
    i < localStorage.length;
    i++
  ) {

    const key =
      localStorage.key(i);


    if (
      key
      &&
      (
        key === storageKey
        ||
        key.startsWith(
          `${storageKey}.`
        )
      )
    ) {

      keysToRemove.push(
        key
      );

    }

  }


  keysToRemove.forEach(
    key => {

      localStorage.removeItem(
        key
      );

    }
  );

}


// ============================================================
// GRAVAR NOVA SESSÃO
// ============================================================

function saveSupabaseSession(
  session
) {

  const storageKey =
    getSupabaseStorageKey();


  if (!storageKey) {

    throw new Error(
      'Não foi possível identificar o armazenamento da sessão.'
    );

  }


  const normalizedSession = {
    ...session
  };


  if (
    !normalizedSession.expires_at
    &&
    normalizedSession.expires_in
  ) {

    normalizedSession.expires_at =
      Math.floor(
        Date.now() / 1000
      )
      +
      Number(
        normalizedSession.expires_in
      );

  }


  localStorage.setItem(
    storageKey,
    JSON.stringify(
      normalizedSession
    )
  );

}


// ============================================================
// FETCH COM TIMEOUT REAL
// ============================================================

async function fetchWithTimeout(
  url,
  options = {},
  timeout =
    LOGIN_TIMEOUT_MS
) {

  const controller =
    new AbortController();


  const timer =
    window.setTimeout(
      () => {

        controller.abort();

      },
      timeout
    );


  try {

    return await fetch(
      url,
      {
        ...options,
        signal:
          controller.signal
      }
    );

  }

  finally {

    window.clearTimeout(
      timer
    );

  }

}


// ============================================================
// ERRO SUPABASE
// ============================================================

function getSupabaseErrorMessage(
  body,
  status
) {

  const message =
    String(
      body?.msg
      ||
      body?.message
      ||
      body?.error_description
      ||
      body?.error
      ||
      ''
    );


  const lower =
    message.toLowerCase();


  if (
    status === 400
    &&
    (
      lower.includes(
        'invalid login'
      )
      ||
      lower.includes(
        'invalid credentials'
      )
    )
  ) {

    return loginMode ===
      'employee'
      ? 'CPF ou senha incorretos.'
      : 'E-mail ou senha incorretos.';

  }


  if (
    lower.includes(
      'email not confirmed'
    )
  ) {

    return (
      'Este usuário ainda não está confirmado no Supabase.'
    );

  }


  if (
    status === 429
  ) {

    return (
      'Muitas tentativas de login. Aguarde um pouco e tente novamente.'
    );

  }


  if (message) {
    return message;
  }


  return (
    `Erro de autenticação do Supabase (HTTP ${status}).`
  );

}


// ============================================================
// LOGIN DIRETO NO GOTRUE
// ============================================================

async function loginDirectly(
  email,
  password
) {

  const endpoint =
    (
      `${SUPABASE_URL}` +
      '/auth/v1/token' +
      '?grant_type=password'
    );


  let response;


  try {

    response =
      await fetchWithTimeout(
        endpoint,
        {
          method:
            'POST',

          headers: {
            apikey:
              SUPABASE_PUBLISHABLE_KEY,

            'Content-Type':
              'application/json',

            Accept:
              'application/json'
          },

          body:
            JSON.stringify({
              email,
              password
            })
        }
      );

  }

  catch (error) {

    if (
      error?.name ===
      'AbortError'
    ) {

      throw new Error(
        'Não foi possível alcançar o servidor do Supabase em 15 segundos. Isso indica problema de conexão com o projeto, e não erro de senha.'
      );

    }


    throw new Error(
      'Falha de conexão com o Supabase: ' +
      (
        error?.message ||
        'erro de rede'
      )
    );

  }


  let body = {};


  try {

    body =
      await response.json();

  }

  catch {

    body = {};

  }


  if (
    !response.ok
  ) {

    throw new Error(
      getSupabaseErrorMessage(
        body,
        response.status
      )
    );

  }


  if (
    !body.access_token
    ||
    !body.refresh_token
    ||
    !body.user
  ) {

    throw new Error(
      'O Supabase respondeu, mas não retornou uma sessão válida.'
    );

  }


  return body;

}


// ============================================================
// SUBMIT
// ============================================================

loginForm
  ?.addEventListener(
    'submit',
    async event => {

      event.preventDefault();


      if (
        loginInProgress
      ) {

        return;

      }


      loginInProgress =
        true;


      showLoginMessage();

      setLoginLoading(
        true
      );


      try {

        // ======================================================
        // VALIDAÇÃO DA CONFIG
        // ======================================================

        if (
          typeof SUPABASE_URL ===
          'undefined'
          ||
          typeof SUPABASE_PUBLISHABLE_KEY ===
          'undefined'
        ) {

          throw new Error(
            'O config.js não carregou corretamente.'
          );

        }


        let email;


        // ======================================================
        // CORPORATIVO
        // ======================================================

        if (
          loginMode ===
          'corporate'
        ) {

          email =
            String(
              loginInput.value
            )
              .trim()
              .toLowerCase();


          if (
            !email.endsWith(
              '@empresa.com'
            )
          ) {

            throw new Error(
              'Utilize seu e-mail corporativo @empresa.com.'
            );

          }

        }


        // ======================================================
        // COLABORADOR
        // ======================================================

        else {

          const cpf =
            normalizeCPF(
              loginInput.value
            );


          if (
            cpf.length !== 11
          ) {

            throw new Error(
              'Informe um CPF válido com 11 dígitos.'
            );

          }


          email =
            employeeLoginEmail(
              cpf
            );

        }


        const password =
          String(
            passwordInput.value ||
            ''
          );


        if (!password) {

          throw new Error(
            'Informe sua senha.'
          );

        }


        // ======================================================
        // REMOVE UMA SESSÃO VELHA / TRAVADA
        // ======================================================

        clearOldSupabaseSession();


        sessionStorage.removeItem(
          'journey-profile'
        );


        // ======================================================
        // LOGIN
        // ======================================================

        const session =
          await loginDirectly(
            email,
            password
          );


        // ======================================================
        // SALVA SESSÃO EXATAMENTE ONDE O SUPABASE-JS ESPERA
        // ======================================================

        saveSupabaseSession(
          session
        );


        showLoginMessage(
          'Acesso confirmado. Abrindo RH Journey...',
          'success'
        );


        // Pequeno intervalo apenas para garantir
        // a gravação no localStorage.
        await new Promise(
          resolve =>
            window.setTimeout(
              resolve,
              100
            )
        );


        window.location.replace(
          'app.html'
        );

      }

      catch (error) {

        console.error(
          'RH Journey login:',
          error
        );


        showLoginMessage(
          error?.message ||
          'Não foi possível entrar.',
          'error'
        );

      }

      finally {

        loginInProgress =
          false;


        setLoginLoading(
          false
        );

      }

    }
  );


// ============================================================
// IMPORTANTE
//
// NÃO CHAMAMOS getSession() NA TELA DE LOGIN.
//
// Isso é proposital.
//
// A sessão será validada pelo app.js depois do redirecionamento.
// ============================================================


console.log(
  'RH Journey Auth V2 carregado.'
);
