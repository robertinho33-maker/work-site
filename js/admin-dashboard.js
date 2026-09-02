import { db, auth, onAuthStateChanged } from "./firebase-config.js";
import { setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, doc, setDoc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { printShippingLabel } from "./shipping-label.js";
import { notifyInfluencerPayment, notifyClientTracking } from "./whatsapp.js";
import { checkAdminPermissions, handleLogin, handleLogout } from "./auth-service.js";

// Configura persistência da sessão
setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.error("Erro ao configurar persistência de login:", err);
});

// Referências de UI
const elements = {
    btnLogin: document.getElementById("btn-login"),
    btnLogout: document.getElementById("btn-logout"),
    userInfo: document.getElementById("user-info"),
    userEmail: document.getElementById("user-email"),
    userPhoto: document.getElementById("user-photo"),
    commTableBody: document.getElementById("commissions-table-body"),
    filterCommStatus: document.getElementById("filter-comm-status"),
    ordersTableBody: document.getElementById("orders-table-body"),
    dashTotalOrders: document.getElementById("dash-total-orders"),
    dashTotalCommissions: document.getElementById("dash-total-commissions"),
    dashActiveCoupons: document.getElementById("dash-active-coupons"),
    btnInitCounters: document.getElementById("btn-init-counters")
};

const money = (val) => Number(val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Observador do Estado de Autenticação
onAuthStateChanged(auth, async (user) => {
    if (user) {
        if (elements.btnLogin) elements.btnLogin.classList.add("d-none");
        if (elements.userInfo) elements.userInfo.classList.replace("d-none", "d-flex");
        if (elements.userEmail) elements.userEmail.textContent = user.email || "";
        if (elements.userPhoto) elements.userPhoto.src = user.photoURL || "https://via.placeholder.com/32";

        const hasAdmin = await checkAdminPermissions(user);
        if (hasAdmin) {
            await loadDashboardMetrics();
            await loadCommissions(elements.filterCommStatus?.value || "Pendente");
            await loadOrders();
        } else {
            alert(`Acesso negado: A conta ${user.email} não possui privilégios de Administrador.`);
            resetDashboardUI();
        }
    } else {
        if (elements.btnLogin) elements.btnLogin.classList.remove("d-none");
        if (elements.userInfo) elements.userInfo.classList.replace("d-flex", "d-none");
        resetDashboardUI();
    }
});

function resetDashboardUI() {
    if (elements.dashTotalOrders) elements.dashTotalOrders.textContent = "0";
    if (elements.dashTotalCommissions) elements.dashTotalCommissions.textContent = "R$ 0,00";
    if (elements.dashActiveCoupons) elements.dashActiveCoupons.textContent = "0";
    if (elements.commTableBody) elements.commTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Faça login como admin.</td></tr>`;
    if (elements.ordersTableBody) elements.ordersTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Faça login como admin.</td></tr>`;
}

// Métricas Gerais
async function loadDashboardMetrics() {
    try {
        const ordersSnap = await getDocs(collection(db, "orders"));
        if (elements.dashTotalOrders) elements.dashTotalOrders.textContent = ordersSnap.size;

        const couponsSnap = await getDocs(query(collection(db, "coupons"), where("active", "==", true)));
        if (elements.dashActiveCoupons) elements.dashActiveCoupons.textContent = couponsSnap.size;

        const commSnap = await getDocs(query(collection(db, "commissions"), where("payoutStatus", "==", "Pendente")));
        let totalCommissions = 0;
        commSnap.forEach(d => totalCommissions += Number(d.data().commissionValue || 0));

        if (elements.dashTotalCommissions) elements.dashTotalCommissions.textContent = money(totalCommissions);
    } catch (error) {
        console.error("Erro ao carregar métricas do dashboard:", error);
    }
}

// Gestão de Comissões
export async function loadCommissions(statusFilter = "Pendente") {
    if (!elements.commTableBody) return;

    elements.commTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Carregando comissões...</td></tr>`;

    try {
        const commRef = collection(db, "commissions");
        const commQuery = statusFilter === "TODOS" ? query(commRef) : query(commRef, where("payoutStatus", "==", statusFilter));
        const querySnapshot = await getDocs(commQuery);

        if (querySnapshot.empty) {
            elements.commTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Nenhuma comissão encontrada com o status "${statusFilter}".</td></tr>`;
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
                            ${currentStatus !== "Pago" ? `<button class="btn btn-outline-success btn-update-status" data-id="${id}" data-status="Pago">Pagar</button>` : ''}
                            ${currentStatus !== "Pendente" ? `<button class="btn btn-outline-warning btn-update-status" data-id="${id}" data-status="Pendente">Pendente</button>` : ''}
                            ${currentStatus !== "Cancelado" ? `<button class="btn btn-outline-danger btn-update-status" data-id="${id}" data-status="Cancelado">Cancelar</button>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        });

        elements.commTableBody.innerHTML = html;
    } catch (error) {
        console.error("Erro ao carregar comissões:", error);
        elements.commTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">Erro ao carregar dados de comissões.</td></tr>`;
    }
}

async function updatePayoutStatus(commissionId, newStatus) {
    if (!auth.currentUser || !confirm(`Deseja alterar o status para "${newStatus}"?`)) return;

    try {
        await updateDoc(doc(db, "commissions", commissionId), {
            payoutStatus: newStatus,
            updatedAt: new Date().toISOString(),
            updatedBy: auth.currentUser.email
        });

        alert(`Status atualizado para "${newStatus}"!`);
        await loadCommissions(elements.filterCommStatus?.value || "Pendente");
        await loadDashboardMetrics();
    } catch (error) {
        console.error("Erro ao atualizar status:", error);
        alert("Falha ao atualizar o status da comissão.");
    }
}

// Gestão de Pedidos
export async function loadOrders() {
    if (!elements.ordersTableBody) return;

    elements.ordersTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Carregando pedidos...</td></tr>`;

    try {
        const querySnapshot = await getDocs(collection(db, "orders"));

        if (querySnapshot.empty) {
            elements.ordersTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Nenhum pedido cadastrado.</td></tr>`;
            return;
        }

        elements.ordersTableBody.innerHTML = querySnapshot.docs.map(docSnap => {
            const order = docSnap.data();
            const id = docSnap.id;
            const isPaid = order.paymentStatus === "pago";
            const waTrackingLink = notifyClientTracking(
                order.clientPhone || "", 
                order.clientName || "Cliente", 
                order.orderId, 
                order.trackingCode || "EM_BREVE"
            );

            return `
                <tr>
                    <td><small class="fw-bold">#${order.orderId || id.substring(0, 6)}</small></td>
                    <td>${order.clientName || "Cliente"}</td>
                    <td class="fw-bold">${money(order.total)}</td>
                    <td><span class="badge ${isPaid ? 'bg-success' : 'bg-warning text-dark'}">${isPaid ? 'Pagamento Confirmado' : 'Aguardando Pagamento'}</span></td>
                    <td><span class="badge ${isPaid ? 'bg-info text-dark' : 'bg-secondary'}">${order.deliveryStatus === 'liberado_para_envio' ? 'Liberado p/ Envio' : (order.deliveryStatus || 'Bloqueado')}</span></td>
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
                                <i class="bi bi-truck"></i> Despachar
                            </a>
                        `}
                    </td>
                </tr>
            `;
        }).join("");
    } catch (error) {
        console.error("Erro ao carregar pedidos:", error);
        elements.ordersTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">Erro ao carregar lista de pedidos.</td></tr>`;
    }
}

// Delegador Único de Eventos de Clique
document.addEventListener("click", async (e) => {
    // Autenticação
    if (e.target.closest("#btn-login")) {
        e.preventDefault();
        await handleLogin();
        return;
    }

    if (e.target.closest("#btn-logout")) {
        e.preventDefault();
        await handleLogout();
        return;
    }

    // Ações na Tabela de Comissões
    const btnStatus = e.target.closest(".btn-update-status");
    if (btnStatus) {
        const id = btnStatus.getAttribute("data-id");
        const newStatus = btnStatus.getAttribute("data-status");
        await updatePayoutStatus(id, newStatus);
        return;
    }

    // Ações na Tabela de Pedidos
    const btnPrint = e.target.closest(".btn-print-label");
    if (btnPrint) {
        printShippingLabel(btnPrint.getAttribute("data-id"));
        return;
    }

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
                alert("Pagamento confirmado!");
                await loadOrders();
                await loadDashboardMetrics();
            } catch (error) {
                console.error("Erro ao confirmar pagamento:", error);
                alert("Erro ao atualizar o pagamento do pedido.");
            }
        }
    }
});

// Outros Event Listeners Fixo
elements.filterCommStatus?.addEventListener("change", () => loadCommissions(elements.filterCommStatus.value));

elements.btnInitCounters?.addEventListener("click", async () => {
    if (!auth.currentUser || !(await checkAdminPermissions(auth.currentUser))) {
        return alert("Permissão negada. É necessário privilégio de administrador.");
    }
    try {
        await setDoc(doc(db, "counters", "orders"), { current: 1000 }, { merge: true });
        alert("Coleção 'counters' inicializada com sucesso!");
    } catch (error) {
        console.error("Erro ao inicializar contador:", error);
    }
});