import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(
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
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type ImportRow = {
  nome?: string;
  cpf?: string;
  data_nascimento?: string;
  bpo?: string;
  data_admissao?: string;
  email?: string;
  telefone?: string;
  operacao?: string;
  horario_escala?: string;
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

function normalizeCPF(value: unknown) {
  return String(value ?? "")
    .replace(/\D/g, "");
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim();
}

function normalizeEmail(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizePhone(value: unknown) {
  return String(value ?? "")
    .replace(/\D/g, "");
}

function isValidISODate(value: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date =
    new Date(`${value}T12:00:00Z`);

  return !Number.isNaN(
    date.getTime()
  );
}

function formatInitialPassword(
  birthDate: string
) {
  const [year, month, day] =
    birthDate.split("-");

  return `${day}${month}${year}`;
}

function internalEmployeeEmail(
  cpf: string
) {
  return `${cpf}@employee.journey.internal`;
}


// ------------------------------------------------------------
// VALIDAÇÃO REAL DE CPF
// ------------------------------------------------------------

function isValidCPF(cpf: string) {

  if (!/^\d{11}$/.test(cpf)) {
    return false;
  }

  if (/^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const calculateDigit = (
    base: string,
    factor: number
  ) => {

    let total = 0;

    for (
      let i = 0;
      i < base.length;
      i++
    ) {
      total +=
        Number(base[i]) * factor--;

    }

    const remainder =
      (total * 10) % 11;

    return remainder === 10
      ? 0
      : remainder;
  };


  const digit1 =
    calculateDigit(
      cpf.substring(0, 9),
      10
    );


  if (
    digit1 !==
    Number(cpf[9])
  ) {
    return false;
  }


  const digit2 =
    calculateDigit(
      cpf.substring(0, 10),
      11
    );


  return (
    digit2 ===
    Number(cpf[10])
  );
}


// ------------------------------------------------------------
// PEGAR OU CRIAR BPO
// ------------------------------------------------------------

async function getOrCreateBPO(
  name: string
) {

  const {
    data: existing,
    error: findError
  } =
    await admin
      .from("bpos")
      .select("id, name")
      .ilike("name", name)
      .limit(1)
      .maybeSingle();


  if (findError) {
    throw findError;
  }


  if (existing) {
    return existing.id;
  }


  const {
    data,
    error
  } =
    await admin
      .from("bpos")
      .insert({
        name
      })
      .select("id")
      .single();


  if (error) {
    throw error;
  }


  return data.id;
}


// ------------------------------------------------------------
// PEGAR OU CRIAR OPERAÇÃO
// ------------------------------------------------------------

async function getOrCreateOperation(
  name: string
) {

  const {
    data: existing,
    error: findError
  } =
    await admin
      .from("operations")
      .select("id, name")
      .ilike("name", name)
      .limit(1)
      .maybeSingle();


  if (findError) {
    throw findError;
  }


  if (existing) {
    return existing.id;
  }


  const {
    data,
    error
  } =
    await admin
      .from("operations")
      .insert({
        name
      })
      .select("id")
      .single();


  if (error) {
    throw error;
  }


  return data.id;
}


// ============================================================
// EDGE FUNCTION
// ============================================================

Deno.serve(
  async (req) => {

    if (req.method === "OPTIONS") {

      return new Response(
        "ok",
        {
          headers:
            corsHeaders
        }
      );

    }


    if (req.method !== "POST") {

      return jsonResponse(
        {
          error:
            "Método não permitido."
        },
        405
      );

    }


    try {

      // ======================================================
      // 1. VALIDAR USUÁRIO LOGADO
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
              "Sessão inválida ou expirada."
          },
          401
        );

      }


      const caller =
        userData.user;


      // ======================================================
      // 2. CONFIRMAR ADMIN_RH
      // ======================================================

      const {
        data: callerProfile,
        error: profileError
      } =
        await admin
          .from("profiles")
          .select(
            "id, full_name, role, active"
          )
          .eq(
            "id",
            caller.id
          )
          .single();


      if (
        profileError ||
        !callerProfile
      ) {

        return jsonResponse(
          {
            error:
              "Perfil do usuário não encontrado."
          },
          403
        );

      }


      if (
        !callerProfile.active ||
        callerProfile.role !==
          "ADMIN_RH"
      ) {

        return jsonResponse(
          {
            error:
              "Somente ADM/RH pode importar colaboradores."
          },
          403
        );

      }


      // ======================================================
      // 3. LER ARQUIVO PROCESSADO PELO FRONTEND
      // ======================================================

      const body =
        await req.json();


      const rows: ImportRow[] =
        Array.isArray(body.rows)
          ? body.rows
          : [];


      const fileName =
        normalizeText(
          body.fileName
        ) ||
        "importacao";


      if (!rows.length) {

        return jsonResponse(
          {
            error:
              "Nenhum colaborador recebido."
          },
          400
        );

      }


      if (
        rows.length > 500
      ) {

        return jsonResponse(
          {
            error:
              "Importe no máximo 500 colaboradores por arquivo."
          },
          400
        );

      }


      // ======================================================
      // 4. CRIAR LOTE
      // ======================================================

      const {
        data: batch,
        error: batchError
      } =
        await admin
          .from(
            "import_batches"
          )
          .insert({
            file_name:
              fileName,

            total_rows:
              rows.length,

            valid_rows:
              0,

            invalid_rows:
              0,

            imported_by:
              caller.id
          })
          .select("id")
          .single();


      if (
        batchError ||
        !batch
      ) {

        throw (
          batchError ||
          new Error(
            "Não foi possível criar o lote."
          )
        );

      }


      const results = [];

      let importedCount = 0;
      let invalidCount = 0;


      // ======================================================
      // 5. PROCESSAR CADA COLABORADOR
      // ======================================================

      for (
        let index = 0;
        index < rows.length;
        index++
      ) {

        const raw =
          rows[index];


        const rowNumber =
          index + 2;


        let newlyCreatedAuthId:
          string | null = null;


        try {

          const fullName =
            normalizeText(
              raw.nome
            );


          const cpf =
            normalizeCPF(
              raw.cpf
            );


          const birthDate =
            normalizeText(
              raw.data_nascimento
            );


          const bpoName =
            normalizeText(
              raw.bpo
            );


          const admissionDate =
            normalizeText(
              raw.data_admissao
            );


          const email =
            normalizeEmail(
              raw.email
            );


          const phone =
            normalizePhone(
              raw.telefone
            );


          const operationName =
            normalizeText(
              raw.operacao
            );


          const workSchedule =
            normalizeText(
              raw.horario_escala
            );


          // ==================================================
          // CAMPOS OBRIGATÓRIOS
          // ==================================================

          if (!fullName) {
            throw new Error(
              "Nome não informado."
            );
          }


          if (!isValidCPF(cpf)) {
            throw new Error(
              "CPF inválido."
            );
          }


          if (
            !isValidISODate(
              birthDate
            )
          ) {

            throw new Error(
              "Data de nascimento inválida."
            );

          }


          if (!bpoName) {
            throw new Error(
              "BPO não informada."
            );
          }


          if (
            !isValidISODate(
              admissionDate
            )
          ) {

            throw new Error(
              "Data de admissão inválida."
            );

          }


          if (!email) {
            throw new Error(
              "E-mail não informado."
            );
          }


          if (!phone) {
            throw new Error(
              "Telefone não informado."
            );
          }


          if (!operationName) {
            throw new Error(
              "HUB/Operação não informado."
            );
          }


          if (!workSchedule) {
            throw new Error(
              "Horário/Escala não informado."
            );
          }


          // ==================================================
          // LOCALIZAR PESSOA PELO CPF
          // ==================================================

          const {
            data: existingPerson,
            error: findPersonError
          } =
            await admin
              .from("people")
              .select(
                "id, auth_user_id, full_name"
              )
              .eq(
                "cpf",
                cpf
              )
              .maybeSingle();


          if (findPersonError) {
            throw findPersonError;
          }


          let personId:
            string;

          let authUserId:
            string | null =
              existingPerson
                ?.auth_user_id ??
              null;


          let newUser =
            false;


          // ==================================================
          // PESSOA NOVA:
          // CRIAR CONTA AUTH
          // ==================================================

          if (!existingPerson) {

            const initialPassword =
              formatInitialPassword(
                birthDate
              );


            const internalEmail =
              internalEmployeeEmail(
                cpf
              );


            const {
              data: authData,
              error: authError
            } =
              await admin
                .auth
                .admin
                .createUser({
                  email:
                    internalEmail,

                  password:
                    initialPassword,

                  email_confirm:
                    true,

                  user_metadata: {
                    full_name:
                      fullName,

                    cpf,

                    role:
                      "EMPLOYEE"
                  }
                });


            if (
              authError ||
              !authData.user
            ) {

              throw (
                authError ||
                new Error(
                  "Erro ao criar usuário."
                )
              );

            }


            authUserId =
              authData.user.id;


            newlyCreatedAuthId =
              authUserId;


            newUser =
              true;


            // ----------------------------------------------
            // PROFILE
            // ----------------------------------------------

            const {
              error: newProfileError
            } =
              await admin
                .from("profiles")
                .insert({
                  id:
                    authUserId,

                  full_name:
                    fullName,

                  role:
                    "EMPLOYEE",

                  corporate_email:
                    null,

                  must_change_password:
                    true,

                  active:
                    true
                });


            if (newProfileError) {
              throw newProfileError;
            }


            // ----------------------------------------------
            // PREFERÊNCIA
            // ----------------------------------------------

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
                    authUserId,

                  theme:
                    "light"
                });


            if (preferenceError) {
              throw preferenceError;
            }


            // ----------------------------------------------
            // PESSOA
            // ----------------------------------------------

            const {
              data: newPerson,
              error: personError
            } =
              await admin
                .from("people")
                .insert({
                  auth_user_id:
                    authUserId,

                  full_name:
                    fullName,

                  cpf,

                  birth_date:
                    birthDate,

                  email,

                  phone
                })
                .select("id")
                .single();


            if (
              personError ||
              !newPerson
            ) {
              throw (
                personError ||
                new Error(
                  "Erro ao cadastrar colaborador."
                )
              );
            }


            personId =
              newPerson.id;

          }

          else {

            // =================================================
            // PESSOA JÁ EXISTE
            // Atualizar dados sem apagar histórico.
            // =================================================

            personId =
              existingPerson.id;


            const {
              error: updatePersonError
            } =
              await admin
                .from("people")
                .update({
                  full_name:
                    fullName,

                  birth_date:
                    birthDate,

                  email,

                  phone,

                  updated_at:
                    new Date()
                      .toISOString()
                })
                .eq(
                  "id",
                  personId
                );


            if (updatePersonError) {
              throw updatePersonError;
            }


            // Caso antigo sem Auth
            if (!authUserId) {

              const initialPassword =
                formatInitialPassword(
                  birthDate
                );


              const {
                data: authData,
                error: authError
              } =
                await admin
                  .auth
                  .admin
                  .createUser({
                    email:
                      internalEmployeeEmail(
                        cpf
                      ),

                    password:
                      initialPassword,

                    email_confirm:
                      true,

                    user_metadata: {
                      full_name:
                        fullName,

                      cpf,

                      role:
                        "EMPLOYEE"
                    }
                  });


              if (
                authError ||
                !authData.user
              ) {

                throw (
                  authError ||
                  new Error(
                    "Erro ao criar acesso do colaborador."
                  )
                );

              }


              authUserId =
                authData.user.id;


              newlyCreatedAuthId =
                authUserId;


              newUser =
                true;


              await admin
                .from("profiles")
                .insert({
                  id:
                    authUserId,

                  full_name:
                    fullName,

                  role:
                    "EMPLOYEE",

                  must_change_password:
                    true,

                  active:
                    true
                });


              await admin
                .from(
                  "user_preferences"
                )
                .insert({
                  user_id:
                    authUserId,

                  theme:
                    "light"
                });


              await admin
                .from("people")
                .update({
                  auth_user_id:
                    authUserId
                })
                .eq(
                  "id",
                  personId
                );

            }

          }


          // ==================================================
          // NÃO DUPLICAR A MESMA ADMISSÃO
          // ==================================================

          const {
            data:
              duplicateEmployment,
            error:
              employmentCheckError
          } =
            await admin
              .from(
                "employments"
              )
              .select(
                "id, status"
              )
              .eq(
                "person_id",
                personId
              )
              .eq(
                "admission_date",
                admissionDate
              )
              .maybeSingle();


          if (employmentCheckError) {
            throw employmentCheckError;
          }


          if (
            duplicateEmployment
          ) {

            throw new Error(
              "Esta admissão já está cadastrada."
            );

          }


          // ==================================================
          // BPO + OPERAÇÃO
          // ==================================================

          const bpoId =
            await getOrCreateBPO(
              bpoName
            );


          const operationId =
            await getOrCreateOperation(
              operationName
            );


          // ==================================================
          // CRIAR VÍNCULO
          // FICA WAITING
          // ==================================================

          const {
            data: employment,
            error:
              employmentError
          } =
            await admin
              .from(
                "employments"
              )
              .insert({
                person_id:
                  personId,

                bpo_id:
                  bpoId,

                operation_id:
                  operationId,

                admission_date:
                  admissionDate,

                work_schedule:
                  workSchedule,

                leader_id:
                  null,

                import_batch_id:
                  batch.id,

                status:
                  "WAITING"
              })
              .select("id")
              .single();


          if (
            employmentError ||
            !employment
          ) {

            throw (
              employmentError ||
              new Error(
                "Erro ao criar vínculo."
              )
            );

          }


          // ==================================================
          // AUDITORIA
          // ==================================================

          await admin
            .from(
              "activity_log"
            )
            .insert({
              user_id:
                caller.id,

              action:
                "EMPLOYEE_IMPORTED",

              entity_type:
                "employment",

              entity_id:
                employment.id,

              details: {
                cpf,
                full_name:
                  fullName,

                new_user:
                  newUser,

                import_batch_id:
                  batch.id
              }
            });


          importedCount++;


          results.push({
            row:
              rowNumber,

            cpf,

            name:
              fullName,

            status:
              "IMPORTED",

            newUser
          });

        }

        catch (rowError) {

          invalidCount++;


          // ==================================================
          // ROLLBACK DO AUTH SE O USUÁRIO ACABOU DE SER CRIADO
          // MAS A LINHA FALHOU
          // ==================================================

          if (
            newlyCreatedAuthId
          ) {

            try {

              await admin
                .auth
                .admin
                .deleteUser(
                  newlyCreatedAuthId
                );

            }

            catch (
              rollbackError
            ) {

              console.error(
                "Erro no rollback:",
                rollbackError
              );

            }

          }


          results.push({
            row:
              rowNumber,

            cpf:
              normalizeCPF(
                raw.cpf
              ),

            name:
              normalizeText(
                raw.nome
              ),

            status:
              "ERROR",

            error:
              rowError instanceof Error
                ? rowError.message
                : "Erro desconhecido."
          });

        }

      }


      // ======================================================
      // 6. ATUALIZAR LOTE
      // ======================================================

      await admin
        .from(
          "import_batches"
        )
        .update({
          valid_rows:
            importedCount,

          invalid_rows:
            invalidCount
        })
        .eq(
          "id",
          batch.id
        );


      // ======================================================
      // 7. LOG DO LOTE
      // ======================================================

      await admin
        .from(
          "activity_log"
        )
        .insert({
          user_id:
            caller.id,

          action:
            "IMPORT_COMPLETED",

          entity_type:
            "import_batch",

          entity_id:
            batch.id,

          details: {
            file_name:
              fileName,

            total:
              rows.length,

            imported:
              importedCount,

            errors:
              invalidCount
          }
        });


      return jsonResponse({
        success:
          true,

        batchId:
          batch.id,

        total:
          rows.length,

        imported:
          importedCount,

        errors:
          invalidCount,

        results
      });

    }

    catch (error) {

      console.error(
        "IMPORT FUNCTION ERROR",
        error
      );


      return jsonResponse(
        {
          success:
            false,

          error:
            error instanceof Error
              ? error.message
              : "Erro interno durante a importação."
        },
        500
      );

    }

  }
);
