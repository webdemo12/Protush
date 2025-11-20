// Pricing configuration (amounts in paise: 1 INR = 100 paise)
const PRICING = {
    student: 30000,        // ₹300
    professional: 50000,   // ₹500
    academic: 40000,       // ₹400
    other: 50000          // ₹500
};

// Helper function to get amount based on category
function getAmountByCategory(category) {
    return PRICING[category] || 50000;
}

// Helper function to format amount for display
function formatAmount(amountInPaise) {
    return (amountInPaise / 100).toFixed(0);
}

// Form validation and submission
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('registrationForm');
    const categorySelect = document.getElementById('registrationCategory');
    const studentYearGroup = document.getElementById('studentYearGroup');
    const professionalYearGroup = document.getElementById('professionalYearGroup');
    const amountDisplay = document.getElementById('amountDisplay');
    const amountValue = document.getElementById('amountValue');

    // Show/hide year fields based on registration category
    categorySelect.addEventListener('change', function() {
        const category = this.value;
        
        if (category === 'student') {
            studentYearGroup.style.display = 'block';
            professionalYearGroup.style.display = 'none';
            // Make student year required
            const studentRadios = document.querySelectorAll('input[name="yearOfStudying"]');
            studentRadios.forEach(radio => radio.required = true);
            document.getElementById('yearOfPassing').required = false;
        } else if (category === 'professional') {
            studentYearGroup.style.display = 'none';
            professionalYearGroup.style.display = 'block';
            // Make year of passing required
            document.getElementById('yearOfPassing').required = true;
            const studentRadios = document.querySelectorAll('input[name="yearOfStudying"]');
            studentRadios.forEach(radio => radio.required = false);
        } else {
            studentYearGroup.style.display = 'none';
            professionalYearGroup.style.display = 'none';
            // Make both optional
            const studentRadios = document.querySelectorAll('input[name="yearOfStudying"]');
            studentRadios.forEach(radio => radio.required = false);
            document.getElementById('yearOfPassing').required = false;
        }

        // Update amount display
        if (category) {
            const amount = getAmountByCategory(category);
            amountValue.textContent = '₹' + formatAmount(amount);
            amountDisplay.style.display = 'block';
        } else {
            amountDisplay.style.display = 'none';
        }
    });

    // Form submission - Opens Razorpay payment
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Clear previous errors
        document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
        
        // Validate form
        if (!validateForm()) {
            return;
        }

        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';

        try {
            // Get form data
            const formData = {
                email: document.getElementById('email').value,
                name: document.getElementById('name').value,
                contactNumber: document.getElementById('contactNumber').value,
                whatsappNumber: document.getElementById('whatsappNumber').value || null,
                registrationCategory: document.getElementById('registrationCategory').value,
                yearOfStudying: getSelectedRadio('yearOfStudying'),
                yearOfPassing: document.getElementById('yearOfPassing').value || null,
            };

            // Calculate amount based on category
            const amount = getAmountByCategory(formData.registrationCategory);

            // Create Razorpay order
            const orderResponse = await fetch('/api/create-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: amount,
                    currency: 'INR',
                    ...formData
                })
            });

            const orderData = await orderResponse.json();

            if (!orderData.success) {
                throw new Error(orderData.error || 'Failed to create order');
            }

            // Configure Razorpay options
            const options = {
                key: orderData.razorpayKeyId,
                amount: orderData.amount,
                currency: orderData.currency,
                name: 'WB Physician Associate Summit 2025',
                description: 'Registration Fee',
                order_id: orderData.orderId,
                prefill: {
                    name: formData.name,
                    email: formData.email,
                    contact: formData.contactNumber
                },
                theme: {
                    color: '#14b8a6'
                },
                handler: function(response) {
                    // Payment successful
                    verifyPayment(response, orderData.registrationId);
                },
                modal: {
                    ondismiss: function() {
                        // Payment cancelled
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Proceed to Payment';
                        alert('Payment cancelled. Please try again.');
                    }
                }
            };

            // Open Razorpay checkout
            const razorpay = new Razorpay(options);
            razorpay.open();

        } catch (error) {
            console.error('Submission error:', error);
            alert('An error occurred: ' + error.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Proceed to Payment';
        }
    });
});

// Verify payment after successful Razorpay payment
async function verifyPayment(response, registrationId) {
    try {
        const verifyResponse = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                registrationId: registrationId
            })
        });

        const result = await verifyResponse.json();

        if (result.success) {
            // Redirect to success page
            window.location.href = '/success.html';
        } else {
            alert('Payment verification failed. Please contact support with your payment ID: ' + response.razorpay_payment_id);
        }
    } catch (error) {
        console.error('Verification error:', error);
        alert('Payment verification error. Please contact support.');
    }
}

// Helper function to get selected radio button value
function getSelectedRadio(name) {
    const radio = document.querySelector(`input[name="${name}"]:checked`);
    return radio ? radio.value : null;
}

// Validation function
function validateForm() {
    let isValid = true;

    // Email validation
    const email = document.getElementById('email');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.value)) {
        document.getElementById('email-error').textContent = 'Please enter a valid email address';
        isValid = false;
    }

    // Contact number validation
    const contactNumber = document.getElementById('contactNumber');
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(contactNumber.value)) {
        document.getElementById('contact-error').textContent = 'Please enter a valid 10-digit contact number';
        isValid = false;
    }

    // WhatsApp number validation (optional)
    const whatsappNumber = document.getElementById('whatsappNumber');
    if (whatsappNumber.value && !phoneRegex.test(whatsappNumber.value)) {
        alert('Please enter a valid 10-digit WhatsApp number');
        isValid = false;
    }

    // Category validation
    const category = document.getElementById('registrationCategory');
    if (!category.value) {
        document.getElementById('category-error').textContent = 'Please select a registration category';
        isValid = false;
    }

    return isValid;
}

// Clear form function
function clearForm() {
    if (confirm('Are you sure you want to clear all form data?')) {
        document.getElementById('registrationForm').reset();
        document.getElementById('studentYearGroup').style.display = 'none';
        document.getElementById('professionalYearGroup').style.display = 'none';
        document.getElementById('amountDisplay').style.display = 'none';
        document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    }
}
