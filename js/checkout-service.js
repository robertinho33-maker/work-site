'use strict';

import { db } from "./firebase-config.js";

import {
    doc,
    getDoc,
    addDoc,
    collection,
    query,
    where,
    getDocs,
    runTransaction,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


/* =========================================================
   VALIDAÇÕES
========================================================= */

function normalizePhone(phone) {
    return String(phone ?? '').replace(/\D/g, '');
}


function isValidPhone(phone) {
    const cleanPhone = normalizePhone(phone);

    // Brasil: aceita 10 ou 11 dígitos
    return cleanPhone.length === 10 || cleanPhone.length === 11;
}


function normalizeEmail(email) {
    return String(email ?? '')
        .trim()
        .toLowerCase();
}


function isValidEmail(email) {
    const normalizedEmail = normalizeEmail(email);

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
}


/* =========================================================
   CUPOM
========================================================= */

/**
 * Valida se um código de cupom existe e está ativo.
 */
export async function validateCoupon(couponCode) {

    if (!couponCode || typeof couponCode !== 'string') {
        return {
            success: false,
            message: "Digite um cupom."
        };
    }

    const code = couponCode
        .trim()
        .toUpperCase();

    if (
        !code ||
        code === "DIGITE AQUI CÓDIGO DO CUPOM" ||
        code === "FALSE"
    ) {
        return {
            success: false,
            message: "Cupom inválido ou não informado."
        };
    }

    try {

        const couponSnap = await getDoc(
            doc(db, "coupons", code)
        );

        if (
            !couponSnap.exists() ||
            !couponSnap.data().active
        ) {
            return {
                success: false,
                message: "Cupom inválido ou expirado."
            };
        }

        return {
            success: true,
            coupon: {
                id: couponSnap.id,
                code,
                ...couponSnap.data()
            }
        };

    } catch (error) {

        console.error(
            "Erro ao aplicar cupom:",
            error
        );

        return {
            success: false,
            message: "Erro ao validar cupom."
        };
    }
}


/* =========================================================
   NUMERAÇÃO DO PEDIDO
========================================================= */

/**
 * Obtém o próximo número de pedido de forma atômica.
 */
export async function getNextOrderId() {

    const counterRef = doc(
        db,
        "counters",
        "orders"
    );

    return await runTransaction(
        db,
        async transaction => {

            const counterSnap =
                await transaction.get(counterRef);

            let nextNumber = 1000;

            if (counterSnap.exists()) {

                const current =
                    Number(
                        counterSnap.data().current
                    );

                if (
                    Number.isFinite(current) &&
                    current >= 1000
                ) {
                    nextNumber = current + 1;
                }
            }

            transaction.set(
                counterRef,
                {
                    current: nextNumber
                },
                {
                    merge: true
                }
            );

            return nextNumber.toString();
        }
    );
}


/* =========================================================
   CLIENTE
========================================================= */

/**
 * Procura ou cria o cliente.
 *
 * Regra de identificação:
 * - telefone
 * - e-mail
 *
 * CPF não é utilizado.
 */
async function getOrCreateClient(customer) {

    const phoneClean =
        normalizePhone(customer.phone);

    const emailClean =
        normalizeEmail(customer.email);


    let clientQuerySnapshot = null;


    /* ---------------------------------------------------------
       PRIMEIRO: TELEFONE
    --------------------------------------------------------- */

    if (phoneClean) {

        const qPhone = query(
            collection(db, "clients"),
            where("phone", "==", phoneClean)
        );

        clientQuerySnapshot =
            await getDocs(qPhone);
    }


    /* ---------------------------------------------------------
       SEGUNDO: E-MAIL
    --------------------------------------------------------- */

    if (
        (!clientQuerySnapshot ||
            clientQuerySnapshot.empty) &&
        emailClean
    ) {

        const qEmail = query(
            collection(db, "clients"),
            where("email", "==", emailClean)
        );

        clientQuerySnapshot =
            await getDocs(qEmail);
    }


    /* ---------------------------------------------------------
       CLIENTE EXISTENTE
    --------------------------------------------------------- */

    if (
        clientQuerySnapshot &&
        !clientQuerySnapshot.empty
    ) {

        const existingDoc =
            clientQuerySnapshot.docs[0];

        return {
            clientId: existingDoc.id,
            isNew: false,
            data: existingDoc.data()
        };
    }


    /* ---------------------------------------------------------
       NOVO CLIENTE
    --------------------------------------------------------- */

    const clientData = {

        name:
            String(customer.name || "Cliente")
                .trim(),

        email:
            emailClean,

        phone:
            phoneClean,

        cep:
            String(customer.cep || '')
                .trim(),

        address:
            String(customer.address || '')
                .trim(),

        createdAt:
            serverTimestamp()
    };


    const newClientRef =
        await addDoc(
            collection(db, "clients"),
            clientData
        );


    return {
        clientId: newClientRef.id,
        isNew: true,
        data: clientData
    };
}


/* =========================================================
   PROCESSAMENTO DO PEDIDO
========================================================= */

/**
 * Cria o pedido, cliente e comissão.
 */
export async function processOrder({
    customer,
    items,
    subtotal,
    activeCoupon,
    user,
    cep,
    address
}) {

    try {

        /* -----------------------------------------------------
           VALIDAÇÃO DO CLIENTE
        ----------------------------------------------------- */

        if (!customer || typeof customer !== 'object') {

            return {
                success: false,
                message: "Dados do cliente não informados."
            };
        }


        const name =
            String(customer.name || '')
                .trim();

        const email =
            normalizeEmail(customer.email);

        const phone =
            normalizePhone(customer.phone);


        if (!name) {

            return {
                success: false,
                message: "Informe seu nome."
            };
        }


        if (!isValidEmail(email)) {

            return {
                success: false,
                message: "Informe um e-mail válido."
            };
        }


        if (!isValidPhone(phone)) {

            return {
                success: false,
                message: "Informe um telefone válido."
            };
        }


        /* -----------------------------------------------------
           CEP / ENDEREÇO
        ----------------------------------------------------- */

        const cepClean =
            String(cep || '')
                .replace(/\D/g, '');

        const addressClean =
            String(address || '')
                .trim();


        if (cepClean.length !== 8) {

            return {
                success: false,
                message: "Informe um CEP válido."
            };
        }


        if (!addressClean) {

            return {
                success: false,
                message: "Informe o endereço."
            };
        }


        /* -----------------------------------------------------
           ITENS
        ----------------------------------------------------- */

        if (!Array.isArray(items) || items.length === 0) {

            return {
                success: false,
                message: "O carrinho está vazio."
            };
        }


        /* -----------------------------------------------------
           SUBTOTAL
        ----------------------------------------------------- */

        const subtotalNumber =
            Number(subtotal);


        if (
            !Number.isFinite(subtotalNumber) ||
            subtotalNumber <= 0
        ) {

            return {
                success: false,
                message: "O valor do pedido é inválido."
            };
        }


        /* -----------------------------------------------------
           CUPOM
        ----------------------------------------------------- */

        let validCouponData = null;


        if (
            activeCoupon &&
            typeof activeCoupon === 'object' &&
            activeCoupon.code
        ) {

            const check =
                await validateCoupon(
                    activeCoupon.code
                );


            if (check.success) {

                validCouponData =
                    check.coupon;
            }
        }


        /* -----------------------------------------------------
           DESCONTO
        ----------------------------------------------------- */

        let discountPercentage = 0;


        if (validCouponData) {

            discountPercentage =
                Number(
                    validCouponData.discountPercentage ??
                    validCouponData.value ??
                    0
                );

            if (
                !Number.isFinite(discountPercentage) ||
                discountPercentage < 0
            ) {
                discountPercentage = 0;
            }

            // Nunca permite desconto acima de 100%.
            discountPercentage =
                Math.min(
                    discountPercentage,
                    100
                );
        }


        const discountAmount =
            Math.min(
                subtotalNumber,
                (
                    subtotalNumber *
                    discountPercentage
                ) / 100
            );


        const totalAmount =
            Math.max(
                0,
                subtotalNumber -
                discountAmount
            );


        /* -----------------------------------------------------
           CLIENTE
        ----------------------------------------------------- */

        const customerPayload = {

            name,
            email,
            phone,

            cep: cepClean,

            address: addressClean
        };


        const { clientId } =
            await getOrCreateClient(
                customerPayload
            );


        /* -----------------------------------------------------
           NÚMERO DO PEDIDO
        ----------------------------------------------------- */

        const orderIdNumber =
            await getNextOrderId();


        /* -----------------------------------------------------
           PEDIDO
        ----------------------------------------------------- */

        const orderData = {

            orderId:
                orderIdNumber,

            clientId:
                clientId,

            clientUid:
                user?.uid || null,

            clientEmail:
                user?.email || email,

            clientName:
                name,

            clientPhone:
                phone,

            cep:
                cepClean,

            address:
                addressClean,

            items:
                items,

            subtotal:
                subtotalNumber,

            discount:
                discountAmount,

            total:
                totalAmount,

            paymentStatus:
                "pendente",

            deliveryStatus:
                "aguardando_pagamento",

            couponUsed:
                validCouponData
                    ? validCouponData.code
                    : null,

            createdAt:
                serverTimestamp()
        };


        const orderRef =
            await addDoc(
                collection(db, "orders"),
                orderData
            );


        /* -----------------------------------------------------
           COMISSÃO
        ----------------------------------------------------- */

        if (validCouponData) {

            let commPct =
                Number(
                    validCouponData.commissionPercentage ??
                    validCouponData.commissionPercent ??
                    0
                );


            if (
                !Number.isFinite(commPct) ||
                commPct < 0
            ) {
                commPct = 0;
            }


            commPct =
                Math.min(
                    commPct,
                    100
                );


            if (commPct > 0) {

                const commissionVal =
                    (
                        totalAmount *
                        commPct
                    ) / 100;


                let influencerName =
                    validCouponData.influencerName ||
                    validCouponData.affiliateName ||
                    "Influencer";


                if (
                    validCouponData.influencerEmail
                ) {

                    const userDocId =
                        validCouponData.influencerEmail
                            .replace(
                                /[^a-zA-Z0-9]/g,
                                "_"
                            );


                    const userSnap =
                        await getDoc(
                            doc(
                                db,
                                "users",
                                userDocId
                            )
                        );


                    if (userSnap.exists()) {

                        influencerName =
                            userSnap.data().name ||
                            influencerName;
                    }
                }


                await addDoc(
                    collection(db, "commissions"),
                    {

                        orderId:
                            orderIdNumber,

                        orderDocId:
                            orderRef.id,

                        couponCode:
                            validCouponData.code,

                        email:
                            validCouponData.influencerEmail || "",

                        influencerName:
                            influencerName,

                        commissionValue:
                            commissionVal,

                        commissionPercent:
                            commPct,

                        payoutStatus:
                            "Pendente",

                        createdAt:
                            serverTimestamp()
                    }
                );
            }
        }


        /* -----------------------------------------------------
           SUCESSO
        ----------------------------------------------------- */

        return {

            success: true,

            orderId:
                orderIdNumber,

            docId:
                orderRef.id,

            total:
                totalAmount
        };


    } catch (error) {

        console.error(
            "Erro no processamento do checkout:",
            error
        );

        return {

            success: false,

            message:
                error.message ||
                "Não foi possível processar o pedido."
        };
    }
}