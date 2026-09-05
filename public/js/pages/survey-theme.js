        (function() {
            const savedTheme = localStorage.getItem('theme');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            
            let theme = savedTheme || (prefersDark ? 'dark' : 'light');
            
            if (theme !== 'dark' && theme !== 'light') {
                theme = 'dark';
            }
            
            document.documentElement.classList.remove('dark', 'light');
            if (theme === 'dark') {
                document.documentElement.classList.add('dark');
            }
            localStorage.setItem('theme', theme);
        })();
