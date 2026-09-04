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
    query, 
    where 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");
const userInfo = document.getElementById("user-info");
const userEmail = document.getElementById("user-email");
const userPhoto = document.getElementById("user-photo");

const formInfluencer = document.getElementById("form-influencer");
const tableBody = document.getElementById("influencers-table-body");

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
            await loadInfluencers();
        } else {
            alert("Acesso restrito a administradores.");
            window.location.href = "admin.html";
        }
    } else {
        if (btnLogin) btnLogin.classList.remove("d-none");
        if (userInfo) userInfo.classList.replace("d-flex", "d-none");
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">Faça login para visualizar.</td></tr>`;
    }
});

// Ações de Autenticação
btnLogin?.addEventListener("click", () => signInWithPopup(auth, googleProvider));
btnLogout?.addEventListener("click", () => signOut(auth).then(() => location.reload()));

// Carregar Lista de Influencers (Filtra role == 'influencer')
async function loadInfluencers() {
    if (!tableBody) return;

    try {
        const q = query(collection(db, "users"), where("role", "==", "influencer"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">Nenhum influencer cadastrado.</td></tr>`;
            return;
        }

        let html = "";
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();

            html += `
                <tr>
                    <td class="fw-semibold">${data.name || "Sem Nome"}</td>
                    <td><small class="text-muted">${data.email || "N/A"}</small></td>
                    <td>${data.phone || "-"}</td>
                    <td><span class="badge bg-light text-dark border">${data.pixKey || "Não informada"}</span></td>
                    <td class="text-end">
                        <a href="https://wa.me/55${(data.phone || '').replace(/\D/g, '')}" 
                           target="_blank" 
                           class="btn btn-sm btn-outline-success ${!data.phone ? 'disabled' : ''}">
                            <i class="bi bi-whatsapp"></i>
                        </a>
                    </td>
                </tr>
            `;
        });

        tableBody.innerHTML = html;

    } catch (error) {
        console.error("Erro ao carregar influencers:", error);
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">Erro ao carregar os dados.</td></tr>`;
    }
}

// Cadastrar/Atualizar Influencer no Firestore
formInfluencer?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("influencer-name").value.trim();
    const email = document.getElementById("influencer-email").value.trim().toLowerCase();
    const phone = document.getElementById("influencer-phone").value.trim();
    const pixKey = document.getElementById("influencer-pix").value.trim();

    // Usa o e-mail codificado/normalizado como ID do documento na coleção 'users'
    const docId = email.replace(/[^a-zA-Z0-9]/g, "_");

    try {
        await setDoc(doc(db, "users", docId), {
            name: name,
            email: email,
            phone: phone,
            pixKey: pixKey,
            role: "influencer",
            updatedAt: new Date().toISOString()
        }, { merge: true });

        alert(`Influencer "${name}" cadastrado com sucesso!`);
        formInfluencer.reset();
        await loadInfluencers();

    } catch (error) {
        console.error("Erro ao salvar influencer:", error);
        alert("Erro ao cadastrar influencer no Firestore.");
    }
});