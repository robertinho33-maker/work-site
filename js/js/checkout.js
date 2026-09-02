import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    doc, 
    getDoc, 
    addDoc, 
    collection, 
    runTransaction 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const money = (val) => Number(val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Estado do Carrinho e Usuário
let subtotal = 150.00;
let activeCouponData = null;
let currentUser = null;

const inputCoupon = document.getElementById("input-coupon");
const btnApplyCoupon = document.getElementById("btn-apply-coupon");
const couponFeedback = document.getElementById("coupon-feedback");

const elSubtotal = document.getElementById("cart-subtotal");
const elDiscount = document.getElementById("cart-discount");
const elDiscountPercent = document.getElementById("discount-percent");
const elRowDiscount = document.getElementById("row-discount");
const elTotal = document.getElementById("cart-total");
const btnFinishOrder = document.getElementById("btn-finish-order");

// 1. Escuta a sessão do Firebase Auth
onAuthStateChanged(auth, (user) => {
    const userInfo = document.getElementById("user-info");
    const userEmail = document.getElementById("user-email");
    const userPhoto = document.getElementById("user-photo");

    if (user) {
        currentUser = user;
        if (userInfo) userInfo.classList.replace("d-none", "d-flex");
        if (userEmail) userEmail.textContent = user.email;
        if (userPhoto) userPhoto.src = user.photoURL || "https://via.placeholder.com/32";
    } else {
        currentUser = null;
        if (userInfo) userInfo.classList.replace("d-flex", "d-none");
    }
});

// 2. Validar e Aplicar Cupom
btnApplyCoupon?.addEventListener("click", async () => {
    const code = inputCoupon.value.trim().toUpperCase();
    if (!code) return;

    try {
        const couponRef = doc(db, "coupons", code);
        const couponSnap = await getDoc(couponRef);

        if (!couponSnap.exists() || !couponSnap.data().active) {
            couponFeedback.className = "small mt-2 text-danger";
            couponFeedback.textContent = "Cupom inválido ou expirado.";
            resetCoupon();
            return;
        }

        activeCouponData = { code, ...couponSnap.data() };

        couponFeedback.className = "small mt-2 text-success fw-bold";
        couponFeedback.textContent = `Cupom ${code} aplicado com sucesso!`;

        updateTotals();

    } catch (error) {
        console.error("Erro ao validar cupom:", error);
        couponFeedback.className = "small mt-2 text-danger";
        couponFeedback.textContent = "Erro ao verificar cupom.";
    }
});

function resetCoupon() {
    activeCouponData = null;
    if (elRowDiscount) elRowDiscount.classList.add("d-none");
    updateTotals();
}

function updateTotals() {
    let discountVal = 0;

    if (activeCouponData) {
        const pct = Number(activeCouponData.discountPercentage || 0);
        discountVal = (subtotal * pct) / 100;

        if (elDiscountPercent) elDiscountPercent.textContent = pct;
        if (elDiscount) elDiscount.textContent = `- ${money(discountVal)}`;
        if (elRowDiscount) elRowDiscount.classList.remove("d-none");
    }

    const total = subtotal - discountVal;
    if (elSubtotal) elSubtotal.textContent = money(subtotal);
    if (elTotal) elTotal.textContent = money(total);
}

// 3. Incrementar número do pedido via Transaction
async function getNextOrderId() {
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

// 4. Finalizar Pedido e Gerar Comissão
btnFinishOrder?.addEventListener("click", async () => {
    btnFinishOrder.disabled = true;
    btnFinishOrder.textContent = "Processando...";

    const clientPhone = document.getElementById("client-phone")?.value?.trim() || "";
    const clientName = currentUser 
        ? (currentUser.displayName || currentUser.email) 
        : (document.getElementById("client-name")?.value?.trim() || "Cliente Anônimo");

    try {
        const orderId = await getNextOrderId();
        const discountAmount = activeCouponData ? (subtotal * Number(activeCouponData.discountPercentage || 0)) / 100 : 0;
        const finalTotal = subtotal - discountAmount;

        // Salva o Pedido
        await addDoc(collection(db, "orders"), {
            orderId: orderId,
            clientUid: currentUser ? currentUser.uid : null,
            clientEmail: currentUser ? currentUser.email : "Anônimo",
            clientName: clientName,
            clientPhone: clientPhone,
            subtotal: subtotal,
            discount: discountAmount,
            total: finalTotal,
            paymentStatus: "pendente",
            deliveryStatus: "aguardando_pagamento",
            couponUsed: activeCouponData ? activeCouponData.code : null,
            createdAt: new Date().toISOString()
        });

        // Se usou cupom e possui comissão, registra a comissão
        if (activeCouponData && Number(activeCouponData.commissionPercentage || 0) > 0) {
            const commissionVal = (finalTotal * Number(activeCouponData.commissionPercentage)) / 100;

            let influencerName = activeCouponData.influencerName || "Influencer";
            if (activeCouponData.influencerEmail) {
                const userDocId = activeCouponData.influencerEmail.replace(/[^a-zA-Z0-9]/g, "_");
                const userSnap = await getDoc(doc(db, "users", userDocId));
                if (userSnap.exists()) {
                    influencerName = userSnap.data().name || influencerName;
                }
            }

            await addDoc(collection(db, "commissions"), {
                orderId: orderId,
                couponCode: activeCouponData.code,
                email: activeCouponData.influencerEmail || "",
                influencerName: influencerName,
                commissionValue: commissionVal,
                payoutStatus: "Pendente",
                createdAt: new Date().toISOString()
            });
        }

        alert(`Pedido #${orderId} realizado com sucesso!`);
        window.location.reload();

    } catch (error) {
        console.error("Erro ao finalizar pedido:", error);
        alert("Falha ao processar o pedido: " + error.message);
        btnFinishOrder.disabled = false;
        btnFinishOrder.textContent = "Finalizar Pedido";
    }
});