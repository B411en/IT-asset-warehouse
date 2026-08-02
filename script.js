document.addEventListener('DOMContentLoaded', function() {
    // Tab switching logic
    const navLinks = document.querySelectorAll('.nav-link');
    const tabContents = document.querySelectorAll('.tab-content');

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all links and tabs
            navLinks.forEach(l => l.classList.remove('active'));
            tabContents.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked link and corresponding tab
            this.classList.add('active');
            const targetTab = this.getAttribute('data-tab');
            document.getElementById(targetTab).classList.add('active');
        });
    });
});
