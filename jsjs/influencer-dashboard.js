import { 
    db, 
    auth, 
    googleProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged 
} from "./firebase-config.js";

import { 
    collection, 
    getDocs, 
    query, 
    where 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const money = (val) => Number(val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");
const userInfo = document.getElementById("user-info");
const userEmail = document.getElementById("user-email");
const userPhoto = document.getElementById("user-photo");

const tableBody = document.getElementById("inf-commissions-table");
const elTotalSales = document.getElementById("inf-total-sales");
const elPendingComm = document.getElementById("inf-pending-comm");
const elPaidComm = document.getElementById("inf-paid-comm");

// Observador de Autenticação
onAuthStateChanged(auth, async (user) => {
    if (user) {
        if (btnLogin) btnLogin.classList.add("d-none");
        if (userInfo) userInfo.classList.replace("d-none", "d-flex");
        if (userEmail) userEmail.textContent = user.email || "";
        if (userPhoto) userPhoto.src = user.photoURL || "https://via.placeholder.com/32";

        await loadInfluencerData(user.email);
    } else {
        if (btnLogin) btnLogin.classList.remove("d-none");
        if (userInfo) userInfo.classList.replace("d-flex", "d-none");
        resetUI();
    }
});

btnLogin?.addEventListener("click", () => signInWithPopup(auth, googleProvider));
btnLogout?.addEventListener("click", () => signOut(auth).then(() => location.reload()));

function resetUI() {
    elTotalSales.textContent = "R$ 0,00";
    elPendingComm.textContent = "R$ 0,00";
    elPaidComm.textContent = "R$ 0,00";
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">Faça login para ver seu histórico.</td></tr>`;
}

async function loadInfluencerData(email) {
    if (!email || !tableBody) return;

    try {
        // Busca comissões atreladas ao e-mail do influencer
        const q = query(collection(db, "commissions"), where("email", "==", email.toLowerCase()));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">Nenhuma indicação registrada até o momento.</td></tr>`;
            return;
        }

        let totalPending = 0;
        let totalPaid = 0;
        let html = "";

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const val = Number(data.commissionValue || 0);
            const status = data.payoutStatus || "Pendente";
            const dateStr = data.createdAt ? new Date(data.createdAt).toLocaleDateString("pt-BR") : "-";

            if (status === "Pendente") totalPending += val;
            if (status === "Pago") totalPaid += val;

            let badgeClass = "bg-warning text-dark";
            if (status === "Pago") badgeClass = "bg-success";
            if (status === "Cancelado") badgeClass = "bg-danger";

            html += `
                <tr>
                    <td><small class="fw-bold">#${data.orderId || docSnap.id.substring(0, 6)}</small></td>
                    <td><span class="badge bg-light text-dark border">${data.couponCode || "N/A"}</span></td>
                    <td><small class="text-muted">${dateStr}</small></td>
                    <td class="fw-bold text-success">${money(val)}</td>
                    <td><span class="badge ${badgeClass}">${status}</span></td>
                </tr>
            `;
        });

        tableBody.innerHTML = html;
        elPendingComm.textContent = money(totalPending);
        elPaidComm.textContent = money(totalPaid);
        elTotalSales.textContent = money(totalPending + totalPaid);

    } catch (error) {
        console.error("Erro ao carregar dados do influencer:", error);
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">Erro ao carregar informações.</td></tr>`;
    }
}