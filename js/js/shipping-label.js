import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export async function printShippingLabel(orderDocId) {
    try {
        const orderSnap = await getDoc(doc(db, "orders", orderDocId));
        if (!orderSnap.exists()) return alert("Pedido não encontrado!");

        const order = orderSnap.data();

        // Dados do Remetente (Sua Empresa)
        const sender = {
            name: "Beleza Fácil / Shine Express",
            address: "Rua do Salão, 123 - Centro",
            city: "São Paulo - SP",
            zip: "01000-000"
        };

        const printWindow = window.open("", "_blank", "width=800,height=600");
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>Etiqueta de Envio - Pedido #${order.orderId}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; margin: 0; }
                    .label-box { border: 2px dashed #000; padding: 15px; max-width: 400px; margin: auto; }
                    .header { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
                    .title { font-size: 18px; font-weight: bold; text-transform: uppercase; }
                    .section { margin-bottom: 12px; font-size: 13px; line-height: 1.4; }
                    .section-title { font-weight: bold; text-decoration: underline; text-transform: uppercase; }
                    .barcode { text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px; margin-top: 15px; border-top: 1px solid #ccc; pt: 10px; }
                    @media print { button { display: none; } }
                </style>
            </head>
            <body>
                <div class="label-box">
                    <div class="header">
                        <span class="title">VOLUME 1/1</span>
                        <span style="float:right;"><b>PEDIDO:</b> #${order.orderId}</span>
                    </div>

                    <!-- Destinatário -->
                    <div class="section">
                        <div class="section-title">DESTINATÁRIO:</div>
                        <b>${order.clientName || 'Cliente'}</b><br>
                        ${order.address || 'Endereço não informado'}<br>
                        ${order.cityState || ''} | CEP: ${order.cep || '00000-000'}<br>
                        Tel: ${order.clientPhone || 'N/A'}
                    </div>

                    <hr>

                    <!-- Remetente -->
                    <div class="section">
                        <div class="section-title">REMETENTE:</div>
                        <b>${sender.name}</b><br>
                        ${sender.address}<br>
                        ${sender.city} | CEP: ${sender.zip}
                    </div>

                    <div class="barcode">
                        *${order.orderId}*
                    </div>
                </div>

                <div style="text-align:center; margin-top: 20px;">
                    <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">
                        Imprimir Etiqueta
                    </button>
                </div>
            </body>
            </html>
        `);

        printWindow.document.close();

    } catch (error) {
        console.error("Erro ao gerar etiqueta:", error);
        alert("Falha ao gerar etiqueta para impressão.");
    }
}