'use strict';


async function loadInclude(
    elementId,
    filePath
) {

    const element =
        document.getElementById(
            elementId
        );


    if (!element) {

        console.error(
            `Elemento #${elementId} não encontrado.`
        );

        return;

    }


    try {

        const response =
            await fetch(
                filePath,
                {
                    cache: 'no-cache'
                }
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        element.innerHTML =
            await response.text();


        console.log(
            `✓ Include carregado: ${filePath}`
        );


    } catch (error) {

        console.error(
            `Erro ao carregar ${filePath}:`,
            error
        );


        element.innerHTML = `
            <div class="
                alert
                alert-warning
                m-3
            ">
                Não foi possível carregar este componente.
            </div>
        `;

    }

}


async function loadSiteIncludes() {

    await loadInclude(
        'site-header',
        'includes/header.html'
    );


    await loadInclude(
        'site-footer',
        'includes/footer.html'
    );

}


document.addEventListener(
    'DOMContentLoaded',
    loadSiteIncludes
);