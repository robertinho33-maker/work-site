import { 
    db, 
    auth, 
    googleProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged,
    ADMIN_EMAILS
} from "./firebase-config.js";

import { 
    setPersistence, 
    browserLocalPersistence 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"; // Importado do Auth!

import { 
    collection, 
    getDocs, 
    doc, 
    getDoc,
    setDoc, 
    updateDoc,
    query, 
    where 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { printShippingLabel } from "./shipping-label.js";
import { notifyInfluencerPayment, notifyClientTracking } from "./whatsapp.js";

// Configura persistência do login
setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.error("Erro ao configurar persistência de login:", err);
});
// ==========================================
// 1. HELPERS E ELEMENTOS DA INTERFACE
// ==========================================
const money = (val) => Number(val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Autenticação / Header
const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");
const userInfo = document.getElementById("user-info");
const userEmail = document.getElementById("user-email");
const userPhoto = document.getElementById("user-photo");

// Módulo de Comissões
const commTableBody = document.getElementById("commissions-table-body");
const filterCommStatus = document.getElementById("filter-comm-status");

// Módulo de Pedidos
const ordersTableBody = document.getElementById("orders-table-body");

// ==========================================
// 2. CONTROLE DE AUTENTICAÇÃO E PERMISSÕES
// ==========================================
async function checkAdminPermissions(user) {
    if (!user || !user.email) return false;
    
    const emailNormalized = user.email.toLowerCase().trim();

    // 1. Checagem por e-mail na lista estática
    if (Array.isArray(ADMIN_EMAILS) && ADMIN_EMAILS.map(e => e.toLowerCase().trim()).includes(emailNormalized)) {
        return true;
    }

    // 2. Checagem no Firestore (UID ou E-mail Sanitizado)
    try {
        // Tentativa A: Pelo UID
        let userDocRef = doc(db, "users", user.uid);
        let userSnap = await getDoc(userDocRef);

        // Tentativa B: Pelo E-mail Sanitizado se não achar pelo UID
        if (!userSnap.exists()) {
            const emailDocId = emailNormalized.replace(/[^a-zA-Z0-9]/g, "_");
            userDocRef = doc(db, "users", emailDocId);
            userSnap = await getDoc(userDocRef);
        }

        if (userSnap.exists()) {
            const role = (userSnap.data().role || "").toLowerCase().trim();
            return role === "admin" || role === "master";
        }
    } catch (err) {
        console.error("Erro ao verificar permissão no Firestore:", err);
    }

    return false;
}

// Observador de Estado de Autenticação
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const email = user.email || "";

        if (btnLogin) btnLogin.classList.add("d-none");
        if (userInfo) userInfo.classList.replace("d-none", "d-flex");
        if (userEmail) userEmail.textContent = email;
        if (userPhoto) userPhoto.src = user.photoURL || "https://via.placeholder.com/32";

        const hasAdminAccess = await checkAdminPermissions(user);

        if (hasAdminAccess) {
            await loadDashboardMetrics();
            await loadCommissions(filterCommStatus?.value || "Pendente");
            await loadOrders();
        } else {
            alert(`Acesso negado: A conta ${email} não possui privilégios de Administrador.`);
            resetDashboardUI();
        }
    } else {
        if (btnLogin) btnLogin.classList.remove("d-none");
        if (userInfo) userInfo.classList.replace("d-flex", "d-none");
        resetDashboardUI();
    }
});

// Reset visual da UI do Dashboard
function resetDashboardUI() {
    const totalOrders = document.getElementById("dash-total-orders");
    const totalCommissions = document.getElementById("dash-total-commissions");
    const activeCoupons = document.getElementById("dash-active-coupons");

    if (totalOrders) totalOrders.textContent = "0";
    if (totalCommissions) totalCommissions.textContent = "R$ 0,00";
    if (activeCoupons) activeCoupons.textContent = "0";
    if (commTableBody) commTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Faça login como admin.</td></tr>`;
    if (ordersTableBody) ordersTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Faça login como admin.</td></tr>`;
}

// Botões de Login e Logout
btnLogin?.addEventListener("click", async () => {
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        console.error("Erro no login:", error);
        alert("Falha ao autenticar.");
    }
});

btnLogout?.addEventListener("click", async () => {
    try {
        await signOut(auth);
        location.reload();
    } catch (error) {
        console.error("Erro no logout:", error);
    }
});

// ==========================================
// 3. MÉTRICAS E CONTADORES
// ==========================================
async function loadDashboardMetrics() {
    try {
        const ordersSnap = await getDocs(collection(db, "orders"));
        const totalOrdersEl = document.getElementById("dash-total-orders");
        if (totalOrdersEl) totalOrdersEl.textContent = ordersSnap.size;

        const couponsQuery = query(collection(db, "coupons"), where("active", "==", true));
        const couponsSnap = await getDocs(couponsQuery);
        const activeCouponsEl = document.getElementById("dash-active-coupons");
        if (activeCouponsEl) activeCouponsEl.textContent = couponsSnap.size;

        const commQuery = query(collection(db, "commissions"), where("payoutStatus", "==", "Pendente"));
        const commSnap = await getDocs(commQuery);
        let totalCommissions = 0;
        
        commSnap.forEach(docSnap => {
            totalCommissions += Number(docSnap.data().commissionValue || 0);
        });

        const totalCommissionsEl = document.getElementById("dash-total-commissions");
        if (totalCommissionsEl) totalCommissionsEl.textContent = money(totalCommissions);

    } catch (error) {
        console.error("Erro ao carregar métricas do dashboard:", error);
    }
}

// Inicializador de contadores de pedidos
async function initCounters() {
    if (!auth.currentUser) {
        alert("Você precisa estar logado para realizar esta operação.");
        return;
    }

    const isAllowed = await checkAdminPermissions(auth.currentUser);
    if (!isAllowed) {
        alert("Apenas administradores podem inicializar contadores.");
        return;
    }

    try {
        await setDoc(doc(db, "counters", "orders"), { current: 1000 }, { merge: true });
        alert("Coleção 'counters' inicializada com sucesso!");
    } catch (error) {
        console.error("Erro ao inicializar contador:", error);
        alert("Erro ao criar documento na coleção counters.");
    }
}

document.getElementById("btn-init-counters")?.addEventListener("click", initCounters);

// ==========================================
// 4. MÓDULO DE GESTÃO DE COMISSÕES
// ==========================================
filterCommStatus?.addEventListener("change", () => {
    loadCommissions(filterCommStatus.value);
});

export async function loadCommissions(statusFilter = "Pendente") {
    if (!commTableBody) return;

    try {
        commTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4 text-muted">
                    <span class="spinner-border spinner-border-sm me-2"></span>Carregando comissões...
                </td>
            </tr>`;

        let commQuery;
        const commRef = collection(db, "commissions");

        if (statusFilter === "TODOS") {
            commQuery = query(commRef);
        } else {
            commQuery = query(commRef, where("payoutStatus", "==", statusFilter));
        }

        const querySnapshot = await getDocs(commQuery);

        if (querySnapshot.empty) {
            commTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4 text-muted">
                        Nenhuma comissão encontrada com o status "${statusFilter}".
                    </td>
                </tr>`;
            return;
        }

        let html = "";
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            const currentStatus = data.payoutStatus || "Pendente";

            let badgeClass = "bg-warning text-dark";
            if (currentStatus === "Pago") badgeClass = "bg-success";
            if (currentStatus === "Cancelado") badgeClass = "bg-danger";

            const waLink = notifyInfluencerPayment(
                data.influencerPhone || "", 
                data.influencerName || "Parceiro", 
                data.commissionValue, 
                data.pixKey || "N/A"
            );

            html += `
                <tr>
                    <td>
                        <div class="fw-semibold">${data.influencerName || "Influencer"}</div>
                        <div class="small text-muted">${data.email || "Sem e-mail"}</div>
                    </td>
                    <td><span class="badge bg-light text-dark border">${data.couponCode || "N/A"}</span></td>
                    <td><small class="text-muted">#${data.orderId || id.substring(0, 6)}</small></td>
                    <td class="fw-bold text-success">${money(data.commissionValue)}</td>
                    <td><span class="badge ${badgeClass}">${currentStatus}</span></td>
                    <td class="text-end">
                        <a href="${waLink}" target="_blank" class="btn btn-sm btn-outline-success me-1 ${!data.influencerPhone ? 'disabled' : ''}" title="Notificar PIX no WhatsApp">
                            <i class="bi bi-whatsapp"></i>
                        </a>
                        <div class="btn-group btn-group-sm">
                            ${currentStatus !== "Pago" ? `
                                <button class="btn btn-outline-success btn-update-status" 
                                    data-id="${id}" data-status="Pago" title="Marcar como Pago">
                                    Pagar
                                </button>
                            ` : ''}
                            ${currentStatus !== "Pendente" ? `
                                <button class="btn btn-outline-warning btn-update-status" 
                                    data-id="${id}" data-status="Pendente" title="Marcar como Pendente">
                                    Pendente
                                </button>
                            ` : ''}
                            ${currentStatus !== "Cancelado" ? `
                                <button class="btn btn-outline-danger btn-update-status" 
                                    data-id="${id}" data-status="Cancelado" title="Cancelar Comissão">
                                    Cancelar
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        });

        commTableBody.innerHTML = html;

       // Substitua o listener do btnLogin por este bloco seguro:
document.addEventListener("click", async (e) => {
    const targetBtn = e.target.closest("#btn-login");
    
    if (targetBtn) {
        e.preventDefault();
        try {
            console.log("Iniciando autenticação Google...");
            const result = await signInWithPopup(auth, googleProvider);
            console.log("Usuário autenticado:", result.user.email);
        } catch (error) {
            console.error("Erro no login com Google:", error);
            alert(`Falha ao autenticar: ${error.message}`);
        }
    }
});

    } catch (error) {
        console.error("Erro ao carregar comissões:", error);
        commTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4 text-danger">
                    Erro ao carregar os dados de comissões.
                </td>
            </tr>`;
    }
}

async function updatePayoutStatus(commissionId, newStatus) {
    if (!auth.currentUser) return;

    if (!confirm(`Deseja realmente alterar o status para "${newStatus}"?`)) return;

    try {
        const commRef = doc(db, "commissions", commissionId);
        
        await updateDoc(commRef, {
            payoutStatus: newStatus,
            updatedAt: new Date().toISOString(),
            updatedBy: auth.currentUser.email
        });

        alert(`Status atualizado para "${newStatus}" com sucesso!`);
        
        await loadCommissions(filterCommStatus?.value || "Pendente");
        await loadDashboardMetrics();

    } catch (error) {
        console.error("Erro ao atualizar payoutStatus:", error);
        alert("Falha ao atualizar o status da comissão.");
    }
}

// ==========================================
// 5. MÓDULO DE GESTÃO E ENTREGA DE PEDIDOS
// ==========================================
export async function loadOrders() {
    if (!ordersTableBody) return;

    try {
        ordersTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4 text-muted">
                    <span class="spinner-border spinner-border-sm me-2"></span>Carregando pedidos...
                </td>
            </tr>`;

        const querySnapshot = await getDocs(collection(db, "orders"));

        if (querySnapshot.empty) {
            ordersTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4 text-muted">
                        Nenhum pedido cadastrado no momento.
                    </td>
                </tr>`;
            return;
        }

        let html = "";
        querySnapshot.forEach((orderSnap) => {
            html += renderOrderRow(orderSnap);
        });

        ordersTableBody.innerHTML = html;

    } catch (error) {
        console.error("Erro ao carregar pedidos:", error);
        ordersTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4 text-danger">
                    Erro ao carregar lista de pedidos.
                </td>
            </tr>`;
    }
}

function renderOrderRow(orderSnap) {
    const order = orderSnap.data();
    const id = orderSnap.id;
    const isPaid = order.paymentStatus === "pago";

    const waTrackingLink = notifyClientTracking(
        order.clientPhone || "", 
        order.clientName || "Cliente", 
        order.orderId, 
        order.trackingCode || "EM_BREVE"
    );

    return `
        <tr>
            <td><small class="fw-bold">#${order.orderId || id.substring(0,6)}</small></td>
            <td>${order.clientName || "Cliente"}</td>
            <td class="fw-bold">${money(order.total)}</td>
            <td>
                <span class="badge ${isPaid ? 'bg-success' : 'bg-warning text-dark'}">
                    ${isPaid ? 'Pagamento Confirmado' : 'Aguardando Pagamento'}
                </span>
            </td>
            <td>
                <span class="badge ${isPaid ? 'bg-info text-dark' : 'bg-secondary'}">
                    ${order.deliveryStatus === 'liberado_para_envio' ? 'Liberado p/ Envio' : (order.deliveryStatus || 'Bloqueado')}
                </span>
            </td>
            <td class="text-end">
                ${!isPaid ? `
                    <button class="btn btn-sm btn-outline-success btn-confirm-payment" data-id="${id}">
                        <i class="bi bi-currency-dollar"></i> Confirmar Pagamento
                    </button>
                ` : `
                    <button class="btn btn-sm btn-outline-primary btn-print-label me-1" data-id="${id}">
                        <i class="bi bi-printer"></i> Etiqueta
                    </button>
                    <a href="${waTrackingLink}" target="_blank" class="btn btn-sm btn-success ${!order.clientPhone ? 'disabled' : ''}">
                        <i class="bi bi-truck"></i> Despachar & Rastreio
                    </a>
                `}
            </td>
        </tr>
    `;
}

// Event Listeners globais para ações da tabela de Pedidos
document.addEventListener("click", async (e) => {
    // 1. Botão de Gerar Etiqueta
    const btnPrint = e.target.closest(".btn-print-label");
    if (btnPrint) {
        const orderId = btnPrint.getAttribute("data-id");
        printShippingLabel(orderId);
        return;
    }

    // 2. Botão de Confirmar Pagamento
    const btnConfirm = e.target.closest(".btn-confirm-payment");
    if (btnConfirm) {
        const orderDocId = btnConfirm.getAttribute("data-id");
        
        if (confirm("Confirmar o recebimento do pagamento deste pedido?")) {
            try {
                await updateDoc(doc(db, "orders", orderDocId), {
                    paymentStatus: "pago",
                    deliveryStatus: "liberado_para_envio",
                    paidAt: new Date().toISOString()
                });
                alert("Pagamento confirmado! Pedido liberado para entrega.");
                await loadOrders();
                await loadDashboardMetrics();
            } catch (error) {
                console.error("Erro ao confirmar pagamento:", error);
                alert("Erro ao atualizar o pagamento do pedido.");
            }
        }
    }
});