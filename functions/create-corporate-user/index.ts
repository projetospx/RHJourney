import { createClient } from
  'https://esm.sh/@supabase/supabase-js@2';


const corsHeaders = {

  'Access-Control-Allow-Origin': '*',

  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',

  'Access-Control-Allow-Methods':
    'POST, OPTIONS'

};


Deno.serve(
  async req => {

    if (
      req.method ===
      'OPTIONS'
    ) {

      return new Response(
        'ok',
        {
          headers:
            corsHeaders
        }
      );

    }


    let createdUserId:
      string | null =
      null;


    try {

      const supabaseUrl =
        Deno.env.get(
          'SUPABASE_URL'
        );


      const anonKey =
        Deno.env.get(
          'SUPABASE_ANON_KEY'
        );


      const serviceRoleKey =
        Deno.env.get(
          'SUPABASE_SERVICE_ROLE_KEY'
        );


      if (
        !supabaseUrl ||
        !anonKey ||
        !serviceRoleKey
      ) {

        throw new Error(
          'Variáveis do Supabase não configuradas.'
        );

      }


      const authHeader =
        req.headers.get(
          'Authorization'
        );


      if (!authHeader) {

        throw new Error(
          'Sessão não encontrada.'
        );

      }


      // ======================================================
      // CLIENTE DO USUÁRIO LOGADO
      // ======================================================

      const userClient =
        createClient(
          supabaseUrl,
          anonKey,
          {

            global: {

              headers: {

                Authorization:
                  authHeader

              }

            }

          }
        );


      const {
        data: userData,
        error: userError
      } =
        await userClient
          .auth
          .getUser();


      if (
        userError ||
        !userData.user
      ) {

        throw new Error(
          'Sessão inválida.'
        );

      }


      // ======================================================
      // SERVICE ROLE
      // ======================================================

      const admin =
        createClient(
          supabaseUrl,
          serviceRoleKey,
          {

            auth: {

              autoRefreshToken:
                false,

              persistSession:
                false

            }

          }
        );


      // ======================================================
      // VALIDAR ADM/RH
      // ======================================================

      const {
        data: callerProfile,
        error: callerError
      } =
        await admin
          .from('profiles')
          .select(`
            id,
            role,
            active
          `)
          .eq(
            'id',
            userData.user.id
          )
          .single();


      if (
        callerError ||
        !callerProfile
      ) {

        throw new Error(
          'Perfil do solicitante não encontrado.'
        );

      }


      if (
        !callerProfile.active
        ||
        callerProfile.role !==
        'ADMIN_RH'
      ) {

        throw new Error(
          'Apenas ADM/RH pode criar acessos.'
        );

      }


      // ======================================================
      // BODY
      // ======================================================

      const body =
        await req.json();


      const fullName =
        String(
          body.fullName || ''
        )
          .trim();


      const email =
        String(
          body.email || ''
        )
          .trim()
          .toLowerCase();


      const password =
        String(
          body.password || ''
        );


      const role =
        String(
          body.role || ''
        )
          .trim();


      const operationIds =
        Array.isArray(
          body.operationIds
        )
          ? body.operationIds
          : [];


      const periodLinks =
        Array.isArray(
          body.periodLinks
        )
          ? body.periodLinks
          : [];


      // ======================================================
      // VALIDAÇÕES
      // ======================================================

      if (!fullName) {

        throw new Error(
          'Nome completo obrigatório.'
        );

      }


      if (
        !email.endsWith(
          '@shopee.com'
        )
      ) {

        throw new Error(
          'Utilize um e-mail @shopee.com.'
        );

      }


      if (
        password.length < 8
      ) {

        throw new Error(
          'A senha precisa ter pelo menos 8 caracteres.'
        );

      }


      if (
        ![
          'LEADER',
          'HR_MANAGER'
        ].includes(role)
      ) {

        throw new Error(
          'Perfil corporativo inválido.'
        );

      }


      if (
        role ===
        'LEADER'
        &&
        operationIds.length === 0
      ) {

        throw new Error(
          'Selecione pelo menos uma operação para o líder.'
        );

      }


      // ======================================================
      // CRIAR AUTH USER
      // ======================================================

      const {
        data: created,
        error: createAuthError
      } =
        await admin
          .auth
          .admin
          .createUser({

            email,

            password,

            email_confirm:
              true,

            user_metadata: {

              full_name:
                fullName

            }

          });


      if (
        createAuthError ||
        !created.user
      ) {

        throw new Error(
          createAuthError?.message
          ||
          'Não foi possível criar o usuário.'
        );

      }


      createdUserId =
        created.user.id;


      // ======================================================
      // PROFILE
      // ======================================================

      const {
        error: profileError
      } =
        await admin
          .from('profiles')
          .insert({

            id:
              createdUserId,

            full_name:
              fullName,

            role,

            corporate_email:
              email,

            must_change_password:
              true,

            active:
              true

          });


      if (profileError) {

        throw new Error(
          profileError.message
        );

      }


      // ======================================================
      // PREFERÊNCIA
      // ======================================================

      const {
        error: preferenceError
      } =
        await admin
          .from(
            'user_preferences'
          )
          .upsert({

            user_id:
              createdUserId,

            theme:
              'light'

          });


      if (preferenceError) {

        throw new Error(
          preferenceError.message
        );

      }


      // ======================================================
      // OPERAÇÕES DO LÍDER
      // ======================================================

      if (
        role ===
        'LEADER'
      ) {

        const uniqueOperationIds =
          [
            ...new Set(
              operationIds
            )
          ];


        const {
          error: operationError
        } =
          await admin
            .from(
              'leader_operations'
            )
            .insert(

              uniqueOperationIds.map(
                operationId => ({

                  leader_id:
                    createdUserId,

                  operation_id:
                    operationId

                })
              )

            );


        if (operationError) {

          throw new Error(
            operationError.message
          );

        }


        // ====================================================
        // PERÍODOS OPCIONAIS
        // ====================================================

        const validLinks =
          periodLinks
            .filter(
              item =>

                item
                &&
                item.operationId
                &&
                item.periodId

            )
            .map(
              item => ({

                leader_id:
                  createdUserId,

                operation_id:
                  item.operationId,

                period_id:
                  item.periodId

              })
            );


        if (
          validLinks.length > 0
        ) {

          const {
            error: periodError
          } =
            await admin
              .from(
                'leader_operation_periods'
              )
              .insert(
                validLinks
              );


          if (periodError) {

            throw new Error(
              periodError.message
            );

          }

        }

      }


      // ======================================================
      // AUDITORIA
      // ======================================================

      await admin
        .from(
          'activity_log'
        )
        .insert({

          user_id:
            userData.user.id,

          action:
            'CORPORATE_USER_CREATED',

          entity_type:
            'profile',

          entity_id:
            createdUserId,

          details: {

            role,

            email,

            operation_ids:
              operationIds

          }

        });


      return new Response(

        JSON.stringify({

          success:
            true,

          userId:
            createdUserId

        }),

        {

          status:
            200,

          headers: {

            ...corsHeaders,

            'Content-Type':
              'application/json'

          }

        }

      );

    }

    catch (error) {

      console.error(
        error
      );


      // ======================================================
      // ROLLBACK
      // ======================================================

      if (
        createdUserId
      ) {

        try {

          const supabaseUrl =
            Deno.env.get(
              'SUPABASE_URL'
            )!;


          const serviceRoleKey =
            Deno.env.get(
              'SUPABASE_SERVICE_ROLE_KEY'
            )!;


          const admin =
            createClient(
              supabaseUrl,
              serviceRoleKey
            );


          await admin
            .auth
            .admin
            .deleteUser(
              createdUserId
            );

        }

        catch (
          rollbackError
        ) {

          console.error(
            'Erro no rollback:',
            rollbackError
          );

        }

      }


      return new Response(

        JSON.stringify({

          success:
            false,

          error:
            error instanceof Error
              ? error.message
              : 'Erro interno.'

        }),

        {

          status:
            400,

          headers: {

            ...corsHeaders,

            'Content-Type':
              'application/json'

          }

        }

      );

    }

  }
);
