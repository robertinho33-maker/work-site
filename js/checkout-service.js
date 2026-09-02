import { db } from "./firebase-config.js";
import { 
    doc, 
    getDoc, 
    addDoc, 
    collection, 
    runTransaction, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * Valida se um código de cupom existe e está ativo.
 */
export async function validateCoupon(couponCode) {
    const code = couponCode.trim().toUpperCase();
    if (!code) return { success: false, message: "Digite um cupom." };

    try {
        const couponSnap = await getDoc(doc(db, "coupons", code));
        if (!couponSnap.exists() || !couponSnap.data().active) {
            return { success: false, message: "Cupom inválido ou expirado." };
        }
        return { success: true, coupon: { id: couponSnap.id, code, ...couponSnap.data() } };
    } catch (error) {
        console.error("Erro ao aplicar cupom:", error);
        return { success: false, message: "Erro ao validar cupom." };
    }
}

/**
 * Obtém o próximo número de pedido incremental de forma atômica.
 */
export async function getNextOrderId() {
    const counterRef = doc(db, "counters", "orders");
    return await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        let nextNumber = 1000;
        if (counterSnap.exists()) {
            nextNumber = (counterSnap.data().current || 1000) + 1;
        }
        transaction.set(counterRef, { current: nextNumber }, { merge: true });
        return nextNumber.toString();
    });
}

/**
 * Processa a criação de pedido e registra a comissão correspondente no Firestore.
 */
export async function processOrder({ customer, items, subtotal, activeCoupon, user }) {
    try {
        const discountPercentage = Number(activeCoupon?.discountPercentage || activeCoupon?.value || 0);
        const discountAmount = activeCoupon ? (subtotal * discountPercentage) / 100 : 0;
        const totalAmount = Math.max(0, subtotal - discountAmount);

        const orderIdNumber = await getNextOrderId();

        const orderData = {
            orderId: orderIdNumber,
            clientUid: user ? user.uid : null,
            clientEmail: user ? user.email : "Anônimo",
            clientName: customer.name || (user?.displayName || "Cliente Anônimo"),
            clientPhone: customer.phone || "",
            items: items || [],
            subtotal,
            discount: discountAmount,
            total: totalAmount,
            paymentStatus: "pendente",
            deliveryStatus: "aguardando_pagamento",
            couponUsed: activeCoupon ? activeCoupon.code : null,
            createdAt: serverTimestamp()
        };

        const orderRef = await addDoc(collection(db, "orders"), orderData);

        const commPct = Number(activeCoupon?.commissionPercentage || activeCoupon?.commissionPercent || 0);
        if (activeCoupon && commPct > 0) {
            const commissionVal = (totalAmount * commPct) / 100;
            let influencerName = activeCoupon.influencerName || activeCoupon.affiliateName || "Influencer";

            if (activeCoupon.influencerEmail) {
                const userDocId = activeCoupon.influencerEmail.replace(/[^a-zA-Z0-9]/g, "_");
                const userSnap = await getDoc(doc(db, "users", userDocId));
                if (userSnap.exists()) {
                    influencerName = userSnap.data().name || influencerName;
                }
            }

            await addDoc(collection(db, "commissions"), {
                orderId: orderIdNumber,
                orderDocId: orderRef.id,
                couponCode: activeCoupon.code,
                email: activeCoupon.influencerEmail || "",
                influencerName: influencerName,
                commissionValue: commissionVal,
                commissionPercent: commPct,
                payoutStatus: "Pendente",
                createdAt: serverTimestamp()
            });
        }

        return { success: true, orderId: orderIdNumber, docId: orderRef.id };
    } catch (error) {
        console.error("Erro no processamento do checkout:", error);
        return { success: false, message: error.message };
    }
}