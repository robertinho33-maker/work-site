'use strict';

const CATALOG_PATH = 'resources/catalogo.csv';

let catalogProducts = [];
let activeCategory = '';


/* =========================================================
   SEGURANÇA
========================================================= */

function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


/* =========================================================
   PREÇO
========================================================= */

function parsePrice(value) {

    if (value === null || value === undefined) {
        return 0;
    }

    let text = String(value).trim();

    if (!text) {
        return 0;
    }

    text = text
        .replace(/\s/g, '')
        .replace(/R\$/gi, '');

    /*
     * O CSV usa valores como:
     * 64,9
     * 49,2
     * 13,14
     *
     * Como o CSV usa vírgula como decimal,
     * não removemos a vírgula antes desta conversão.
     */

    text = text.replace(/\./g, '');
    text = text.replace(',', '.');

    const number = Number(text);

    return Number.isFinite(number)
        ? number
        : 0;
}


function formatPrice(value) {

    const price = parsePrice(value);

    if (!price) {
        return 'Preço sob consulta';
    }

    return price.toLocaleString(
        'pt-BR',
        {
            style: 'currency',
            currency: 'BRL'
        }
    );
}


/* =========================================================
   CSV
========================================================= */

/*
 * Parser CSV compatível com campos entre aspas,
 * inclusive campos contendo vírgulas.
 */
function parseCSV(text) {

    const rows = [];

    let row = [];
    let field = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {

        const char = text[i];
        const next = text[i + 1];

        if (char === '"' && insideQuotes && next === '"') {

            field += '"';
            i++;

            continue;
        }

        if (char === '"') {

            insideQuotes = !insideQuotes;

            continue;
        }

        if (char === ',' && !insideQuotes) {

            row.push(field);
            field = '';

            continue;
        }

        if (
            (char === '\n' || char === '\r') &&
            !insideQuotes
        ) {

            if (char === '\r' && next === '\n') {
                i++;
            }

            row.push(field);
            field = '';

            if (row.some(value => value.trim() !== '')) {
                rows.push(row);
            }

            row = [];

            continue;
        }

        field += char;
    }

    if (field !== '' || row.length > 0) {

        row.push(field);

        if (row.some(value => value.trim() !== '')) {
            rows.push(row);
        }
    }

    if (rows.length === 0) {
        return [];
    }

    const headers = rows[0].map(
        header => header.trim()
    );

    return rows
        .slice(1)
        .map(columns => {

            const product = {};

            headers.forEach(
                (header, index) => {

                    product[header] =
                        (columns[index] ?? '').trim();

                }
            );

            return product;

        })
        .filter(product =>
            Object.values(product)
                .some(value => value !== '')
        );
}


/* =========================================================
   NORMALIZAÇÃO DO PRODUTO
========================================================= */

function normalizeProduct(product, index) {

    return {
        id: product.SKU || `catalog-${index + 1}`,

        name: product.Produto || '',

        weight: product.peso || '',

        price: parsePrice(product.Preço),

        priceRaw: product.Preço || '',

        category: product.Categoria || 'Sem categoria',

        stock: product.Estoque || '',

        description: product.Descrição || '',

        sku: product.SKU || '',

        image: product.Imagem || ''
    };
}


/* =========================================================
   CATEGORIAS
========================================================= */

function getCategories(products) {

    return [
        ...new Set(
            products
                .map(product => product.category)
                .filter(Boolean)
        )
    ].sort(
        (a, b) =>
            a.localeCompare(b, 'pt-BR')
    );
}


function renderCategoryFilters() {

    const container =
        document.getElementById(
            'category-filters'
        );

    if (!container) {
        return;
    }

    const categories =
        getCategories(catalogProducts);

    container.innerHTML = '';

    const allButton =
        createCategoryButton(
            'Todos',
            ''
        );

    container.appendChild(allButton);


    categories.forEach(category => {

        container.appendChild(
            createCategoryButton(
                category,
                category
            )
        );

    });

}


function createCategoryButton(
    label,
    category
) {

    const button =
        document.createElement('button');

    button.type = 'button';

    button.textContent = label;

    button.className =
        category === activeCategory
            ? 'btn btn-primary category-button'
            : 'btn btn-outline-primary category-button';

    button.addEventListener(
        'click',
        () => {

            activeCategory = category;

            renderCategoryFilters();

            renderProducts();

        }
    );

    return button;
}


/* =========================================================
   STATUS DE ESTOQUE
========================================================= */

function isProductAvailable(product) {

    const stock =
        String(product.stock || '')
            .trim()
            .toLowerCase();

    if (!stock) {
        return true;
    }

    if (
        stock.includes('sem estoque') ||
        stock.includes('indisponível') ||
        stock.includes('indisponivel') ||
        stock === '0'
    ) {
        return false;
    }

    return true;
}


/* =========================================================
   FILTRO
========================================================= */

function getFilteredProducts() {

    if (!activeCategory) {
        return catalogProducts;
    }

    return catalogProducts.filter(
        product =>
            product.category === activeCategory
    );
}


/* =========================================================
   CARD DO PRODUTO
========================================================= */

function createProductCard(product) {

    const column =
        document.createElement('div');

    column.className =
        'col-xl-4 col-lg-4 col-md-6';


    const article =
        document.createElement('article');

    article.className =
        'card product-card h-100 border-0 shadow-sm';


    const imageWrapper =
        document.createElement('div');

    imageWrapper.className =
        'product-image-wrapper';

    imageWrapper.style.cssText = `
        height: 280px;
        background: #f8f8f8;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
    `;


    if (product.image) {

        const image =
            document.createElement('img');

        image.src = product.image;

        image.alt = product.name;

        image.className =
            'img-fluid';

        image.loading =
            'lazy';

        image.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: contain;
            padding: 20px;
        `;

        image.addEventListener(
            'error',
            () => {

                image.remove();

                imageWrapper.innerHTML = `
                    <i class="
                        fa-solid
                        fa-image
                        fa-3x
                        text-muted
                    "></i>
                `;
            }
        );

        imageWrapper.appendChild(image);

    } else {

        imageWrapper.innerHTML = `
            <i class="
                fa-solid
                fa-image
                fa-3x
                text-muted
            "></i>
        `;
    }


    /* =====================================================
       CARD BODY
    ====================================================== */

    const body =
        document.createElement('div');

    body.className =
        'card-body d-flex flex-column p-4';


    const category =
        document.createElement('small');

    category.className =
        'text-muted mb-2';

    category.textContent =
        product.category;


    const title =
        document.createElement('h5');

    title.className =
        'card-title fw-bold';

    title.textContent =
        product.name;


    const description =
        document.createElement('p');

    description.className =
        'card-text text-muted small';

    description.textContent =
        product.description
            .replace(/<[^>]+>/g, '')
            .substring(0, 200);


    const weight =
        document.createElement('small');

    weight.className =
        'text-muted mb-3';

    weight.textContent =
        product.weight
            ? `Peso: ${product.weight}`
            : '';


    const footer =
        document.createElement('div');

    footer.className =
        `
        mt-auto
        pt-3
        d-flex
        justify-content-between
        align-items-center
        `;


    const price =
        document.createElement('strong');

    price.className =
        'text-primary fs-5';

    price.textContent =
        formatPrice(product.price);


    const button =
        document.createElement('button');

    button.type =
        'button';

    button.className =
        'btn btn-primary rounded-circle';

    button.setAttribute(
        'aria-label',
        `Adicionar ${product.name} ao carrinho`
    );

    button.innerHTML =
        '<i class="fa-solid fa-plus"></i>';


    button.addEventListener(
        'click',
        () => {

            if (
                !isProductAvailable(product)
            ) {

                alert(
                    'Este produto está sem estoque.'
                );

                return;
            }

            /*
             * Evento público para o carrinho.
             * O cart.js poderá escutar este evento.
             */
            document.dispatchEvent(
                new CustomEvent(
                    'catalog:add-to-cart',
                    {
                        detail: product
                    }
                )
            );

            console.log(
                'Produto selecionado:',
                product
            );
        }
    );


    footer.appendChild(price);
    footer.appendChild(button);


    body.appendChild(category);
    body.appendChild(title);

    if (product.description) {
        body.appendChild(description);
    }

    if (product.weight) {
        body.appendChild(weight);
    }

    body.appendChild(footer);


    article.appendChild(imageWrapper);
    article.appendChild(body);

    column.appendChild(article);


    return column;
}


/* =========================================================
   RENDERIZAÇÃO
========================================================= */

function renderProducts() {

    const grid =
        document.getElementById(
            'product-grid'
        );

    if (!grid) {
        return;
    }


    const products =
        getFilteredProducts();


    grid.innerHTML = '';


    if (products.length === 0) {

        grid.innerHTML = `
            <div class="col-12">

                <div class="text-center py-5">

                    <i class="
                        fa-solid
                        fa-box-open
                        fa-3x
                        text-muted
                        mb-3
                    "></i>

                    <h4>
                        Nenhum produto encontrado
                    </h4>

                </div>

            </div>
        `;

        return;
    }


    const fragment =
        document.createDocumentFragment();


    products.forEach(
        product => {

            fragment.appendChild(
                createProductCard(
                    product
                )
            );

        }
    );


    grid.appendChild(fragment);

}


/* =========================================================
   CARREGAMENTO DO CATÁLOGO
========================================================= */

async function loadCatalog() {

    const grid =
        document.getElementById(
            'product-grid'
        );

    if (!grid) {
        return;
    }


    grid.innerHTML = `
        <div class="col-12">

            <div class="text-center py-5">

                <div
                    class="spinner-border text-primary mb-3"
                    role="status"
                >
                    <span class="visually-hidden">
                        Carregando produtos...
                    </span>
                </div>

                <p class="text-muted mb-0">
                    Carregando catálogo...
                </p>

            </div>

        </div>
    `;


    try {

        console.log(
            `Carregando catálogo: ${CATALOG_PATH}`
        );


        const response =
            await fetch(
                CATALOG_PATH,
                {
                    cache: 'no-cache'
                }
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        const csvText =
            await response.text();


        const rows =
            parseCSV(csvText);


        catalogProducts =
            rows.map(
                (product, index) =>
                    normalizeProduct(
                        product,
                        index
                    )
            );


        console.log(
            `✓ ${catalogProducts.length} produtos carregados`
        );


        renderCategoryFilters();

        renderProducts();


    } catch (error) {

        console.error(
            'Erro ao carregar catálogo:',
            error
        );


        grid.innerHTML = `
            <div class="col-12">

                <div class="
                    alert
                    alert-danger
                    text-center
                ">

                    <i class="
                        fa-solid
                        fa-triangle-exclamation
                        me-2
                    "></i>

                    Não foi possível carregar o catálogo.

                    <br>

                    <small>
                        Fonte:
                        <strong>
                            resources/catalogo.csv
                        </strong>
                    </small>

                </div>

            </div>
        `;
    }
}


/* =========================================================
   API PÚBLICA
========================================================= */

window.catalog = {

    getProducts() {
        return [...catalogProducts];
    },

    getProductBySKU(sku) {

        return catalogProducts.find(
            product =>
                product.sku === sku
        ) || null;

    },

    getCategories() {
        return getCategories(
            catalogProducts
        );
    },

    reload() {
        return loadCatalog();
    }

};


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

document.addEventListener(
    'DOMContentLoaded',
    loadCatalog
);