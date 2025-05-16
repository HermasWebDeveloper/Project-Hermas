let products = [];
const addedItems = new Map();
const productGroupsData = {};
const groupSearchQueries = {};

const mainContainer = document.getElementById('mainContainer');
const orderSummaryCard = document.getElementById('orderSummaryCard');
const orderSummaryDescriptionElement = document.getElementById('orderSummaryDescription');
const emptyCartMessageElement = document.getElementById('emptyCartMessage');
const cartTableWrapperElement = document.getElementById('cartTableWrapper');
const cartTableBody = document.getElementById('cartTableBody');
const productGroupsContainerDOM = document.getElementById('productGroups');
const totalAmountElement = document.getElementById('totalAmount');
const downloadAndShareButton = document.getElementById('downloadAndShareButton');
const custNameInput = document.getElementById('custName');
const custAddressInput = document.getElementById('custAddress');
const custPhoneInput = document.getElementById('custPhone');

const STORAGE_KEY_CART = 'purchaseOrderCart_v1';
const STORAGE_KEY_CUSTOMER_INFO = 'purchaseOrderCustomerInfo_v1';

fetch('/products')
  .then(res => res.json())
  .then(data => {
    products = data;
    renderProducts();
    updateOrderSummary();
    updateTotal();
  })
  .catch(error => {
    showToast('Failed to load products. Please try again.', 'error');
  });

function showToast(message, type = 'info', duration = 3000) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.classList.add('toast', type);
    toast.setAttribute('role', 'alert');
    
    let iconClass = 'fas fa-info-circle';
    if (type === 'success') iconClass = 'fas fa-check-circle';
    else if (type === 'error') iconClass = 'fas fa-times-circle';
    else if (type === 'warning') iconClass = 'fas fa-exclamation-triangle';

    toast.innerHTML = `<i class="${iconClass}" aria-hidden="true"></i><span>${message}</span>`;
    toastContainer.appendChild(toast);
    void toast.offsetWidth; 
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, duration);
}

function triggerShake(element) {
    if (element) {
        element.classList.add('shake-it');
        // Use a longer, smoother transition for shake
        setTimeout(() => {
            element.classList.remove('shake-it');
            // Add a subtle scale "pop" after shake for smoothness
            element.classList.add('pop-it');
            setTimeout(() => {
                element.classList.remove('pop-it');
            }, 180); // pop duration
        }, 480); // shake duration (slightly longer for smoothness)
    }
}

function getOriginalGroupProducts(groupName) {
     return productGroupsData[groupName] || [];
}

function generateProductListHTML(originalGroupProductList, groupId) {
    let productsHTML = '';
    const displayList = [...originalGroupProductList]; 

    displayList.sort((a, b) => {
        const aIsAdded = addedItems.has(a.name);
        const bIsAdded = addedItems.has(b.name);
        if (aIsAdded && !bIsAdded) return -1; 
        if (!aIsAdded && bIsAdded) return 1;  
        const idxA = originalGroupProductList.findIndex(p => p.name === a.name && p.rate === a.rate);
        const idxB = originalGroupProductList.findIndex(p => p.name === b.name && p.rate === b.rate);
        return idxA - idxB; 
    });

    if (displayList.length === 0) {
        return '<p class="product" style="text-align:center; color: #777;">No products match your search.</p>';
    }

    displayList.forEach((product) => {
        const originalIndexInGroup = originalGroupProductList.findIndex(p => p.name === product.name && p.rate === product.rate);
        const pid = `${groupId}-product-${originalIndexInGroup}`;

        const addedItem = addedItems.get(product.name);
        const initialQty = addedItem ? addedItem.qty : '';
        const isAddedClass = addedItem ? 'added' : '';
        const isDisabled = addedItem ? 'disabled' : '';
        const buttonText = addedItem ? 'Remove' : 'Add';
        const buttonIconClass = addedItem ? 'fas fa-trash-alt' : 'fas fa-cart-plus';

        productsHTML += `
            <div class="product" data-name="${product.name.toLowerCase()}">
                <span class="product-name">${product.name}</span>
                <span class="product-price">₹${product.rate.toFixed(2)}</span>
                <div class="product-controls-mobile">
                    <label for="${pid}-qty" class="sr-only">Quantity for ${product.name}</label>
                    <input type="number" min="0" placeholder="Qty" class="qty-input ${isAddedClass}" id="${pid}-qty" data-name="${product.name}" data-rate="${product.rate}" value="${initialQty}" ${isDisabled} aria-label="Quantity for ${product.name}">
                    <button class="add-button ${isAddedClass}" id="${pid}-btn" data-pid="${pid}">
                        <i class="${buttonIconClass}" aria-hidden="true"></i> ${buttonText}
                    </button>
                </div>
            </div>`;
    });
    return productsHTML;
}

function renderProducts() {
    if (!productGroupsContainerDOM) return;
    productGroupsContainerDOM.innerHTML = ''; 

    if (Object.keys(productGroupsData).length === 0) {
        products.forEach(p => {
            if (!productGroupsData[p.group]) productGroupsData[p.group] = [];
            productGroupsData[p.group].push(p);
        });
    }

    Object.keys(productGroupsData).forEach((groupName, groupIndex) => {
        const safeGroupName = groupName.replace(/\s+/g, '-').toLowerCase();
        const groupId = `group-${safeGroupName}-${groupIndex}`; 
        
        const groupDiv = document.createElement('div');
        groupDiv.className = 'group';
        groupDiv.id = groupId;

        groupDiv.innerHTML = `
            <div class="group-header" role="button" tabindex="0" aria-expanded="false" aria-controls="${groupId}-content">
                <span>${groupName}</span>
                <span><i class="fas fa-chevron-down" aria-hidden="true"></i></span>
            </div>
            <div class="group-controls">
                 <label for="${groupId}-search" class="sr-only">Search in ${groupName}</label>
                <input type="text" class="group-search" id="${groupId}-search" placeholder="Search in ${groupName}..." aria-label="Search products in ${groupName}">
            </div>
            <div class="group-products" id="${groupId}-content" role="region" aria-hidden="true">
                ${generateProductListHTML(productGroupsData[groupName], groupId)}
            </div>`;
        productGroupsContainerDOM.appendChild(groupDiv);

        const header = groupDiv.querySelector('.group-header');
        header.addEventListener('click', () => toggleGroup(groupId));
        header.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleGroup(groupId);
            }
        });

        const searchInput = groupDiv.querySelector('.group-search');
        let debounceTimer;
        if (groupSearchQueries[groupId]) {
            searchInput.value = groupSearchQueries[groupId];
            filterGroup(groupId, groupSearchQueries[groupId]);
        }
        searchInput.addEventListener('input', (event) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                groupSearchQueries[groupId] = event.target.value;
                filterGroup(groupId, event.target.value);
            }, 300); 
        });
        
        groupDiv.querySelectorAll('.group-products .add-button').forEach(button => {
             button.addEventListener('click', handleAddRemoveButtonClick);
        });
    });
}

function toggleGroup(id) {
    const group = document.getElementById(id);
    if(!group) return;
    const header = group.querySelector('.group-header');
    const content = group.querySelector('.group-products');
    const isOpen = group.classList.contains('open');
    
    document.querySelectorAll('.group.open').forEach(g => {
        if (g.id !== id) {
            g.classList.remove('open');
            g.querySelector('.group-header').setAttribute('aria-expanded', 'false');
            g.querySelector('.group-products').setAttribute('aria-hidden', 'true');
        }
    });

    if (!isOpen) {
        group.classList.add('open');
        header.setAttribute('aria-expanded', 'true');
        content.setAttribute('aria-hidden', 'false');
    } else {
        group.classList.remove('open');
        header.setAttribute('aria-expanded', 'false');
        content.setAttribute('aria-hidden', 'true');
    }
}

function filterGroup(groupId, query) {
    const search = query.toLowerCase().trim();
    const groupElement = document.getElementById(groupId);
    if (!groupElement) return;

    const groupProductsContainer = groupElement.querySelector('.group-products');
    const groupName = groupElement.querySelector('.group-header span:first-child').textContent.trim();
    const originalGroupProds = getOriginalGroupProducts(groupName);
    
    const filteredProducts = originalGroupProds.filter(product => 
        product.name.toLowerCase().includes(search)
    );

    groupProductsContainer.innerHTML = generateProductListHTML(filteredProducts, groupId);
    
    groupProductsContainer.querySelectorAll('.add-button').forEach(button => {
         button.addEventListener('click', handleAddRemoveButtonClick);
    });
}

function renderProductsInGroup(groupId, groupName, filterQuery = null, keepOpen = false) {
    const groupElement = document.getElementById(groupId);
    if (!groupElement) return;
    const groupProductsContainer = groupElement.querySelector('.group-products');
    const searchInput = groupElement.querySelector('.group-search');
    let query = filterQuery;
    if (query === null && searchInput) {
        query = searchInput.value;
    }
    groupSearchQueries[groupId] = query || '';
    if (query && query.trim() !== '') {
        filterGroup(groupId, query);
    } else {
        groupProductsContainer.innerHTML = generateProductListHTML(getOriginalGroupProducts(groupName), groupId);
        groupProductsContainer.querySelectorAll('.add-button').forEach(button => {
            button.addEventListener('click', handleAddRemoveButtonClick);
        });
    }
    if (keepOpen && !groupElement.classList.contains('open')) {
        groupElement.classList.add('open');
        const header = groupElement.querySelector('.group-header');
        const content = groupElement.querySelector('.group-products');
        if (header) header.setAttribute('aria-expanded', 'true');
        if (content) content.setAttribute('aria-hidden', 'false');
    }
}

function handleAddRemoveButtonClick(event) {
    const button = event.currentTarget; 
    const pid = button.dataset.pid;
    
    if (!pid) {
        console.error("Button is missing data-pid attribute:", button);
        return;
    }
    toggleAdd(pid, button);
}

function toggleAdd(pid, btnElement) {
    const qtyInput = document.getElementById(`${pid}-qty`);
    if (!qtyInput || !btnElement) {
        console.error("Could not find elements for PID:", pid, "or button element missing");
        return;
    }

    const name = qtyInput.dataset.name;
    const rate = parseFloat(qtyInput.dataset.rate);
    let qtyString = qtyInput.value.trim();
    let qty = parseInt(qtyString, 10);

    qtyInput.classList.remove('invalid');
    const errorSpan = document.getElementById(`${pid}-qtyError`) || document.createElement('span');
    errorSpan.id = `${pid}-qtyError`;
    errorSpan.className = 'sr-only error-message';
    qtyInput.setAttribute('aria-describedby', errorSpan.id);

    const groupElement = btnElement.closest('.group');
    const groupId = groupElement.id;
    const currentGroupName = groupElement.querySelector('.group-header span:first-child').textContent.trim();
    const wasOpen = groupElement.classList.contains('open');
    const filterQuery = groupElement.querySelector('.group-search')?.value || '';

    if (btnElement.classList.contains('added')) {
        triggerShake(btnElement);
        setTimeout(() => {
            addedItems.delete(name);
            showToast(`${name} removed from cart.`, 'warning');
            renderProductsInGroup(groupId, currentGroupName, filterQuery, true);
            updateTotal();
            updateOrderSummary();
        }, 400);
    } else {
        // Only allow positive integers
        if (
            qtyString === '' ||
            isNaN(qty) ||
            qty <= 0 ||
            !/^\d+$/.test(qtyString)
        ) {
            qtyInput.classList.add('invalid');
            qtyInput.value = '';
            qtyInput.setAttribute('aria-invalid', 'true');
            errorSpan.textContent = 'Please enter a valid quantity (positive integer).';
            showToast('Please enter a valid quantity.', 'error');
            qtyInput.focus();
            return;
        }
        triggerShake(btnElement);
        setTimeout(() => {
            addedItems.set(name, { name, rate, qty, group: currentGroupName });
            showToast(`${name} added to cart!`, 'success');
            renderProductsInGroup(groupId, currentGroupName, filterQuery, true);
            updateTotal();
            updateOrderSummary();
        }, 400);
    }
}

function removeItemFromCart(itemName, buttonElement) { 
    const item = addedItems.get(itemName);
    if (!item) return; 

    if (buttonElement) { 
        triggerShake(buttonElement);
    }
    
    setTimeout(() => {
        addedItems.delete(itemName);
        showToast(`${itemName} removed from cart.`, 'warning');

        const itemOriginalGroup = item.group; 
        if (itemOriginalGroup) { 
            const groupElementToUpdate = Array.from(document.querySelectorAll('#productGroups .group')).find(g => 
                g.querySelector('.group-header span:first-child').textContent.trim() === itemOriginalGroup
            );

            if (groupElementToUpdate) { 
                const groupId = groupElementToUpdate.id; 
                const wasOpen = groupElementToUpdate.classList.contains('open'); 
                const filterQuery = groupElementToUpdate.querySelector('.group-search')?.value || '';
                renderProductsInGroup(groupId, itemOriginalGroup, filterQuery, wasOpen); 
            }
        }
        updateTotal();
        updateOrderSummary();
    }, buttonElement ? 400 : 0); 
}

function updateTotal() {
    if (!totalAmountElement) return;
    let total = 0;
    addedItems.forEach(item => {
        total += item.qty * item.rate;
    });
    totalAmountElement.textContent = total.toFixed(2);
}

function updateOrderSummary() {
    if (!cartTableBody || !orderSummaryCard || !orderSummaryDescriptionElement || !emptyCartMessageElement || !cartTableWrapperElement) return; 
    
    cartTableBody.innerHTML = ''; 

    if (addedItems.size === 0) {
        orderSummaryDescriptionElement.style.display = 'none';
        emptyCartMessageElement.style.display = 'block'; 
        cartTableWrapperElement.style.display = 'none'; 
    } else {
        orderSummaryDescriptionElement.style.display = 'block';
        emptyCartMessageElement.style.display = 'none'; 
        cartTableWrapperElement.style.display = 'block'; 
        
        addedItems.forEach(item => {
            const subtotal = item.qty * item.rate;
            const row = cartTableBody.insertRow();
            row.classList.add('animated-cart-item'); 

            row.insertCell().textContent = item.name;
            const qtyCell = row.insertCell();
            qtyCell.textContent = item.qty;
            qtyCell.classList.add('cart-item-qty'); 

            const unitPriceCell = row.insertCell();
            unitPriceCell.textContent = `₹${item.rate.toFixed(2)}`;
            unitPriceCell.classList.add('cart-item-price');

            const subtotalCell = row.insertCell();
            subtotalCell.textContent = `₹${subtotal.toFixed(2)}`;
            subtotalCell.classList.add('cart-item-subtotal');
            
            const cellAction = row.insertCell();
            const removeBtn = document.createElement('button');
            removeBtn.classList.add('remove-item-btn-modern');
            removeBtn.setAttribute('aria-label', `Remove ${item.name} from cart`);
            removeBtn.innerHTML = '<i class="fas fa-trash-alt" aria-hidden="true"></i>';
            removeBtn.addEventListener('click', (event) => removeItemFromCart(item.name, event.currentTarget));
            cellAction.appendChild(removeBtn);
        });
    }
     saveState(); 
}

function validateCustomerInfo() {
    let isValid = true;
    const inputsToValidate = [
        { input: custNameInput, errorId: 'custNameError', fieldName: 'Customer Name' },
        { input: custAddressInput, errorId: 'custAddressError', fieldName: 'Delivery Address' },
        { input: custPhoneInput, errorId: 'custPhoneError', fieldName: 'WhatsApp Number' },
    ];

    inputsToValidate.forEach(item => {
        const { input, errorId, fieldName } = item;
        const errorSpan = document.getElementById(errorId);
        input.classList.remove('invalid');
        input.removeAttribute('aria-invalid');
        if (errorSpan) errorSpan.textContent = '';

        if (!input.value.trim()) {
            input.classList.add('invalid');
            input.setAttribute('aria-invalid', 'true');
            if(errorSpan) errorSpan.textContent = `${fieldName} is required.`;
            isValid = false;
        }
    });
    return isValid;
}

async function downloadAndShareHandler() {
    if (!validateCustomerInfo()) {
        showToast('Please fill in all customer information correctly.', 'error');
        const firstInvalid = document.querySelector('input.invalid');
        if (firstInvalid) firstInvalid.focus();
        return;
    }
    if (addedItems.size === 0) {
        showToast('Your cart is empty. Add items before downloading.', 'warning');
        return;
    }

    const name = custNameInput.value.trim();
    const addr = custAddressInput.value.trim();
    const phone = custPhoneInput.value.trim();

    const rows = [
        ['PURCHASE ORDER'],
        [''],
        ['Customer Name:', name],
        ['Delivery Address:', addr],
        ['WhatsApp Number:', phone],
        ['Order Date:', new Date().toLocaleDateString('en-GB')],
        [''],
        ['Product Name', 'Quantity', 'Unit Price (₹)', 'Amount (₹)']
    ];

    addedItems.forEach(item => {
        const amount = item.qty * item.rate;
        rows.push([item.name, item.qty, item.rate.toFixed(2), amount.toFixed(2)]);
    });

    rows.push(['']);
    rows.push(['', '', 'Total:', `₹${totalAmountElement.textContent}`]);

    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'OrderDetails');
        const safeCustomerName = name.replace(/[^a-z0-9]/gi, '_') || 'Customer';
        const fileName = `Purchase_Order_${safeCustomerName}_${new Date().toISOString().split('T')[0]}.xlsx`;

        // Download Excel
        XLSX.writeFile(wb, fileName);
        showToast('Order downloaded successfully as Excel!', 'success');

        // Share if supported
        if (navigator.canShare && navigator.canShare({ files: [] })) {
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const file = new File([wbout], fileName, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            await navigator.share({
                title: 'Purchase Order',
                text: 'Here is my purchase order.',
                files: [file]
            });
            showToast('Order shared successfully!', 'success');
        } else {
            showToast('Sharing is not supported on this device/browser.', 'warning');
        }
    } catch (error) {
        console.error("Error generating or sharing Excel file:", error);
        showToast('Failed to download or share Excel. Please try again.', 'error');
    }
}

function saveState() {
    try {
        const cartArray = Array.from(addedItems.values());
        localStorage.setItem(STORAGE_KEY_CART, JSON.stringify(cartArray));

        const customerInfo = {
            name: custNameInput.value,
            address: custAddressInput.value,
            phone: custPhoneInput.value,
        };
        localStorage.setItem(STORAGE_KEY_CUSTOMER_INFO, JSON.stringify(customerInfo));
    } catch (e) {
         console.warn("Could not save state to local storage (possibly full or disabled):", e);
    }
}

function loadState() {
    const savedCart = localStorage.getItem(STORAGE_KEY_CART);
    if (savedCart) {
        try {
            const cartArray = JSON.parse(savedCart);
            addedItems.clear(); 
            if (Array.isArray(cartArray)) { 
                cartArray.forEach(item => {
                    if (item && typeof item.name === 'string' && typeof item.rate === 'number' && typeof item.qty === 'number') {
                        addedItems.set(item.name, item);
                    }
                });
            }
        } catch (e) {
            console.error("Failed to parse cart from local storage:", e);
            showToast('Error loading saved cart data. Starting fresh.', 'error');
            localStorage.removeItem(STORAGE_KEY_CART); 
        }
    }

    const savedCustomerInfo = localStorage.getItem(STORAGE_KEY_CUSTOMER_INFO);
    if (savedCustomerInfo) {
         try {
             const customerInfo = JSON.parse(savedCustomerInfo);
             if (customerInfo && typeof customerInfo === 'object') { 
                custNameInput.value = customerInfo.name || '';
                custAddressInput.value = customerInfo.address || '';
                custPhoneInput.value = customerInfo.phone || '';
             }
         } catch (e) {
             console.error("Failed to parse customer info from local storage:", e);
             showToast('Error loading saved customer information. Please re-enter.', 'error');
             localStorage.removeItem(STORAGE_KEY_CUSTOMER_INFO); 
         }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Prevent decimal and negative in quantity inputs
    productGroupsContainerDOM.addEventListener('input', function (e) {
        if (e.target.classList.contains('qty-input')) {
            let val = e.target.value;
            // Remove non-digit characters and leading zeros, allow only positive integers
            val = val.replace(/[^0-9]/g, '');
            if (val.startsWith('0')) val = val.replace(/^0+/, '');
            e.target.value = val;
        }
    });

    // WhatsApp Number: only digits allowed
    custPhoneInput.addEventListener('input', function (e) {
        let val = e.target.value.replace(/\D/g, '');
        e.target.value = val;
    });

    // Customer Name: allow alphabets, spaces, and common symbols (.,-()[])
    custNameInput.addEventListener('input', function (e) {
        let val = e.target.value.replace(/[^a-zA-Z\s.,\-()\[\]]/g, '');
        e.target.value = val;
    });

    if (downloadAndShareButton) {
        downloadAndShareButton.addEventListener('click', downloadAndShareHandler);
    }
    loadState(); 
    renderProducts(); 
    updateOrderSummary(); 
    updateTotal(); 
});
