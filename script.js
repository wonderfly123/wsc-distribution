// Configuration
const CONFIG = {
    GOOGLE_API_KEY: 'AIzaSyD09jsDdV38WufJdueValinEFGYE-72PCE',
    SHEET_ID: '1o-du99E6EmTJmehFzF-TaKeh33GvW4Vzw7TMCB52KvQ',
    SHEET_NAME: 'Sheet1', // Change this to your actual sheet name if different
    
    // Zapier webhook URLs - REPLACE THESE WITH YOUR ACTUAL ZAPIER WEBHOOK URLS
    ZAPIER_NEW_CUSTOMER_WEBHOOK: 'https://hooks.zapier.com/hooks/catch/23412469/ui2ngna/',
    ZAPIER_EXISTING_CUSTOMER_WEBHOOK: 'https://hooks.zapier.com/hooks/catch/YOUR_WEBHOOK_ID_HERE'
};

// Store customer data after verification
let verifiedCustomer = null;

// Tab switching
function openTab(tabName) {
    // Hide all tabs
    const tabContents = document.getElementsByClassName('tab-content');
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].classList.remove('active');
    }
    
    // Remove active class from all buttons
    const tabButtons = document.getElementsByClassName('tab-button');
    for (let i = 0; i < tabButtons.length; i++) {
        tabButtons[i].classList.remove('active');
    }
    
    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
    
    // Reset forms and messages
    document.getElementById('success-message').style.display = 'none';
    if (tabName === 'order') {
        document.getElementById('customer-info').style.display = 'none';
        document.getElementById('customer-status').innerHTML = '';
        verifiedCustomer = null;
    }
}

// Logo file validation
function validateLogoFile(input) {
    const file = input.files[0];
    const errorDiv = document.getElementById('logo-error');
    errorDiv.textContent = '';
    
    if (!file) return;
    
    // Check file size (2MB = 2 * 1024 * 1024 bytes)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
        errorDiv.textContent = 'File size must be less than 2MB';
        input.value = '';
        return false;
    }
    
    // Check file extension
    const allowedExtensions = ['png', 'jpg', 'jpeg', 'svg'];
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.split('.').pop();
    
    if (!allowedExtensions.includes(fileExtension)) {
        errorDiv.textContent = 'Invalid file format. Please upload PNG, JPG, or SVG';
        input.value = '';
        return false;
    }
    
    return true;
}

// Verify customer email in Google Sheets
async function verifyCustomer() {
    const email = document.getElementById('order_email').value.trim();
    const statusDiv = document.getElementById('customer-status');
    const verifyBtn = event.target;
    
    if (!email) {
        statusDiv.innerHTML = '<div class="status-message error">Please enter an email address</div>';
        return;
    }
    
    // Show loading
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = '<span class="loading"></span> Verifying...';
    statusDiv.innerHTML = '';
    
    try {
        // Fetch data from Google Sheets
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SHEET_ID}/values/${CONFIG.SHEET_NAME}?key=${CONFIG.GOOGLE_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.values) {
            throw new Error('No data found in sheet');
        }
        
        // Find customer by email (assuming email is in column A, index 0)
        const headers = data.values[0]; // First row is headers
        const rows = data.values.slice(1); // Rest are data rows
        
        // Find email column index
        const emailColIndex = headers.findIndex(h => h.toLowerCase().includes('email'));
        
        // Find customer
        const customerRow = rows.find(row => row[emailColIndex]?.toLowerCase() === email.toLowerCase());
        
        if (customerRow) {
            // Customer found!
            // Columns: Email, Business Name, Contact First Name, Contact Last Name, Phone, Address, Logo Link, Date Added
            verifiedCustomer = {
                email: customerRow[0],
                businessName: customerRow[1],
                contactName: customerRow[2] + ' ' + customerRow[3], // Combine first and last name
                phone: customerRow[4],
                address: customerRow[5],
                logoLink: customerRow[6]
            };
            
            // Show success and populate form
            statusDiv.innerHTML = '<div class="status-message success">✓ Customer account verified!</div>';
            displayCustomerInfo(verifiedCustomer);
            
        } else {
            // Customer not found
            statusDiv.innerHTML = `
                <div class="status-message error">
                    ❌ Customer not found. Please create a new order using the 
                    <a href="#" onclick="openTab('application'); return false;" style="color: #c62828; font-weight: bold;">New Customer Application</a> tab.
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error verifying customer:', error);
        statusDiv.innerHTML = '<div class="status-message error">Error verifying customer. Please try again.</div>';
    } finally {
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Verify Account';
    }
}

// Display customer info after verification
function displayCustomerInfo(customer) {
    document.getElementById('display_business_name').textContent = customer.businessName;
    document.getElementById('order_contact_name').value = customer.contactName;
    document.getElementById('order_phone').value = customer.phone;
    document.getElementById('order_address').value = customer.address;
    
    // Display logo if available
    const logoPreview = document.getElementById('logo-preview');
    if (customer.logoLink) {
        // If it's a Google Drive link, convert to direct image link
        let imageUrl = customer.logoLink;
        if (customer.logoLink.includes('drive.google.com')) {
            const fileId = customer.logoLink.match(/[-\w]{25,}/);
            if (fileId) {
                imageUrl = `https://drive.google.com/thumbnail?id=${fileId[0]}&sz=w400`;
            }
        }
        logoPreview.innerHTML = `<img src="${imageUrl}" alt="Customer Logo" onerror="this.style.display='none'">`;
    } else {
        logoPreview.innerHTML = '<p style="color: #666; font-style: italic;">Logo on file</p>';
    }
    
    // Show the form
    document.getElementById('customer-info').style.display = 'block';
    
    // Set minimum pickup date (4 business days from now)
    setMinimumPickupDate('order_pickup_date', 4);
}

// Validate pickup date (must be Monday or Wednesday)
function validatePickupDate(input) {
    const errorDiv = document.getElementById('pickup-date-error');
    const selectedDate = new Date(input.value + 'T00:00:00');
    const dayOfWeek = selectedDate.getDay();
    
    // 1 = Monday, 3 = Wednesday
    if (dayOfWeek !== 1 && dayOfWeek !== 3) {
        errorDiv.textContent = 'Pickup date must be a Monday or Wednesday';
        input.value = '';
        return false;
    }
    
    errorDiv.textContent = '';
    return true;
}

// Set minimum pickup date based on business days
function setMinimumPickupDate(inputId, businessDays) {
    const input = document.getElementById(inputId);
    const today = new Date();
    let daysAdded = 0;
    let currentDate = new Date(today);
    
    while (daysAdded < businessDays) {
        currentDate.setDate(currentDate.getDate() + 1);
        // Skip weekends (0 = Sunday, 6 = Saturday)
        if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
            daysAdded++;
        }
    }
    
    // Find next Monday or Wednesday
    while (currentDate.getDay() !== 1 && currentDate.getDay() !== 3) {
        currentDate.setDate(currentDate.getDate() + 1);
        // Skip weekends
        if (currentDate.getDay() === 0) {
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }
    
    const minDate = currentDate.toISOString().split('T')[0];
    input.setAttribute('min', minDate);
}

// Handle Application Form Submit (New Customer)
async function handleApplicationSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('.submit-btn');
    const originalBtnText = submitBtn.textContent;
    
    // Get form data
    const formData = new FormData(form);
    const data = {
        businessName: formData.get('business_name'),
        contactName: formData.get('contact_name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        address: formData.get('address'),
        quantity: formData.get('quantity'),
        acknowledged: formData.get('acknowledge') === 'on',
        customerType: 'NEW',
        submittedAt: new Date().toISOString()
    };
    
    // Get logo file info
    const logoFile = document.getElementById('app_logo').files[0];
    if (logoFile) {
        data.logoFileName = logoFile.name;
        data.logoFileSize = logoFile.size;
        data.logoFileType = logoFile.type;
    }
    
    // Show loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading"></span> Submitting...';
    
    try {
        // Send to Zapier webhook
        const response = await fetch(CONFIG.ZAPIER_NEW_CUSTOMER_WEBHOOK, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit application');
        }
        
        // Show success message
        showSuccess('Application submitted successfully! We will review your logo and contact you within 1 business day.');
        form.reset();
        
    } catch (error) {
        console.error('Error submitting application:', error);
        alert('There was an error submitting your application. Please try again or contact us directly.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
}

// Handle Order Form Submit (Existing Customer)
async function handleOrderSubmit(event) {
    event.preventDefault();
    
    if (!verifiedCustomer) {
        alert('Please verify your email address first');
        return;
    }
    
    const form = event.target;
    const submitBtn = form.querySelector('.submit-btn');
    const originalBtnText = submitBtn.textContent;
    
    // Get form data
    const formData = new FormData(form);
    const data = {
        email: verifiedCustomer.email,
        businessName: verifiedCustomer.businessName,
        contactName: formData.get('contact_name'),
        phone: formData.get('phone'),
        address: formData.get('address'),
        quantity: formData.get('quantity'),
        pickupDate: formData.get('pickup_date'),
        logoLink: verifiedCustomer.logoLink,
        customerType: 'EXISTING',
        submittedAt: new Date().toISOString()
    };
    
    // Show loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading"></span> Submitting Order...';
    
    try {
        // Send to Zapier webhook
        const response = await fetch(CONFIG.ZAPIER_EXISTING_CUSTOMER_WEBHOOK, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit order');
        }
        
        // Show success message
        showSuccess(`Order submitted successfully! Your ${data.quantity} branded coconuts will be ready for pickup on ${data.pickupDate}. You will receive a confirmation email shortly.`);
        form.reset();
        document.getElementById('customer-info').style.display = 'none';
        verifiedCustomer = null;
        
    } catch (error) {
        console.error('Error submitting order:', error);
        alert('There was an error submitting your order. Please try again or contact us directly.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
}

// Show success message
function showSuccess(message) {
    document.getElementById('success-text').textContent = message;
    document.getElementById('success-message').style.display = 'block';
    
    // Hide all tab contents
    const tabContents = document.getElementsByClassName('tab-content');
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].style.display = 'none';
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Reset after 5 seconds
    setTimeout(() => {
        document.getElementById('success-message').style.display = 'none';
        document.getElementById('application').classList.add('active');
        document.getElementById('application').style.display = 'block';
    }, 5000);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Set minimum date for application pickup (14 business days)
    // Note: Application doesn't have pickup date, but keeping function for reference
    console.log('Page loaded successfully');
});
