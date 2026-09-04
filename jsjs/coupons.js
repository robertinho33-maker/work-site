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
    collection, 
    getDocs, 
    doc, 
    getDoc,
    setDoc, 
    updateDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");
const userInfo = document.getElementById("user-info");
const userEmail = document.getElementById("user-email");
const userPhoto = document.getElementById("user-photo");

const formCoupon = document.getElementById("form-coupon");
const couponsTableBody = document.getElementById("coupons-table-body");

async function checkAdminPermissions(user) {
    if (!user) return false;
    if (ADMIN_EMAILS && ADMIN_EMAILS.map(e => e.toLowerCase()).includes(user.email.toLowerCase())) {
        return true;
    }
    try {
        const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);
        return userSnap.exists() && userSnap.data().role === "admin";
    } catch (err) {
        console.error("Erro ao verificar admin:", err);
        return false;
    }
}

// Observador de Autenticação
onAuthStateChanged(auth, async (user) => {
    if (user) {
        if (btnLogin) btnLogin.classList.add("d-none");
        if (userInfo) userInfo.classList.replace("d-none", "d-flex");
        if (userEmail) userEmail.textContent = user.email || "";
        if (userPhoto) userPhoto.src = user.photoURL || "https://via.placeholder.com/32";

        const hasAdminAccess = await checkAdminPermissions(user);
        if (hasAdminAccess) {
            await loadCoupons();
        } else {
            alert("Acesso restrito a administradores.");
            window.location.href = "admin.html";
        }
    } else {
        if (btnLogin) btnLogin.classList.remove("d-none");
        if (userInfo) userInfo.classList.replace("d-flex", "d-none");
        couponsTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Faça login para visualizar.</td></tr>`;
    }
});

// Ações de Autenticação
btnLogin?.addEventListener("click", () => signInWithPopup(auth, googleProvider));
btnLogout?.addEventListener("click", () => signOut(auth).then(() => location.reload()));

// Listar Cupons do Firestore
async function loadCoupons() {
    if (!couponsTableBody) return;

    try {
        const querySnapshot = await getDocs(collection(db, "coupons"));
        
        if (querySnapshot.empty) {
            couponsTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Nenhum cupom cadastrado.</td></tr>`;
            return;
        }

        let html = "";
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const code = docSnap.id;
            const active = data.active ?? true;

            html += `
                <tr>
                    <td class="fw-bold text-uppercase">${code}</td>
                    <td>${data.discountPercentage || 0}%</td>
                    <td>${data.commissionPercentage || 0}%</td>
                    <td><small class="text-muted">${data.influencerEmail || "N/A"}</small></td>
                    <td>
                        <span class="badge ${active ? 'bg-success' : 'bg-secondary'}">
                            ${active ? 'Ativo' : 'Inativo'}
                        </span>
                    </td>
                    <td class="text-end">
                        <button class="btn btn-sm ${active ? 'btn-outline-danger' : 'btn-outline-success'} btn-toggle-coupon" 
                            data-code="${code}" data-active="${active}">
                            ${active ? 'Desativar' : 'Ativar'}
                        </button>
                    </td>
                </tr>
            `;
        });

        couponsTableBody.innerHTML = html;

        // Listener para ativar/desativar
        document.querySelectorAll(".btn-toggle-coupon").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const code = e.currentTarget.getAttribute("data-code");
                const currentActive = e.currentTarget.getAttribute("data-active") === "true";
                await toggleCouponStatus(code, !currentActive);
            });
        });

    } catch (error) {
        console.error("Erro ao carregar cupons:", error);
    }
}

// Salvar Novo Cupom (Coleção /coupons/{couponCode})
formCoupon?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const code = document.getElementById("coupon-code").value.trim().toUpperCase();
    const discount = Number(document.getElementById("coupon-discount").value);
    const commission = Number(document.getElementById("coupon-commission").value);
    const influencerEmail = document.getElementById("coupon-influencer").value.trim().toLowerCase();

    if (!code) return;

    try {
        await setDoc(doc(db, "coupons", code), {
            discountPercentage: discount,
            commissionPercentage: commission,
            influencerEmail: influencerEmail,
            active: true,
            createdAt: new Date().toISOString()
        });

        alert(`Cupom "${code}" salvo com sucesso!`);
        formCoupon.reset();
        await loadCoupons();

    } catch (error) {
        console.error("Erro ao salvar cupom:", error);
        alert("Erro ao salvar o cupom no banco de dados.");
    }
});

// Ativar ou Desativar Cupom
async function toggleCouponStatus(code, newStatus) {
    try {
        await updateDoc(doc(db, "coupons", code), { active: newStatus });
        await loadCoupons();
    } catch (error) {
        console.error("Erro ao alterar status do cupom:", error);
    }
}