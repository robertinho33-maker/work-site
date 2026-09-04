import { 
    auth, 
    db, 
    ADMIN_EMAILS, 
    googleProvider, 
    signInWithPopup, 
    signOut 
} from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * Valida se o usuário autenticado possui perfil de Administrador/Master.
 */
export async function checkAdminPermissions(user) {
    if (!user?.email) return false;
    
    const emailNormalized = user.email.toLowerCase().trim();

    // 1. Verificação na lista estática
    if (Array.isArray(ADMIN_EMAILS) && ADMIN_EMAILS.map(e => e.toLowerCase().trim()).includes(emailNormalized)) {
        return true;
    }

    // 2. Verificação no Firestore (UID ou id customizado por E-mail)
    try {
        let userDocRef = doc(db, "users", user.uid);
        let userSnap = await getDoc(userDocRef);

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

/**
 * Executa o fluxo de login via Google.
 */
export async function handleLogin() {
    try {
        return await signInWithPopup(auth, googleProvider);
    } catch (error) {
        console.error("Erro no login com Google:", error);
        alert(`Falha ao autenticar: ${error.message}`);
        throw error;
    }
}

/**
 * Realiza o encerramento da sessão e recarrega a página.
 */
export async function handleLogout() {
    try {
        await signOut(auth);
        window.location.reload();
    } catch (error) {
        console.error("Erro no logout:", error);
    }
}