// ============================================================
// SHOPEE JOURNEY
// AUTH
// ============================================================

let loginMode = 'corporate';


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

  themeToggle.textContent =
    savedTheme === 'dark'
      ? '☀️'
      : '🌙';
}


themeToggle.addEventListener(
  'click',
  () => {

    const currentTheme =
      document.documentElement
        .getAttribute(
          'data-theme'
        );

    const newTheme =
      currentTheme === 'dark'
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

    themeToggle.textContent =
      newTheme === 'dark'
        ? '☀️'
        : '🌙';

  }
);


loadTheme();


// ============================================================
// ALTERAR MODO DE LOGIN
// ============================================================

function setLoginMode(mode) {

  loginMode = mode;

  loginMessage.className =
    'login-message';

  loginMessage.textContent =
    '';

  if (mode === 'corporate') {

    corporateTab
      .classList
      .add('active');

    employeeTab
      .classList
      .remove('active');

    loginLabel.textContent =
      'E-mail Shopee';

    loginInput.type =
      'email';

    loginInput.placeholder =
      'nome@shopee.com';

    loginInput.value =
      '';

    accessHelp.textContent =
      'Utilize seu e-mail corporativo Shopee.';

  }

  else {

    employeeTab
      .classList
      .add('active');

    corporateTab
      .classList
      .remove('active');

    loginLabel.textContent =
      'CPF';

    loginInput.type =
      'text';

    loginInput.placeholder =
      '000.000.000-00';

    loginInput.value =
      '';

    accessHelp.textContent =
      'Utilize seu CPF e sua senha de acesso.';

  }

}


corporateTab.addEventListener(
  'click',
  () => setLoginMode(
    'corporate'
  )
);


employeeTab.addEventListener(
  'click',
  () => setLoginMode(
    'employee'
  )
);


// ============================================================
// CPF
// ============================================================

function normalizeCPF(cpf) {

  return cpf.replace(
    /\D/g,
    ''
  );

}


function employeeInternalEmail(cpf) {

  const cleanCPF =
    normalizeCPF(cpf);

  return `${cleanCPF}@employee.journey.internal`;

}


// Máscara visual
loginInput.addEventListener(
  'input',
  () => {

    if (
      loginMode !==
      'employee'
    ) {
      return;
    }

    let value =
      normalizeCPF(
        loginInput.value
      );

    value =
      value.substring(
        0,
        11
      );

    value = value.replace(
      /(\d{3})(\d)/,
      '$1.$2'
    );

    value = value.replace(
      /(\d{3})(\d)/,
      '$1.$2'
    );

    value = value.replace(
      /(\d{3})(\d{1,2})$/,
      '$1-$2'
    );

    loginInput.value =
      value;

  }
);


// ============================================================
// MOSTRAR SENHA
// ============================================================

showPassword.addEventListener(
  'click',
  () => {

    const visible =
      passwordInput.type ===
      'text';

    passwordInput.type =
      visible
        ? 'password'
        : 'text';

    showPassword.textContent =
      visible
        ? '👁'
        : '🙈';

  }
);


// ============================================================
// LOGIN
// ============================================================

loginForm.addEventListener(
  'submit',
  async (event) => {

    event.preventDefault();

    loginMessage.className =
      'login-message';

    loginMessage.textContent =
      '';

    loginButton.disabled =
      true;

    loginButton.textContent =
      'Entrando...';


    try {

      let email;


      // CORPORATIVO
      if (
        loginMode ===
        'corporate'
      ) {

        email =
          loginInput
            .value
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


      // COLABORADOR
      else {

        const cpf =
          normalizeCPF(
            loginInput.value
          );

        if (
          cpf.length !== 11
        ) {

          throw new Error(
            'Informe um CPF válido.'
          );

        }

        email =
          employeeInternalEmail(
            cpf
          );

      }


      // LOGIN NO SUPABASE
      const {
        data,
        error
      } =
        await journeySupabase
          .auth
          .signInWithPassword({
            email:
              email,

            password:
              passwordInput.value
          });


      if (error) {
        throw error;
      }


      if (
        !data.user
      ) {

        throw new Error(
          'Não foi possível realizar o login.'
        );

      }


      // ======================================================
      // PEGAR PERFIL
      // ======================================================

      const {
        data: profile,
        error: profileError
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
            data.user.id
          )
          .single();


      if (profileError) {
        throw profileError;
      }


      if (
        !profile.active
      ) {

        await journeySupabase
          .auth
          .signOut();

        throw new Error(
          'Este usuário está inativo.'
        );

      }


      // ======================================================
      // VALIDAR PERFIL X TIPO DE LOGIN
      // ======================================================

      if (
        loginMode ===
        'corporate'
        &&
        profile.role ===
        'EMPLOYEE'
      ) {

        await journeySupabase
          .auth
          .signOut();

        throw new Error(
          'Utilize o acesso de colaborador.'
        );

      }


      if (
        loginMode ===
        'employee'
        &&
        profile.role !==
        'EMPLOYEE'
      ) {

        await journeySupabase
          .auth
          .signOut();

        throw new Error(
          'Utilize o acesso corporativo.'
        );

      }


      // ======================================================
      // LOGIN OK
      // ======================================================

      sessionStorage.setItem(
        'journey-profile',
        JSON.stringify(
          profile
        )
      );


      window.location.href =
        'app.html';

    }

    catch (error) {

      console.error(
        error
      );

      loginMessage.textContent =
        error.message ||
        'E-mail, CPF ou senha incorretos.';

      loginMessage.className =
        'login-message error';

    }

    finally {

      loginButton.disabled =
        false;

      loginButton.textContent =
        'Entrar';

    }

  }
);


// ============================================================
// VERIFICAR SE JÁ ESTÁ LOGADO
// ============================================================

async function checkExistingSession() {

  const {
    data
  } =
    await journeySupabase
      .auth
      .getSession();


  if (
    data.session
  ) {

    window.location.href =
      'app.html';

  }

}


checkExistingSession();
