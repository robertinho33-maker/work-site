// Utilitário para formatar e enviar mensagens via WhatsApp

const formatCurrency = (val) => Number(val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function generateWhatsAppLink(phone, message) {
    const cleanPhone = phone.replace(/\D/g, "");
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/55${cleanPhone}?text=${encodedMessage}`;
}

export function notifyInfluencerNewSale(phone, influencerName, orderId, commissionValue) {
    const text = `Olá ${influencerName}! 🎉\n\n` +
                 `Nova venda realizada com o seu cupom!\n` +
                 `• Pedido: #${orderId}\n` +
                 `• Sua Comissão: ${formatCurrency(commissionValue)}\n\n` +
                 `Acompanhe o saldo atualizado no seu painel!`;

    return generateWhatsAppLink(phone, text);
}

export function notifyInfluencerPayment(phone, influencerName, amountPaid, pixKey) {
    const text = `Olá ${influencerName}! 💰\n\n` +
                 `Seu pagamento de comissão foi realizado com sucesso!\n` +
                 `• Valor Transferido: ${formatCurrency(amountPaid)}\n` +
                 `• Chave PIX: ${pixKey}\n\n` +
                 `Obrigado pela parceria! ✂️✨`;

    return generateWhatsAppLink(phone, text);
}

import { generateWhatsAppLink } from "./whatsapp.js"; // Aproveita a função base existente

const formatCurrency = (val) => Number(val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// 1. Notificação de Novo Pedido (Confirmação)
export function notifyClientNewOrder(phone, clientName, orderId, totalValue) {
    const text = `Olá, ${clientName}! ✨\n\n` +
                 `Recebemos o seu pedido com sucesso no *Beleza Fácil*!\n\n` +
                 `• *Pedido:* #${orderId}\n` +
                 `• *Valor Total:* ${formatCurrency(totalValue)}\n\n` +
                 `Já estamos preparando tudo para envio. Qualquer dúvida, estamos à disposição! ✂️💄`;

    return generateWhatsAppLink(phone, text);
}

// 2. Notificação de Código de Rastreio / Envio
export function notifyClientTracking(phone, clientName, orderId, trackingCode) {
    const text = `Notícia boa, ${clientName}! 🚚💨\n\n` +
                 `O seu pedido *#${orderId}* já foi despachado!\n\n` +
                 `• *Código de Rastreio:* ${trackingCode}\n` +
                 `• *Acompanhamento:* https://rastreamento.correios.com.br/app/index.php?codigo=${trackingCode}\n\n` +
                 `Logo mais seus produtos *Shine Express* chegam aí!`;

    return generateWhatsAppLink(phone, text);
}