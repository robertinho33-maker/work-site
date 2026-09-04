import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Configuração do Projeto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAAWrKX6Vu3DJRmmMrTreR1iwUw_ytUnXg",
  authDomain: "base-total.firebaseapp.com",
  projectId: "base-total",
  storageBucket: "base-total.firebasestorage.app",
  messagingSenderId: "1052334488431",
  appId: "1:1052334488431:web:c8d2071a18bdb6f82e469a",
  measurementId: "G-TWSEGNXFXJ"
};

// Inicialização das Instâncias
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Lista de Administradores Gerais Autorizados
export const ADMIN_EMAILS = [
    "robertinho33@gmail.com"
];

// Exportação dos Módulos para o Projeto
export { 
    db, 
    auth, 
    googleProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged 
};