import { auth, onAuthStateChanged, ADMIN_EMAILS, db } from "./firebase-config.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export function checkAccess(requiredRole) {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            // Se não estiver logado, redireciona para o login ou loja
            window.location.href = "login.html";
            return;
        }

        const userEmail = user.email.toLowerCase();

        // 1. Validação de Admin Geral
        if (requiredRole === "admin") {
            if (!ADMIN_EMAILS.includes(userEmail)) {
                alert("Acesso negado: Apenas o Administrador Geral pode acessar esta página.");
                window.location.href = "index.html"; // Redireciona para a loja
            }
            return;
        }

        // 2. Validação de Influencer
        if (requiredRole === "influencer") {
            // Verifica se o e-mail está cadastrado na coleção 'users' como influencer
            const q = query(collection(db, "users"), where("email", "==", userEmail), where("role", "==", "influencer"));
            const snap = await getDocs(q);

            if (snap.empty && !ADMIN_EMAILS.includes(userEmail)) {
                alert("Acesso restrito a Influencers cadastrados.");
                window.location.href = "index.html";
            }
            return;
        }
    });
}