import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL")!;

const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin =
  createClient(
    SUPABASE_URL,
    SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",

  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",

  "Access-Control-Allow-Methods":
    "POST, OPTIONS"
};


function jsonResponse(
  body: unknown,
  status = 200
) {

  return new Response(
    JSON.stringify(body),
    {
      status,

      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    }
  );

}


Deno.serve(
  async req => {

    if (
      req.method ===
      "OPTIONS"
    ) {

      return new Response(
        "ok",
        {
          headers:
            corsHeaders
        }
      );

    }


    try {

      // ======================================================
      // AUTENTICAÇÃO
      // ======================================================

      const authHeader =
        req.headers.get(
          "Authorization"
        );


      if (!authHeader) {

        return jsonResponse(
          {
            error:
              "Usuário não autenticado."
          },
          401
        );

      }


      const token =
        authHeader.replace(
          /^Bearer\s+/i,
          ""
        );


      const {
        data: userData,
        error: userError
      } =
        await admin.auth.getUser(
          token
        );


      if (
        userError ||
        !userData.user
      ) {

        return jsonResponse(
          {
            error:
              "Sessão inválida."
          },
          401
        );

      }


      const caller =
        userData.user;


      // ======================================================
      // SOMENTE ADMIN_RH
      // ======================================================

      const {
        data: callerProfile,
        error: profileError
      } =
        await admin
          .from("profiles")
          .select(
            "role, active"
          )
          .eq(
            "id",
            caller.id
          )
          .single();


      if (
        profileError ||
        !callerProfile ||
        !callerProfile.active ||
        callerProfile.role !==
          "ADMIN_RH"
      ) {

        return jsonResponse(
          {
            error:
              "Somente ADM/RH pode cadastrar usuários corporativos."
          },
          403
        );

      }


      // ======================================================
      // DADOS RECEBIDOS
      // ======================================================

      const body =
        await req.json();


      const fullName =
        String(
          body.fullName || ""
        )
          .trim();


      const email =
        String(
          body.email || ""
        )
          .trim()
          .toLowerCase();


      const password =
        String(
          body.password || ""
        );


      const role =
        String(
          body.role || ""
        )
          .trim();


      const operationIds =
        Array.isArray(
          body.operationIds
        )
          ? body.operationIds
          : [];


      // ======================================================
      // VALIDAÇÕES
      // ======================================================

      if (!fullName) {

        return jsonResponse(
          {
            error:
              "Informe o nome do usuário."
          },
          400
        );

      }


      if (
        !email.endsWith(
          "@shopee.com"
        )
      ) {

        return jsonResponse(
          {
            error:
              "Utilize um e-mail corporativo @shopee.com."
          },
          400
        );

      }


      if (
        password.length < 8
      ) {

        return jsonResponse(
          {
            error:
              "A senha inicial deve possuir pelo menos 8 caracteres."
          },
          400
        );

      }


      if (
        role !== "LEADER" &&
        role !== "HR_MANAGER"
      ) {

        return jsonResponse(
          {
            error:
              "Perfil inválido."
          },
          400
        );

      }


      if (
        role === "LEADER" &&
        operationIds.length === 0
      ) {

        return jsonResponse(
          {
            error:
              "Selecione pelo menos uma operação para a liderança."
          },
          400
        );

      }


      // ======================================================
      // CRIAR AUTH
      // ======================================================

      const {
        data: authData,
        error: authError
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
                fullName,

              role
            }
          });


      if (
        authError ||
        !authData.user
      ) {

        return jsonResponse(
          {
            error:
              authError?.message ||
              "Não foi possível criar o usuário."
          },
          400
        );

      }


      const userId =
        authData.user.id;


      try {

        // ====================================================
        // PROFILE
        // ====================================================

        const {
          error:
            insertProfileError
        } =
          await admin
            .from("profiles")
            .insert({
              id:
                userId,

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


        if (insertProfileError) {
          throw insertProfileError;
        }


        // ====================================================
        // PREFERÊNCIA
        // ====================================================

        const {
          error:
            preferenceError
        } =
          await admin
            .from(
              "user_preferences"
            )
            .insert({
              user_id:
                userId,

              theme:
                "light"
            });


        if (preferenceError) {
          throw preferenceError;
        }


        // ====================================================
        // OPERAÇÕES DO LÍDER
        // ====================================================

        if (
          role === "LEADER"
        ) {

          const links =
            operationIds.map(
              operationId => ({
                leader_id:
                  userId,

                operation_id:
                  operationId
              })
            );


          const {
            error:
              operationError
          } =
            await admin
              .from(
                "leader_operations"
              )
              .insert(
                links
              );


          if (operationError) {
            throw operationError;
          }

        }


        // ====================================================
        // AUDITORIA
        // ====================================================

        await admin
          .from(
            "activity_log"
          )
          .insert({
            user_id:
              caller.id,

            action:
              "CORPORATE_USER_CREATED",

            entity_type:
              "profile",

            entity_id:
              userId,

            details: {
              full_name:
                fullName,

              email,

              role,

              operations:
                operationIds
            }
          });


        return jsonResponse({
          success:
            true,

          userId,

          message:
            "Usuário criado com sucesso."
        });

      }

      catch (databaseError) {

        // rollback Auth
        await admin
          .auth
          .admin
          .deleteUser(
            userId
          );


        throw databaseError;

      }

    }

    catch (error) {

      console.error(
        "CREATE CORPORATE USER ERROR",
        error
      );


      return jsonResponse(
        {
          success:
            false,

          error:
            error instanceof Error
              ? error.message
              : "Erro ao cadastrar usuário."
        },
        500
      );

    }

  }
);
