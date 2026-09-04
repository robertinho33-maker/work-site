'use strict';

/* =========================================================
   CONFIGURAÇÃO
========================================================= */

const VIACEP_URL = 'https://viacep.com.br/ws';


/* =========================================================
   NORMALIZAÇÃO
========================================================= */

/**
 * Remove tudo que não for número.
 */
function normalizeCEP(cep) {
    return String(cep ?? '').replace(/\D/g, '');
}


/**
 * Verifica se o CEP possui exatamente 8 dígitos.
 */
function isValidCEP(cep) {
    return normalizeCEP(cep).length === 8;
}


/* =========================================================
   BUSCA DE CEP
========================================================= */

/**
 * Consulta um CEP no ViaCEP.
 *
 * Retorna:
 *
 * {
 *     success: true,
 *     data: {
 *         cep,
 *         logradouro,
 *         complemento,
 *         bairro,
 *         localidade,
 *         uf,
 *         ibge,
 *         gia,
 *         ddd,
 *         siafi
 *     }
 * }
 *
 * ou:
 *
 * {
 *     success: false,
 *     message: '...'
 * }
 */
export async function buscarCEP(cep) {

    const cepClean = normalizeCEP(cep);


    /* -----------------------------------------------------
       VALIDAÇÃO
    ----------------------------------------------------- */

    if (!cepClean) {

        return {
            success: false,
            message: 'Informe o CEP.'
        };
    }


    if (!isValidCEP(cepClean)) {

        return {
            success: false,
            message: 'CEP inválido. Informe 8 números.'
        };
    }


    /* -----------------------------------------------------
       CONSULTA
    ----------------------------------------------------- */

    try {

        const response = await fetch(
            `${VIACEP_URL}/${cepClean}/json/`,
            {
                method: 'GET',
                headers: {
                    Accept: 'application/json'
                },
                cache: 'no-store'
            }
        );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }


        const data =
            await response.json();


        /* -------------------------------------------------
           CEP NÃO ENCONTRADO
        ------------------------------------------------- */

        if (data.erro) {

            return {
                success: false,
                message: 'CEP não encontrado.'
            };
        }


        /* -------------------------------------------------
           RESPOSTA NORMALIZADA
        ------------------------------------------------- */

        return {

            success: true,

            data: {

                cep:
                    data.cep || cepClean,

                logradouro:
                    data.logradouro || '',

                complemento:
                    data.complemento || '',

                bairro:
                    data.bairro || '',

                localidade:
                    data.localidade || '',

                uf:
                    data.uf || '',

                ibge:
                    data.ibge || '',

                gia:
                    data.gia || '',

                ddd:
                    data.ddd || '',

                siafi:
                    data.siafi || ''
            }
        };


    } catch (error) {

        console.error(
            '[CEP SERVICE] Erro ao consultar CEP:',
            error
        );


        return {

            success: false,

            message:
                'Não foi possível consultar o CEP. Tente novamente.'
        };
    }
}


/* =========================================================
   FORMATAÇÃO
========================================================= */

/**
 * Formata CEP para apresentação.
 *
 * Exemplo:
 * 01001000 → 01001-000
 */
export function formatCEP(cep) {

    const clean =
        normalizeCEP(cep);


    if (clean.length !== 8) {
        return cep || '';
    }


    return `${clean.slice(0, 5)}-${clean.slice(5)}`;
}


/**
 * Retorna somente os números do CEP.
 */
export function normalizeCEPValue(cep) {

    return normalizeCEP(cep);
}