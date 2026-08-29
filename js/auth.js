// ============================================================
// SHOPEE JOURNEY
// AUTH — RECUPERAÇÃO DE LOGIN
// ============================================================

'use strict';

let loginMode = 'corporate';
let loginInProgress = false;


const corporateTab =
  document.getElementById('corporateTab');

const employeeTab =
  document.getElementById('employeeTab');

const loginForm =
  document.getElementById('loginForm');

const loginInput =
  document.getElementById('login');

const loginLabel =
  document.getElementById('loginLabel');

const passwordInput =
  document.getElementById('password');

const loginButton =
  document.getElementById('loginButton');

const loginMessage =
  document.getElementById('loginMessage');

const accessHelp =
  document.getElementById('accessHelp');

const showPassword =
  document.getElementById('showPassword');

const themeToggle =
  document.getElementById('themeToggle');


const AUTH_TIMEOUT_MS = 12000;


// ============================================================
// MENSAGENS
// ============================================================

function setMessage(
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

function setLoginButtonLoading(
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
// TIMEOUT
// ============================================================

function withTimeout(
  promiseLike,
  timeoutMs,
  timeoutMessage
) {

  let timer;


  const timeoutPromise =
    new Promise(
      (
        _,
        reject
      ) => {

        timer =
          window.setTimeout(
            () => {

              reject(
                new Error(
                  timeoutMessage
                )
              );

            },
            timeoutMs
          );

      }
    );


  return Promise.race([
    Promise.resolve(
      promiseLike
    ),
    timeoutPromise
  ])
    .finally(
      () => {

        window.clearTimeout(
          timer
        );

      }
    );

}


// ============================================================
// ERROS AMIGÁVEIS
// ============================================================

function friendlyAuthError(
  error
) {

  const raw =
    String(
      error?.message ||
      error ||
      ''
    ).trim();


  const lower =
    raw.toLowerCase();


  if (
    lower.includes(
      'invalid login credentials'
    )
  ) {

    return loginMode ===
      'corporate'

      ? 'E-mail ou senha incorretos.'

      : 'CPF ou senha incorretos.';

  }


  if (
    lower.includes(
      'email not confirmed'
    )
  ) {

    return (
      'Este acesso ainda não foi confirmado no Supabase.'
    );

  }


  if (
    lower.includes(
      'too many requests'
    )
    ||
    lower.includes(
      'rate limit'
    )
  ) {

    return (
      'Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.'
    );

  }


  if (
    lower.includes(
      'failed to fetch'
    )
    ||
    lower.includes(
      'network'
    )
  ) {

    return (
      'Não foi possível conectar ao Supabase. Verifique a internet e tente novamente.'
    );

  }


  if (
    lower.includes(
      'tempo limite'
    )
    ||
    lower.includes(
      'timeout'
    )
  ) {

    return raw;

  }


  return (
    raw ||
    'Não foi possível realizar o login.'
  );

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


  if (
    themeToggle
  ) {

    themeToggle.textContent =
      safeTheme === 'dark'
        ? '☀️'
        : '🌙';

  }

}


function loadTheme() {

  applyTheme(
    localStorage.getItem(
      'journey-theme'
    )
    ||
    'light'
  );

}


if (
  themeToggle
) {

  themeToggle.addEventListener(
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

}


loadTheme();


// ============================================================
// ALTERAR MODO
// ============================================================

function setLoginMode(
  mode
) {

  loginMode =
    mode === 'employee'
      ? 'employee'
      : 'corporate';


  setMessage();


  const corporate =
    loginMode ===
    'corporate';


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


  if (
    loginLabel
  ) {

    loginLabel.textContent =
      corporate
        ? 'E-mail Shopee'
        : 'CPF';

  }


  if (
    loginInput
  ) {

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
        ? 'nome@shopee.com'
        : '000.000.000-00';


    loginInput.value =
      '';


    loginInput.focus();

  }


  if (
    accessHelp
  ) {

    accessHelp.textContent =
      corporate

        ? 'Utilize seu e-mail corporativo Shopee.'

        : 'Utilize seu CPF e sua senha de acesso.';

  }

}


corporateTab
  ?.addEventListener(
    'click',
    () =>
      setLoginMode(
        'corporate'
      )
  );


employeeTab
  ?.addEventListener(
    'click',
    () =>
      setLoginMode(
        'employee'
      )
  );


// ============================================================
// CPF
// ============================================================

function normalizeCPF(
  value
) {

  return String(
    value ||
    ''
  )
    .replace(
      /\D/g,
      ''
    );

}


function employeeInternalEmail(
  cpf
) {

  return (
    `${normalizeCPF(cpf)}@employee.journey.internal`
  );

}


function formatCPF(
  value
) {

  let cpf =
    normalizeCPF(
      value
    )
      .slice(
        0,
        11
      );


  if (
    cpf.length >
    9
  ) {

    cpf =
      cpf.replace(
        /(\d{3})(\d{3})(\d{3})(\d{0,2})/,
        '$1.$2.$3-$4'
      );

  }

  else if (
    cpf.length >
    6
  ) {

    cpf =
      cpf.replace(
        /(\d{3})(\d{3})(\d{0,3})/,
        '$1.$2.$3'
      );

  }

  else if (
    cpf.length >
    3
  ) {

    cpf =
      cpf.replace(
        /(\d{3})(\d{0,3})/,
        '$1.$2'
      );

  }


  return cpf;

}


loginInput
  ?.addEventListener(
    'input',
    () => {

      if (
        loginMode ===
        'employee'
      ) {

        loginInput.value =
          formatCPF(
            loginInput.value
          );

      }

    }
  );


// ============================================================
// MOSTRAR SENHA
// ============================================================

showPassword
  ?.addEventListener(
    'click',
    () => {

      const willShow =
        passwordInput.type ===
        'password';


      passwordInput.type =
        willShow
          ? 'text'
          : 'password';


      showPassword.textContent =
        willShow
          ? '🙈'
          : '👁';

    }
  );


// ============================================================
// LOGIN
//
// IMPORTANTE:
// ESTA TELA SOMENTE AUTENTICA.
//
// A leitura de public.profiles fica para o app.js.
//
// Isso evita o travamento em "Entrando..."
// que estava ocorrendo após a autenticação.
// ============================================================

loginForm
  ?.addEventListener(
    'submit',
    async (
      event
    ) => {

      event.preventDefault();


      if (
        loginInProgress
      ) {

        return;

      }


      loginInProgress =
        true;


      setMessage();

      setLoginButtonLoading(
        true
      );


      try {

        if (
          typeof journeySupabase ===
          'undefined'
        ) {

          throw new Error(
            'O cliente do Supabase não foi carregado. Atualize a página com Ctrl + F5.'
          );

        }


        let email =
          '';


        // ======================================================
        // CORPORATIVO
        // ======================================================

        if (
          loginMode ===
          'corporate'
        ) {

          email =
            String(
              loginInput
                ?.value ||
              ''
            )
              .trim()
              .toLowerCase();


          if (
            !email.endsWith(
              '@shopee.com'
            )
          ) {

            throw new Error(
              'Utilize um e-mail corporativo @shopee.com.'
            );

          }

        }


        // ======================================================
        // COLABORADOR
        // ======================================================

        else {

          const cpf =
            normalizeCPF(
              loginInput
                ?.value
            );


          if (
            cpf.length !==
            11
          ) {

            throw new Error(
              'Informe um CPF válido com 11 dígitos.'
            );

          }


          email =
            employeeInternalEmail(
              cpf
            );

        }


        const password =
          String(
            passwordInput
              ?.value ||
            ''
          );


        if (
          !password
        ) {

          throw new Error(
            'Informe sua senha.'
          );

        }


        // Remove profile antigo
        sessionStorage.removeItem(
          'journey-profile'
        );


        // ======================================================
        // LOGIN SUPABASE
        // ======================================================

        const result =
          await withTimeout(

            journeySupabase
              .auth
              .signInWithPassword({
                email,
                password
              }),

            AUTH_TIMEOUT_MS,

            'O Supabase não respondeu dentro de 12 segundos. Tente novamente.'

          );


        if (
          result?.error
        ) {

          throw result.error;

        }


        if (
          !result?.data?.session
          ||
          !result?.data?.user
        ) {

          throw new Error(
            'O Supabase não retornou uma sessão válida.'
          );

        }


        setMessage(
          'Acesso confirmado. Abrindo Shopee Journey...',
          'success'
        );


        // ======================================================
        // NÃO BUSCA PROFILE AQUI
        //
        // app.js já faz a leitura do perfil ao abrir app.html.
        // ======================================================

        window.location.replace(
          'app.html'
        );

      }


      catch (
        error
      ) {

        console.error(
          'Erro no login:',
          error
        );


        setMessage(
          friendlyAuthError(
            error
          ),
          'error'
        );

      }


      finally {

        loginInProgress =
          false;


        setLoginButtonLoading(
          false
        );

      }

    }
  );


// ============================================================
// VERIFICAR SESSÃO EXISTENTE
//
// Esta verificação NÃO pode travar o formulário.
// ============================================================

async function checkExistingSession() {

  try {

    const result =
      await withTimeout(

        journeySupabase
          .auth
          .getSession(),

        5000,

        'Tempo limite ao verificar sessão existente.'

      );


    if (
      loginInProgress
    ) {

      return;

    }


    if (
      result
        ?.data
        ?.session
        ?.user
    ) {

      window.location.replace(
        'app.html'
      );

    }

  }


  catch (
    error
  ) {

    console.warn(
      'Não foi possível verificar sessão anterior:',
      error
    );

  }

}


checkExistingSession();
