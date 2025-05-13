const addedItems = new Map();
const productGroupsData = {}; 

const mainContainer = document.getElementById('mainContainer');
const orderSummaryCard = document.getElementById('orderSummaryCard');
const orderSummaryDescriptionElement = document.getElementById('orderSummaryDescription');
const emptyCartMessageElement = document.getElementById('emptyCartMessage');
const cartTableWrapperElement = document.getElementById('cartTableWrapper');
const cartTableBody = document.getElementById('cartTableBody');
const productGroupsContainerDOM = document.getElementById('productGroups');
const totalAmountElement = document.getElementById('totalAmount');
const downloadExcelButton = document.getElementById('downloadExcelButton');
const custNameInput = document.getElementById('custName');
const custAddressInput = document.getElementById('custAddress');
const custPhoneInput = document.getElementById('custPhone');

const STORAGE_KEY_CART = 'purchaseOrderCart_v1';
const STORAGE_KEY_CUSTOMER_INFO = 'purchaseOrderCustomerInfo_v1';

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
        setTimeout(() => {
            element.classList.remove('shake-it');
        }, 400); 
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
        searchInput.addEventListener('input', (event) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
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

function renderProductsInGroup(groupId, groupName) {
    const groupElement = document.getElementById(groupId);
    if (!groupElement) return;
    const groupProductsContainer = groupElement.querySelector('.group-products');
    const originalGroupProducts = getOriginalGroupProducts(groupName);
    
    groupProductsContainer.innerHTML = generateProductListHTML(originalGroupProducts, groupId);
    
    groupProductsContainer.querySelectorAll('.add-button').forEach(button => {
         button.addEventListener('click', handleAddRemoveButtonClick);
    });
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
    let qty = parseFloat(qtyString); 

    qtyInput.classList.remove('invalid');
    const errorSpan = document.getElementById(`${pid}-qtyError`) || document.createElement('span'); 
    errorSpan.id = `${pid}-qtyError`;
    errorSpan.className = 'sr-only error-message';
    qtyInput.setAttribute('aria-describedby', errorSpan.id);

    const groupElement = btnElement.closest('.group');
    const groupId = groupElement.id;
    const currentGroupName = groupElement.querySelector('.group-header span:first-child').textContent.trim();
    const wasOpen = groupElement.classList.contains('open');


    if (btnElement.classList.contains('added')) { 
        triggerShake(btnElement); 
        setTimeout(() => {
            addedItems.delete(name);
            showToast(`${name} removed from cart.`, 'warning');
            renderProductsInGroup(groupId, currentGroupName); 
            const freshGroupElement = document.getElementById(groupId);
            if (freshGroupElement && wasOpen && !freshGroupElement.classList.contains('open')) {
                freshGroupElement.classList.add('open');
                const header = freshGroupElement.querySelector('.group-header');
                const content = freshGroupElement.querySelector('.group-products');
                if (header) header.setAttribute('aria-expanded', 'true');
                if (content) content.setAttribute('aria-hidden', 'false');
            }
            updateTotal();
            updateOrderSummary();
        }, 400); 


    } else { 
        if (qtyString === '' || isNaN(qty) || qty <= 0) { 
            qtyInput.classList.add('invalid');
            qtyInput.value = ''; 
            qtyInput.setAttribute('aria-invalid', 'true');
            errorSpan.textContent = 'Please enter a valid quantity.';
            showToast('Please enter a valid quantity.', 'error');
            qtyInput.focus();
            return;
        }
        addedItems.set(name, { name, rate, qty, group: currentGroupName });
        showToast(`${name} added to cart!`, 'success');
        renderProductsInGroup(groupId, currentGroupName); 
        
        const freshGroupElement = document.getElementById(groupId);
        if (freshGroupElement && wasOpen && !freshGroupElement.classList.contains('open')) {
             freshGroupElement.classList.add('open');
             const header = freshGroupElement.querySelector('.group-header');
             const content = freshGroupElement.querySelector('.group-products');
             if (header) header.setAttribute('aria-expanded', 'true');
             if (content) content.setAttribute('aria-hidden', 'false');
        }
        updateTotal();
        updateOrderSummary();
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
                
                renderProductsInGroup(groupId, itemOriginalGroup); 

                const potentiallyReRenderedGroup = document.getElementById(groupId);
                if (potentiallyReRenderedGroup && wasOpen && !potentiallyReRenderedGroup.classList.contains('open')) {
                    potentiallyReRenderedGroup.classList.add('open');
                    const header = potentiallyReRenderedGroup.querySelector('.group-header');
                    const content = potentiallyReRenderedGroup.querySelector('.group-products');
                    if (header) header.setAttribute('aria-expanded', 'true');
                    if (content) content.setAttribute('aria-hidden', 'false');
                }
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

function downloadExcelHandler() { 
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

        ws['!cols'] = [
            { wch: 35 }, { wch: 10 }, { wch: 15 }, { wch: 15 } ];
        
        if(ws['A1']) {
            ws['A1'].s = { 
                font: { sz: 18, bold: true, color: { rgb: "006064" } }, 
                alignment: { horizontal: "center", vertical: "center" } 
            };
        }
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }]; 

        const headerRowIndex = 7; 
        ['A', 'B', 'C', 'D'].forEach(col => {
            const cellRef = `${col}${headerRowIndex + 1}`;
            if(ws[cellRef]) {
                ws[cellRef].s = { 
                    font: { bold: true, color: {rgb: "FFFFFF"} }, 
                    fill: { fgColor: { rgb: "008080"} }, 
                    alignment: { horizontal: "center", vertical: "center" },
                    border: { 
                        top: { style: "thin", color: { rgb: "006064" } },
                        bottom: { style: "thin", color: { rgb: "006064" } },
                        left: { style: "thin", color: { rgb: "006064" } },
                        right: { style: "thin", color: { rgb: "006064" } }
                    }
                };
            }
        });
        
        for (let i = 0; i < addedItems.size; i++) {
            const dataRowIndex = headerRowIndex + 1 + i;
             ['A', 'B', 'C', 'D'].forEach(col => {
                const cellRef = `${col}${dataRowIndex + 1}`;
                if(ws[cellRef]) {
                     ws[cellRef].s = {
                        border: {
                            top: { style: "thin", color: { rgb: "B0BEC5" } }, 
                            bottom: { style: "thin", color: { rgb: "B0BEC5" } },
                            left: { style: "thin", color: { rgb: "B0BEC5" } },
                            right: { style: "thin", color: { rgb: "B0BEC5" } }
                        }
                    };
                    if (col === 'A') ws[cellRef].s.alignment = { horizontal: "left" };
                    if (['B', 'C', 'D'].includes(col)) ws[cellRef].s.alignment = { horizontal: "right" };
                }
            });
        }

        const totalRowActualIndex = rows.length -1; 
        if(ws[`C${totalRowActualIndex + 1}`]) { 
            ws[`C${totalRowActualIndex + 1}`].s = { 
                font: { bold: true, sz: 12 }, 
                alignment: { horizontal: "right" },
                border: { top: { style: "medium", color: { rgb: "006064"}} } 
            };
        }
        if(ws[`D${totalRowActualIndex + 1}`]) { 
            ws[`D${totalRowActualIndex + 1}`].s = { 
                font: { bold: true, sz: 12, color: {rgb: "008080"} }, 
                alignment: { horizontal: "right" },
                border: { top: { style: "medium", color: { rgb: "006064"}} }
            };
        }

        XLSX.utils.book_append_sheet(wb, ws, 'OrderDetails'); 
        const safeCustomerName = name.replace(/[^a-z0-9]/gi, '_') || 'Customer';
        const fileName = `Purchase_Order_${safeCustomerName}_${new Date().toISOString().split('T')[0]}.xlsx`; 
        XLSX.writeFile(wb, fileName);
        showToast('Order downloaded successfully as Excel!', 'success');
    } catch (error) {
        console.error("Error generating Excel file:", error);
        showToast('Failed to download Excel. Please try again.', 'error');
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
    if (downloadExcelButton) {
        downloadExcelButton.addEventListener('click', downloadExcelHandler);
    }

    loadState(); 
    renderProducts(); 
    updateOrderSummary(); 
    updateTotal(); 
});
