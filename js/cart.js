import { db } from "./firebase-config.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Função acionada ao finalizar a compra
async function createOrderAndCommission(orderData, appliedCoupon) {
    try {
        // 1. Salva o pedido
        const orderRef = await addDoc(collection(db, "orders"), {
            ...orderData,
            createdAt: serverTimestamp()
        });

        // 2. Se houver cupom com comissão (> 0), lança o registro em 'commissions'
        if (appliedCoupon && Number(appliedCoupon.commissionPercent) > 0) {
            const commissionValue = (Number(orderData.totalAmount) * Number(appliedCoupon.commissionPercent)) / 100;

            await addDoc(collection(db, "commissions"), {
                orderId: orderRef.id,
                influencerId: appliedCoupon.influencerId || null,
                affiliateName: appliedCoupon.affiliateName || "Geral",
                code: appliedCoupon.code,
                orderTotal: Number(orderData.totalAmount),
                commissionPercent: Number(appliedCoupon.commissionPercent),
                commissionValue: commissionValue,
                payoutStatus: "Pendente",
                createdAt: serverTimestamp()
            });
        }

        alert("Pedido concluído com sucesso!");
    } catch (error) {
        console.error("Erro ao processar pedido e comissão:", error);
    }
    import { db } from "./firebase-config.js";
import { 
    doc, getDoc, addDoc, collection, runTransaction, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Estado local do carrinho e cupom
let currentCoupon = null;

// 1. Validação do Cupom no Checkout
export async function applyCouponCode(couponCode) {
    const code = couponCode.trim().toUpperCase();
    if (!code) return { success: false, message: "Digite um cupom." };

    try {
        const couponRef = doc(db, "coupons", code);
        const couponSnap = await getDoc(couponRef);

        if (!couponSnap.exists() || !couponSnap.data().active) {
            return { success: false, message: "Cupom inválido ou expirado." };
        }

        currentCoupon = { id: couponSnap.id, ...couponSnap.data() };
        return { success: true, coupon: currentCoupon };
    } catch (error) {
        console.error("Erro ao aplicar cupom:", error);
        return { success: false, message: "Erro ao validar cupom." };
    }
}

// 2. Processamento do Pedido com Gerador de Número Sequencial + Comissão
export async function processCheckoutOrder(customerData, cartItems, subtotal) {
    try {
        // Aplica o desconto se houver cupom ativo
        let discount = 0;
        if (currentCoupon) {
            discount = currentCoupon.type === "percent" 
                ? (subtotal * currentCoupon.value) / 100 
                : currentCoupon.value;
        }
        const totalAmount = Math.max(0, subtotal - discount);

        // Executa em transação para garantir número sequencial sem conflito
        const orderId = await runTransaction(db, async (transaction) => {
            const counterRef = doc(db, "counters", "orders");
            const counterSnap = await transaction.get(counterRef);

            let nextNumber = 1000;
            if (counterSnap.exists()) {
                nextNumber = (counterSnap.data().current || 1000) + 1;
            }

            transaction.set(counterRef, { current: nextNumber }, { merge: true });
            return nextNumber.toString();
        });

        // Grava o Pedido na coleção 'orders'
        const orderData = {
            orderNumber: orderId,
            customer: customerData,
            items: cartItems,
            subtotal,
            discount,
            totalAmount,
            coupon: currentCoupon ? {
                code: currentCoupon.code,
                influencerId: currentCoupon.influencerId || null,
                commissionPercent: currentCoupon.commissionPercent || 0
            } : null,
            status: "Pendente",
            createdAt: serverTimestamp()
        };

        const orderRef = await addDoc(collection(db, "orders"), orderData);

        // Se houver comissão associada ao cupom, gera a comissão na coleção 'commissions'
        if (currentCoupon && Number(currentCoupon.commissionPercent) > 0) {
            const commissionValue = (totalAmount * Number(currentCoupon.commissionPercent)) / 100;

            await addDoc(collection(db, "commissions"), {
                orderId: orderRef.id,
                orderNumber: orderId,
                influencerId: currentCoupon.influencerId || null,
                affiliateName: currentCoupon.affiliateName || "Geral",
                code: currentCoupon.code,
                orderTotal: totalAmount,
                commissionPercent: Number(currentCoupon.commissionPercent),
                commissionValue: commissionValue,
                payoutStatus: "Pendente",
                createdAt: serverTimestamp()
            });
        }

        // Limpa o cupom atual
        currentCoupon = null;
        return { success: true, orderId: orderRef.id, orderNumber: orderId };

    } catch (error) {
        console.error("Erro no processamento do checkout:", error);
        return { success: false, message: error.message };
    }
}
}