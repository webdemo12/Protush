// Admin dashboard functionality
document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
});

async function checkAuthentication() {
    try {
        const response = await fetch('/api/admin/check-auth');
        const result = await response.json();

        if (!result.authenticated) {
            window.location.href = '/admin-login.html';
            return;
        }

        // User is authenticated, load registrations
        loadRegistrations();
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/admin-login.html';
    }
}

async function loadRegistrations() {
    const tableBody = document.getElementById('registrationTableBody');
    const totalCount = document.getElementById('totalCount');

    try {
        const response = await fetch('/api/registrations');
        const result = await response.json();

        if (result.success && result.registrations) {
            const registrations = result.registrations;
            totalCount.textContent = registrations.length;

            if (registrations.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="10" class="loading-cell">No registrations found</td></tr>';
                return;
            }

            tableBody.innerHTML = registrations.map(reg => {
                const date = new Date(reg.createdAt).toLocaleDateString();
                const year = reg.yearOfStudying || reg.yearOfPassing || '-';
                const whatsapp = reg.whatsappNumber || '-';
                
                let statusClass = 'status-pending';
                if (reg.paymentStatus === 'completed') statusClass = 'status-completed';
                if (reg.paymentStatus === 'failed') statusClass = 'status-failed';

                const paymentId = reg.razorpayPaymentId 
                    ? `<span title="${reg.razorpayPaymentId}">${reg.razorpayPaymentId.substring(0, 15)}...</span>`
                    : '-';

                return `
                    <tr>
                        <td>${escapeHtml(reg.id)}</td>
                        <td>${escapeHtml(reg.name)}</td>
                        <td>${escapeHtml(reg.email)}</td>
                        <td>${escapeHtml(reg.contactNumber)}</td>
                        <td>${escapeHtml(whatsapp)}</td>
                        <td>${escapeHtml(reg.registrationCategory)}</td>
                        <td>${escapeHtml(year)}</td>
                        <td><span class="status-badge ${statusClass}">${reg.paymentStatus}</span></td>
                        <td>${paymentId}</td>
                        <td>${date}</td>
                    </tr>
                `;
            }).join('');
        } else {
            tableBody.innerHTML = '<tr><td colspan="10" class="loading-cell">Failed to load registrations</td></tr>';
        }
    } catch (error) {
        console.error('Error loading registrations:', error);
        tableBody.innerHTML = '<tr><td colspan="10" class="loading-cell">Error loading registrations</td></tr>';
    }
}

function refreshData() {
    document.getElementById('registrationTableBody').innerHTML = '<tr><td colspan="10" class="loading-cell">Loading...</td></tr>';
    loadRegistrations();
}

async function logout() {
    try {
        await fetch('/api/admin/logout', { method: 'POST' });
        window.location.href = '/admin-login.html';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/admin-login.html';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
